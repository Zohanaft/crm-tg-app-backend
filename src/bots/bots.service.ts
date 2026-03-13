import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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

@Injectable()
export class BotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  private async fetchTelegramGetMe(token: string): Promise<NonNullable<TelegramGetMeResponse['result']>> {
    const url = `https://api.telegram.org/bot${encodeURIComponent(token)}/getMe`;
    const res = await fetch(url);
    const data = (await res.json()) as TelegramGetMeResponse;
    if (!data.ok || !data.result) {
      throw new BadRequestException('Invalid bot token');
    }
    return data.result;
  }

  async create(userId: string, token: string) {
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

    const bot = await this.prisma.tgBot.create({
      data: {
        userId,
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
        botId: true,
        firstName: true,
        username: true,
        isBot: true,
        canJoinGroups: true,
        canReadAllGroupMessages: true,
        supportsInlineQueries: true,
        rawData: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.cache.del(`${BOTS_CACHE_KEY_PREFIX}${userId}`);
    return {
      ...bot,
      botId: String(bot.botId),
    };
  }

  async findAll(user: User, params: { page?: number; limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const sortBy = params.sortBy ?? 'createdAt';
    const sortOrder = params.sortOrder ?? 'desc';

    const isDefaultQuery = page === 1 && limit === 20 && sortBy === 'createdAt' && sortOrder === 'desc';
    const cacheKey = `${BOTS_CACHE_KEY_PREFIX}${user.id}`;
    if (isDefaultQuery) {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached) as { items: Array<{ id: string; botId: string; [k: string]: unknown }>; total: number };
        } catch {
          // invalid cache, fall through
        }
      }
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.tgBot.findMany({
        where: { userId: user.id },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
        select: {
          id: true,
          botId: true,
          firstName: true,
          username: true,
          isBot: true,
          canJoinGroups: true,
          canReadAllGroupMessages: true,
          supportsInlineQueries: true,
          rawData: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.tgBot.count({ where: { userId: user.id } }),
    ]);

    const result = {
      items: items.map((b) => ({ ...b, botId: String(b.botId) })),
      total,
    };
    if (isDefaultQuery) {
      await this.cache.set(cacheKey, JSON.stringify(result), BOTS_CACHE_TTL_SEC);
    }
    return result;
  }

  async findOne(user: User, botId: string) {
    const id = BigInt(botId);
    const bot = await this.prisma.tgBot.findUnique({
      where: { botId: id },
    });
    if (!bot || bot.userId !== user.id) {
      throw new NotFoundException('Bot not found');
    }
    return {
      ...bot,
      botId: String(bot.botId),
    };
  }

  async update(user: User, botId: string, dto: { firstName?: string; username?: string }) {
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
        botId: true,
        firstName: true,
        username: true,
        isBot: true,
        canJoinGroups: true,
        canReadAllGroupMessages: true,
        supportsInlineQueries: true,
        rawData: true,
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
    await this.prisma.tgBot.delete({
      where: { botId: id },
    });
    await this.cache.del(`${BOTS_CACHE_KEY_PREFIX}${user.id}`);
  }
}
