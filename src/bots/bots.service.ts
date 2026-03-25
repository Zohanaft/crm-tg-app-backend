import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import type { User } from '../generated/prisma/client';

const BOTS_CACHE_KEY_PREFIX = 'bots:';
const BOTS_CACHE_TTL_SEC = 300;

interface TelegramGetMeResponse {
  ok: boolean;
  result?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username?: string;
    can_join_groups?: boolean;
    can_read_all_group_messages?: boolean;
    supports_inline_queries?: boolean;
  };
}

function getEnv(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function normalizeWebhookBaseUrl(raw: string): string {
  const clean = raw.replace(/\/$/, '');
  if (clean.endsWith('/api/wss')) {
    return clean.slice(0, -'/api/wss'.length);
  }
  return clean;
}

/** Telegram requires HTTPS for public webhooks; upgrade when proxy sent http:// for a real domain */
function ensureHttpsWebhookBaseForTelegram(raw: string): string {
  const clean = normalizeWebhookBaseUrl(raw);
  try {
    const u = new URL(clean);
    const host = u.hostname.toLowerCase();
    const isLocal =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.endsWith('.local');
    const isPublicDomain = host.includes('.') && !isLocal;
    if (u.protocol === 'http:' && isPublicDomain) {
      u.protocol = 'https:';
      return u.href.replace(/\/$/, '');
    }
    return clean;
  } catch {
    return clean;
  }
}

@Injectable()
export class BotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  private async fetchTelegramGetMe(
    token: string,
  ): Promise<NonNullable<TelegramGetMeResponse['result']>> {
    const url = `https://api.telegram.org/bot${encodeURIComponent(token)}/getMe`;
    const res = await fetch(url);
    const data = (await res.json()) as TelegramGetMeResponse;
    if (!data.ok || !data.result) {
      throw new BadRequestException('Invalid bot token');
    }
    return data.result;
  }

  private async telegramApi(
    token: string,
    method: string,
    body?: object,
  ): Promise<{ ok: boolean; description?: string }> {
    const url = `https://api.telegram.org/bot${encodeURIComponent(token)}/${method}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : '{}',
    });
    return (await res.json()) as { ok: boolean; description?: string };
  }

  async create(userId: string, token: string, requestBaseUrl?: string) {
    const me = await this.fetchTelegramGetMe(token);
    const botId = BigInt(me.id);

    const existing = await this.prisma.tgBot.findUnique({
      where: { botId },
    });
    if (existing) {
      if (existing.userId === userId) {
        throw new BadRequestException('Bot already connected');
      }
      throw new BadRequestException('Bot is already used by another user');
    }

    const baseUrl = requestBaseUrl ?? getEnv('TELEGRAM_WEBHOOK_BASE_URL');
    const skipWebhook = getEnv('TELEGRAM_WEBHOOK_SKIP') === 'true';
    if (!skipWebhook && !baseUrl) {
      throw new BadRequestException(
        'Cannot detect public HTTPS domain from request. Set TELEGRAM_WEBHOOK_BASE_URL (e.g. https://api.example.com or https://api.example.com/api/wss) or TELEGRAM_WEBHOOK_SKIP=true for local dev.',
      );
    }

    const webhookSecret = randomBytes(32).toString('base64url');

    const bot = await this.prisma.tgBot.create({
      data: {
        userId,
        webhookSecret,
        botId,
        token,
        isBot: me.is_bot ?? null,
        firstName: me.first_name ?? null,
        username: me.username ?? null,
        canJoinGroups: me.can_join_groups ?? null,
        canReadAllGroupMessages: me.can_read_all_group_messages ?? null,
        supportsInlineQueries: me.supports_inline_queries ?? null,
        rawData: me as unknown as object,
      },
      select: {
        id: true,
        userId: true,
        botId: true,
        firstName: true,
        username: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!skipWebhook && baseUrl) {
      const cleanBase = ensureHttpsWebhookBaseForTelegram(baseUrl);
      if (!/^https:\/\//i.test(cleanBase)) {
        await this.prisma.tgBot.delete({ where: { id: bot.id } });
        throw new BadRequestException(
          'Webhook URL must use https:// for Telegram (public domain). For local dev set TELEGRAM_WEBHOOK_SKIP=true, or set TELEGRAM_WEBHOOK_BASE_URL explicitly (e.g. https://zohanafttcrm.com or https://zohanafttcrm.com/api/wss).',
        );
      }
      const webhookPath = '/api/wss/telegram/webhook';
      const webhookUrl = `${cleanBase}${webhookPath}/${encodeURIComponent(webhookSecret)}`;
      const wh = await this.telegramApi(token, 'setWebhook', {
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query', 'inline_query'],
      });
      if (!wh.ok) {
        await this.prisma.tgBot.delete({ where: { id: bot.id } });
        throw new BadRequestException(
          wh.description ?? 'Failed to set Telegram webhook',
        );
      }
    }

    const desc = getEnv('BOT_DEFAULT_DESCRIPTION');
    const shortDesc = getEnv('BOT_DEFAULT_SHORT_DESCRIPTION');
    if (desc) {
      await this.telegramApi(token, 'setMyDescription', { description: desc });
    }
    if (shortDesc) {
      await this.telegramApi(token, 'setMyShortDescription', {
        short_description: shortDesc,
      });
    }

    await this.cache.del(`${BOTS_CACHE_KEY_PREFIX}${userId}`);
    return {
      ...bot,
      botId: String(bot.botId),
    };
  }

  async findAll(
    user: User,
    params: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
  ) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const sortBy = params.sortBy ?? 'createdAt';
    const sortOrder = params.sortOrder ?? 'desc';

    const isDefaultQuery =
      page === 1 &&
      limit === 20 &&
      sortBy === 'createdAt' &&
      sortOrder === 'desc';
    const cacheKey = `${BOTS_CACHE_KEY_PREFIX}${user.id}`;
    if (isDefaultQuery) {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached) as {
            items: Array<Record<string, unknown>>;
            total: number;
          };
        } catch {
          // fall through
        }
      }
    }

    const skip = (page - 1) * limit;
    const select = {
      id: true,
      userId: true,
      botId: true,
      firstName: true,
      username: true,
      createdAt: true,
      updatedAt: true,
    } as const;

    const [items, total] = await Promise.all([
      this.prisma.tgBot.findMany({
        where: { userId: user.id },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
        select,
      }),
      this.prisma.tgBot.count({ where: { userId: user.id } }),
    ]);

    const result = {
      items: items.map((b) => ({ ...b, botId: String(b.botId) })),
      total,
    };
    if (isDefaultQuery) {
      await this.cache.set(
        cacheKey,
        JSON.stringify(result),
        BOTS_CACHE_TTL_SEC,
      );
    }
    return result;
  }

  async findOne(user: User, botId: string) {
    const id = BigInt(botId);
    const bot = await this.prisma.tgBot.findFirst({
      where: { botId: id, userId: user.id },
      select: {
        id: true,
        userId: true,
        botId: true,
        firstName: true,
        username: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!bot) {
      throw new NotFoundException('Bot not found');
    }
    return {
      ...bot,
      botId: String(bot.botId),
    };
  }

  async update(
    user: User,
    botId: string,
    dto: { firstName?: string; username?: string },
  ) {
    const id = BigInt(botId);
    const bot = await this.prisma.tgBot.findUnique({
      where: { botId: id },
    });
    if (!bot || bot.userId !== user.id) {
      throw new NotFoundException('Bot not found');
    }

    const updated = await this.prisma.tgBot.update({
      where: { botId: id },
      data: {
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.username !== undefined && { username: dto.username }),
      },
      select: {
        id: true,
        userId: true,
        botId: true,
        firstName: true,
        username: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.cache.del(`${BOTS_CACHE_KEY_PREFIX}${user.id}`);
    return { ...updated, botId: String(updated.botId) };
  }

  async remove(user: User, botId: string) {
    const id = BigInt(botId);
    const bot = await this.prisma.tgBot.findUnique({
      where: { botId: id },
    });
    if (!bot || bot.userId !== user.id) {
      throw new ForbiddenException('Bot not found');
    }
    const skipWebhook = getEnv('TELEGRAM_WEBHOOK_SKIP') === 'true';
    if (!skipWebhook && bot.token) {
      await this.telegramApi(bot.token, 'deleteWebhook', {
        drop_pending_updates: false,
      });
    }
    await this.prisma.tgBot.delete({
      where: { botId: id },
    });
    await this.cache.del(`${BOTS_CACHE_KEY_PREFIX}${user.id}`);
  }
}
