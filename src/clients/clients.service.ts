import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface TelegramStartFrom {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TelegramStartChat {
  id: number;
  type?: string;
}

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrLinkTelegramClientByStart(params: {
    telegramBotId: bigint;
    from: TelegramStartFrom;
    chat?: TelegramStartChat;
  }) {
    const { telegramBotId, from, chat } = params;

    const bot = await this.prisma.tgBot.findUnique({
      where: { botId: telegramBotId },
      select: { userId: true },
    });
    if (!bot) {
      throw new NotFoundException('Telegram bot not found');
    }

    const telegramId = BigInt(from.id);
    const client = await this.prisma.client.upsert({
      where: { telegramId },
      create: {
        telegramId,
        isBot: Boolean(from.is_bot),
        firstName: from.first_name ?? '',
        lastName: from.last_name ?? null,
        username: from.username ?? null,
        chatId: chat?.id !== undefined ? BigInt(chat.id) : null,
        chatType: chat?.type ?? null,
      },
      update: {
        isBot: Boolean(from.is_bot),
        firstName: from.first_name ?? '',
        lastName: from.last_name ?? null,
        username: from.username ?? null,
        chatId: chat?.id !== undefined ? BigInt(chat.id) : null,
        chatType: chat?.type ?? null,
      },
      select: {
        id: true,
        telegramId: true,
        isBot: true,
        firstName: true,
        lastName: true,
        username: true,
        chatId: true,
        chatType: true,
      },
    });

    await this.prisma.clientOwner.upsert({
      where: {
        clientId_ownerId: {
          clientId: client.id,
          ownerId: bot.userId,
        },
      },
      create: {
        clientId: client.id,
        ownerId: bot.userId,
      },
      update: {},
    });

    const ownerWorkspaces = await this.prisma.workspace.findMany({
      where: { ownerId: bot.userId },
      select: { id: true },
    });

    return {
      ownerId: bot.userId,
      workspaceIds: ownerWorkspaces.map((workspace) => workspace.id),
      client: {
        ...client,
        telegramId: String(client.telegramId),
        chatId: client.chatId ? String(client.chatId) : null,
      },
    };
  }

  async listForWorkspace(workspaceId: string, userId: string) {
    if (!workspaceId) {
      throw new BadRequestException('workspaceId is required');
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, ownerId: true },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const isMember = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
      select: { id: true },
    });
    if (!isMember) {
      throw new ForbiddenException('Access denied');
    }

    const clients = await this.prisma.client.findMany({
      where: {
        owners: {
          some: {
            ownerId: workspace.ownerId,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        telegramId: true,
        isBot: true,
        firstName: true,
        lastName: true,
        username: true,
        chatId: true,
        chatType: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return clients.map((c) => ({
      id: c.id,
      telegramId: String(c.telegramId),
      isBot: c.isBot,
      firstName: c.firstName,
      lastName: c.lastName,
      username: c.username,
      chatId: c.chatId ? String(c.chatId) : null,
      chatType: c.chatType,
      createdAt: c.createdAt?.toISOString?.() ?? null,
      updatedAt: c.updatedAt?.toISOString?.() ?? null,
    }));
  }

  async removeForWorkspace(workspaceId: string, userId: string, clientId: string) {
    if (!workspaceId) {
      throw new BadRequestException('workspaceId is required');
    }
    if (!clientId) {
      throw new BadRequestException('clientId is required');
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, ownerId: true },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const isMember = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
      select: { id: true },
    });
    if (!isMember) {
      throw new ForbiddenException('Access denied');
    }

    const ownerLink = await this.prisma.clientOwner.findFirst({
      where: {
        clientId,
        ownerId: workspace.ownerId,
      },
      select: { id: true },
    });
    if (!ownerLink) {
      throw new NotFoundException('Client not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.clientOwner.deleteMany({
        where: {
          clientId,
          ownerId: workspace.ownerId,
        },
      });

      const restLinks = await tx.clientOwner.count({
        where: { clientId },
      });
      if (restLinks === 0) {
        await tx.client.delete({
          where: { id: clientId },
        });
      }
    });
  }
}
