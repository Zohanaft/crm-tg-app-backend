import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

const WORKSPACES_CACHE_KEY_PREFIX = 'workspaces:';
const WORKSPACES_CACHE_TTL_SEC = 300;

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /** Effective plan ID: 1 (free) if plan expired, else user's planId */
  getEffectivePlanId(planId: number, planExpiresAt: Date | null): number {
    if (planExpiresAt && planExpiresAt < new Date()) {
      return 1;
    }
    return planId;
  }

  async findAllByOwnerId(ownerId: string) {
    const cacheKey = `${WORKSPACES_CACHE_KEY_PREFIX}${ownerId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as Awaited<ReturnType<WorkspaceService['loadWorkspacesByOwnerId']>>;
      } catch {
        // invalid cache, fall through to DB
      }
    }

    const list = await this.loadWorkspacesByOwnerId(ownerId);
    await this.cache.set(cacheKey, JSON.stringify(list), WORKSPACES_CACHE_TTL_SEC);
    return list;
  }

  private async loadWorkspacesByOwnerId(ownerId: string) {
    return this.prisma.workspace.findMany({
      where: { ownerId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        ownerName: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(userId: string, name: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        plan: true,
        _count: { select: { ownedWorkspaces: true } },
      },
    });

    const effectivePlanId = this.getEffectivePlanId(
      user.planId,
      user.planExpiresAt,
    );
    const plan = await this.prisma.plan.findUniqueOrThrow({
      where: { id: effectivePlanId },
    });

    const count = user._count.ownedWorkspaces;
    if (count >= plan.maxWorkspaces) {
      throw new BadRequestException(
        `Workspace limit reached for plan ${plan.name} (max ${plan.maxWorkspaces})`,
      );
    }

    const workspace = await this.prisma.workspace.create({
      data: {
        name,
        ownerId: userId,
        ownerName: user.username ?? null,
        members: {
          create: { userId },
        },
      },
      select: {
        id: true,
        name: true,
        ownerId: true,
        ownerName: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.cache.del(`${WORKSPACES_CACHE_KEY_PREFIX}${userId}`);
    return workspace;
  }

  async update(workspaceId: string, userId: string, name?: string | undefined) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        ownerId: true,
        ownerName: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }
    if (workspace.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can update this workspace');
    }
    if (name === undefined) {
      return workspace;
    }
    const updated = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { name },
      select: {
        id: true,
        name: true,
        ownerId: true,
        ownerName: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    await this.cache.del(`${WORKSPACES_CACHE_KEY_PREFIX}${userId}`);
    return updated;
  }

  async remove(workspaceId: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }
    if (workspace.ownerId !== userId) {
      throw new ForbiddenException('Only the owner can delete this workspace');
    }
    await this.prisma.workspace.delete({
      where: { id: workspaceId },
    });
    await this.cache.del(`${WORKSPACES_CACHE_KEY_PREFIX}${userId}`);
  }
}
