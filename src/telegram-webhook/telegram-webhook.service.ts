import { Injectable } from '@nestjs/common';
import { ClientsService } from '../clients/clients.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActionsService } from '../actions/actions.service';
import { WssInternalService } from '../wss-internal/wss-internal.service';

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
    private readonly actionsService: ActionsService,
    private readonly wssInternal: WssInternalService,
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

    await this.wssInternal.publishClientStart(saved);

    const title = `Новый клиент: ${saved.client.firstName}${
      saved.client.username ? ` @${saved.client.username}` : ''
    }`;
    for (const workspaceId of saved.workspaceIds) {
      void this.actionsService
        .createAndBroadcast({
          workspaceId,
          type: 'NEW_CLIENT',
          title,
          meta: { client: saved.client, ownerId: saved.ownerId },
          actorUserId: saved.ownerId,
          broadcastWorkspaceIds: [workspaceId],
        })
        .catch(() => {});
    }
    return { ok: true };
  }
}
