import { Injectable } from '@nestjs/common';
import { ClientsService } from '../clients/clients.service';
import { PrismaService } from '../prisma/prisma.service';

interface TelegramWebhookUpdate {
  message?: {
    from?: {
      id: number;
      is_bot?: boolean;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    chat?: {
      id: number;
      type?: string;
    };
    text?: string;
  };
}

@Injectable()
export class TelegramWebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientsService: ClientsService,
  ) {}

  async handle(secret: string, body: TelegramWebhookUpdate) {
    console.log('[telegram-webhook] update:', JSON.stringify(body));

    const bot = await this.prisma.tgBot.findFirst({
      where: { webhookSecret: secret },
      select: { botId: true },
    });
    if (!bot) {
      return { ok: true };
    }

    const text = body?.message?.text;
    const from = body?.message?.from;
    if (text !== '/start' || !from?.id) {
      return { ok: true };
    }

    console.log('[telegram-webhook] /start:', {
      botId: String(bot.botId),
      fromId: from.id,
      chatId: body?.message?.chat?.id,
      chatType: body?.message?.chat?.type,
      username: from.username ?? null,
    });

    const saved = await this.clientsService.createOrLinkTelegramClientByStart({
      telegramBotId: bot.botId,
      from,
      chat: body?.message?.chat,
    });

    await this.publishClientStartEvent(saved);
    return { ok: true };
  }

  private async publishClientStartEvent(payload: {
    ownerId: string;
    workspaceIds: string[];
    client: {
      telegramId: string;
      isBot: boolean;
      firstName: string;
      lastName: string | null;
      username: string | null;
      chatId: string | null;
      chatType: string | null;
    };
  }) {
    const baseUrl = process.env['WSS_INTERNAL_URL']?.replace(/\/$/, '');
    const sharedSecret = process.env['WSS_SHARED_SECRET'] ?? '';
    if (!baseUrl) {
      return;
    }
    try {
      await fetch(`${baseUrl}/internal/events/client-start`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(sharedSecret ? { 'x-wss-shared-secret': sharedSecret } : {}),
        },
        body: JSON.stringify(payload),
      });
    } catch {
      // Best effort bridge: webhook should stay idempotent and fast.
    }
  }
}
