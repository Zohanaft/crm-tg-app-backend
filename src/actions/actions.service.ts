import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WssInternalService } from '../wss-internal/wss-internal.service';
import type { Action } from '../generated/prisma/client';

export type ActionDto = {
  id: string;
  workspaceId: string;
  type: string;
  title: string;
  meta: unknown | null;
  actorUserId: string | null;
  recipientUserId: string | null;
  createdAt: Date;
};

@Injectable()
export class ActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wss: WssInternalService,
  ) {}

  toDto(row: Action): ActionDto {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      type: row.type,
      title: row.title,
      meta: row.meta ?? null,
      actorUserId: row.actorUserId ?? null,
      recipientUserId: row.recipientUserId ?? null,
      createdAt: row.createdAt,
    };
  }

  async listForUser(params: {
    userId: string;
    workspaceId?: string;
    limit?: number;
  }): Promise<ActionDto[]> {
    const { userId, workspaceId, limit = 50 } = params;

    const membershipIds = await this.prisma.workspaceMember.findMany({
      where: { userId },
      select: { workspaceId: true },
    });
    const allowedWorkspaceIds = membershipIds.map((m) => m.workspaceId);

    if (workspaceId !== undefined && workspaceId !== '') {
      if (!allowedWorkspaceIds.includes(workspaceId)) {
        throw new ForbiddenException('Access denied');
      }
    }

    const where =
      workspaceId !== undefined && workspaceId !== ''
        ? {
            workspaceId,
            OR: [
              { recipientUserId: null },
              { recipientUserId: userId },
            ],
          }
        : {
            workspaceId: { in: allowedWorkspaceIds },
            OR: [
              { recipientUserId: null },
              { recipientUserId: userId },
            ],
          };

    const rows = await this.prisma.action.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });

    return rows.map((r) => this.toDto(r));
  }

  async createAndBroadcast(params: {
    workspaceId: string;
    type: string;
    title: string;
    meta?: unknown;
    actorUserId?: string | null;
    recipientUserId?: string | null;
    broadcastWorkspaceIds?: string[];
    /** If false, only persist (e.g. personal invite). Default: true when recipientUserId is null */
    broadcast?: boolean;
  }): Promise<ActionDto> {
    const row = await this.prisma.action.create({
      data: {
        workspaceId: params.workspaceId,
        type: params.type,
        title: params.title,
        meta: params.meta === undefined ? undefined : (params.meta as object),
        actorUserId: params.actorUserId ?? undefined,
        recipientUserId: params.recipientUserId ?? undefined,
      },
    });
    const dto = this.toDto(row);
    const shouldBroadcast =
      params.broadcast ??
      (params.recipientUserId === null || params.recipientUserId === undefined);
    if (shouldBroadcast) {
      const workspaceIds =
        params.broadcastWorkspaceIds && params.broadcastWorkspaceIds.length > 0
          ? params.broadcastWorkspaceIds
          : [params.workspaceId];
      await this.wss.publishActionCreated({
        workspaceIds,
        action: {
          ...dto,
          createdAt: dto.createdAt.toISOString(),
        },
      });
    }
    return dto;
  }
}
