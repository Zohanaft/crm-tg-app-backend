import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
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
  readAt: Date | null;
  createdAt: Date;
};

@Injectable()
export class ActionsService implements OnModuleInit {
  private readonly logger = new Logger(ActionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wss: WssInternalService,
  ) {}

  async onModuleInit() {
    await this.ensureActionsSchema();
  }

  private async ensureActionsSchema() {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "actions" (
          "id" TEXT NOT NULL,
          "workspaceId" TEXT NOT NULL,
          "type" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "meta" JSONB,
          "actorUserId" TEXT,
          "recipientUserId" TEXT,
          "dedupKey" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "actions_pkey" PRIMARY KEY ("id")
        );

        ALTER TABLE "actions" ADD COLUMN IF NOT EXISTS "dedupKey" TEXT;

        CREATE TABLE IF NOT EXISTS "action_reads" (
          "id" TEXT NOT NULL,
          "actionId" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "action_reads_pkey" PRIMARY KEY ("id")
        );

        CREATE INDEX IF NOT EXISTS "actions_workspaceId_createdAt_idx"
          ON "actions"("workspaceId", "createdAt");
        CREATE INDEX IF NOT EXISTS "actions_recipientUserId_idx"
          ON "actions"("recipientUserId");
        CREATE UNIQUE INDEX IF NOT EXISTS "actions_workspaceId_type_dedupKey_key"
          ON "actions"("workspaceId", "type", "dedupKey");

        CREATE UNIQUE INDEX IF NOT EXISTS "action_reads_actionId_userId_key"
          ON "action_reads"("actionId", "userId");
        CREATE INDEX IF NOT EXISTS "action_reads_userId_readAt_idx"
          ON "action_reads"("userId", "readAt");

        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'actions_workspaceId_fkey'
          ) THEN
            ALTER TABLE "actions"
              ADD CONSTRAINT "actions_workspaceId_fkey"
              FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id")
              ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'actions_actorUserId_fkey'
          ) THEN
            ALTER TABLE "actions"
              ADD CONSTRAINT "actions_actorUserId_fkey"
              FOREIGN KEY ("actorUserId") REFERENCES "users"("id")
              ON DELETE SET NULL ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'actions_recipientUserId_fkey'
          ) THEN
            ALTER TABLE "actions"
              ADD CONSTRAINT "actions_recipientUserId_fkey"
              FOREIGN KEY ("recipientUserId") REFERENCES "users"("id")
              ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'action_reads_actionId_fkey'
          ) THEN
            ALTER TABLE "action_reads"
              ADD CONSTRAINT "action_reads_actionId_fkey"
              FOREIGN KEY ("actionId") REFERENCES "actions"("id")
              ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'action_reads_userId_fkey'
          ) THEN
            ALTER TABLE "action_reads"
              ADD CONSTRAINT "action_reads_userId_fkey"
              FOREIGN KEY ("userId") REFERENCES "users"("id")
              ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END $$;
      `);
      this.logger.log('Actions schema check complete');
    } catch (error) {
      this.logger.warn(`Actions schema self-heal skipped: ${String(error)}`);
    }
  }

  toDto(row: Action): ActionDto {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      type: row.type,
      title: row.title,
      meta: row.meta ?? null,
      actorUserId: row.actorUserId ?? null,
      recipientUserId: row.recipientUserId ?? null,
      readAt: null,
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
      include: {
        reads: {
          where: { userId },
          select: { readAt: true },
          take: 1,
        },
      },
    });
    return rows.map((r) => ({
      ...this.toDto(r),
      readAt: r.reads[0]?.readAt ?? null,
    }));
  }

  async markRead(userId: string, actionId: string): Promise<ActionDto> {
    const row = await this.prisma.action.findUnique({
      where: { id: actionId },
      include: {
        reads: {
          where: { userId },
          select: { readAt: true },
          take: 1,
        },
      },
    });
    if (!row) {
      throw new NotFoundException('Action not found');
    }

    const isRecipientAllowed =
      row.recipientUserId === null || row.recipientUserId === userId;
    if (!isRecipientAllowed) {
      throw new ForbiddenException('Access denied');
    }

    const membership = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId: row.workspaceId, userId },
      select: { id: true },
    });
    if (!membership) {
      throw new ForbiddenException('Access denied');
    }

    const read = await this.prisma.actionRead.upsert({
      where: {
        actionId_userId: {
          actionId,
          userId,
        },
      },
      create: {
        actionId,
        userId,
      },
      update: {
        readAt: new Date(),
      },
      select: { readAt: true },
    });

    return {
      ...this.toDto(row),
      readAt: read.readAt,
    };
  }

  async createAndBroadcast(params: {
    workspaceId: string;
    type: string;
    title: string;
    meta?: unknown;
    actorUserId?: string | null;
    recipientUserId?: string | null;
    dedupKey?: string | null;
    broadcastWorkspaceIds?: string[];
    /** If false, only persist (e.g. personal invite). Default: true when recipientUserId is null */
    broadcast?: boolean;
  }): Promise<ActionDto> {
    let row: Action;
    try {
      row = await this.prisma.action.create({
        data: {
          workspaceId: params.workspaceId,
          type: params.type,
          title: params.title,
          meta: params.meta === undefined ? undefined : (params.meta as object),
          actorUserId: params.actorUserId ?? undefined,
          recipientUserId: params.recipientUserId ?? undefined,
          dedupKey: params.dedupKey ?? undefined,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        params.dedupKey
      ) {
        const existed = await this.prisma.action.findFirst({
          where: {
            workspaceId: params.workspaceId,
            type: params.type,
            dedupKey: params.dedupKey,
          },
        });
        if (existed) {
          return this.toDto(existed);
        }
      }
      throw error;
    }
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
