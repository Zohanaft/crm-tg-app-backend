import { Injectable, Logger } from '@nestjs/common';
import { ClientsService } from '../clients/clients.service';
import { PrismaService } from '../prisma/prisma.service';
import { ActionsService } from '../actions/actions.service';
import { WssInternalService } from '../wss-internal/wss-internal.service';

interface TelegramWebhookUpdate {
  update_id?: number;
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
  private readonly logger = new Logger(TelegramWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clientsService: ClientsService,
    private readonly actionsService: ActionsService,
    private readonly wssInternal: WssInternalService,
  ) {}

  async handle(secret: string, body: TelegramWebhookUpdate) {
    this.logger.log(
      `update update_id=${body.update_id ?? 'n/a'} hasMessage=${Boolean(body?.message)}`,
    );

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

    const saved = await this.clientsService.createOrLinkTelegramClientByStart({
      telegramBotId: bot.botId,
      from,
      chat: body?.message?.chat,
    });

    this.logger.log(
      `/start botId=${String(bot.botId)} fromId=${from.id} clientId=${saved.client.id} workspaces=${saved.workspaceIds.length}`,
    );

    await this.wssInternal.publishClientStart(saved);

    const title = `Новый клиент: ${saved.client.firstName}${
      saved.client.username ? ` @${saved.client.username}` : ''
    }`;
    if (saved.workspaceIds.length > 0) {
      void this.actionsService
        .createAndBroadcast({
          workspaceId: saved.workspaceIds[0],
          type: 'NEW_CLIENT',
          title,
          meta: { client: saved.client, ownerId: saved.ownerId },
          actorUserId: saved.ownerId,
          dedupKey: `new-client:${saved.client.telegramId}`,
          broadcastWorkspaceIds: saved.workspaceIds,
        })
        .catch(() => {});
    }
    return { ok: true };
  }
}
