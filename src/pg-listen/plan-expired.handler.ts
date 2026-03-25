import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  PgListenService,
  PLAN_EXPIRED_CHANNEL,
  type PlanExpiredPayload,
} from './pg-listen.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlanExpiredHandler implements OnModuleInit {
  private readonly logger = new Logger(PlanExpiredHandler.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.eventEmitter.on(
      PLAN_EXPIRED_CHANNEL,
      async (payload: PlanExpiredPayload) => {
        await this.handlePlanExpired(payload);
      },
    );
  }

  private async handlePlanExpired(payload: PlanExpiredPayload) {
    const userId = payload.user_id;
    try {
      const userWorkspaces = await this.prisma.workspaceMember.findMany({
        where: { userId },
        select: { workspaceId: true },
      });
      const workspaceIds = userWorkspaces.map((w) => w.workspaceId);
      if (workspaceIds.length === 0) {
        this.logger.log(`Plan expired for user ${userId}, no workspaces`);
        return;
      }
      const members = await this.prisma.workspaceMember.findMany({
        where: { workspaceId: { in: workspaceIds } },
        select: { userId: true },
      });
      const userIds = [...new Set(members.map((m) => m.userId))];
      this.logger.log(
        `Plan expired for user ${userId}, notify workspace members: ${userIds.join(', ')}`,
      );
      // Later: websocketService.broadcast(userIds, { event: 'plan_expired', userId });
    } catch (err) {
      this.logger.error(`Plan expired handler failed for user ${userId}`, err);
    }
  }
}
