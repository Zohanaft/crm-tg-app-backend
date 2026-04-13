import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { ActionsService } from '../actions/actions.service';
import { WssInternalService } from '../wss-internal/wss-internal.service';
import { WorkspaceInviteStatus } from '../generated/prisma/client';

const WORKSPACES_CACHE_KEY_PREFIX = 'workspaces:';
const WORKSPACES_CACHE_TTL_SEC = 300;

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly actionsService: ActionsService,
    private readonly wssInternal: WssInternalService,
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
        return JSON.parse(cached) as Awaited<
          ReturnType<WorkspaceService['loadWorkspacesByOwnerId']>
        >;
      } catch {
        // invalid cache, fall through to DB
      }
    }

    const list = await this.loadWorkspacesByOwnerId(ownerId);
    await this.cache.set(
      cacheKey,
      JSON.stringify(list),
      WORKSPACES_CACHE_TTL_SEC,
    );
    return list;
  }

  async findAccessibleByUserId(userId: string) {
    // `members` includes workspace_members records; in theory owner is also a member
    // (created in AuthService), but we keep `ownerId` as a fallback.
    return this.prisma.workspace.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
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

  async findMembershipsByUserId(userId: string) {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      select: {
        workspaceId: true,
      },
    });
    return memberships.map((membership) => membership.workspaceId);
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
      throw new BadRequestException({
        code: 'errors.workspaceLimitReached',
        params: {
          plan: plan.name,
          max: plan.maxWorkspaces,
        },
      });
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

  async update(workspaceId: string, userId: string, name?: string) {
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

  private async assertWorkspaceMember(workspaceId: string, userId: string) {
    const row = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId },
      select: { id: true },
    });
    if (!row) {
      throw new ForbiddenException('Access denied');
    }
  }

  async listMembers(workspaceId: string, requesterId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }
    await this.assertWorkspaceMember(workspaceId, requesterId);

    const rows = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    return rows.map((row) => ({
      id: row.id,
      userId: row.user.id,
      username: row.user.username,
      firstName: row.user.firstName,
      lastName: row.user.lastName,
      photoUrl: row.user.photoUrl,
    }));
  }

  async removeMember(
    workspaceId: string,
    actorId: string,
    targetUserId: string,
  ) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, ownerId: true },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }
    if (workspace.ownerId !== actorId) {
      throw new ForbiddenException('Only the workspace owner can remove members');
    }
    if (targetUserId === workspace.ownerId) {
      throw new BadRequestException('Cannot remove the workspace owner');
    }

    const membership = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: targetUserId },
      select: { id: true },
    });
    if (!membership) {
      throw new NotFoundException('Member not found');
    }

    await this.prisma.workspaceMember.delete({
      where: { id: membership.id },
    });

    await this.cache.del(`${WORKSPACES_CACHE_KEY_PREFIX}${workspace.ownerId}`);

    await this.wssInternal.publishMemberRemoved({
      workspaceId,
      removedUserId: targetUserId,
    });
  }

  async createInvite(
    workspaceId: string,
    inviterId: string,
    inviteeUserId: string,
  ) {
    if (!inviteeUserId?.trim()) {
      throw new BadRequestException('invitedUserId is required');
    }

    if (inviterId === inviteeUserId) {
      throw new BadRequestException('Cannot invite yourself');
    }

    await this.assertWorkspaceMember(workspaceId, inviterId);

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const alreadyMember = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: inviteeUserId },
      select: { id: true },
    });
    if (alreadyMember) {
      throw new BadRequestException('User is already a member');
    }

    const pending = await this.prisma.workspaceInvite.findFirst({
      where: {
        workspaceId,
        invitedUserId: inviteeUserId,
        status: WorkspaceInviteStatus.PENDING,
      },
      select: { id: true },
    });
    if (pending) {
      throw new BadRequestException('Invite already pending');
    }

    const invite = await this.prisma.workspaceInvite.create({
      data: {
        workspaceId,
        invitedByUserId: inviterId,
        invitedUserId: inviteeUserId,
        status: WorkspaceInviteStatus.PENDING,
      },
      select: {
        id: true,
        workspaceId: true,
        invitedByUserId: true,
        invitedUserId: true,
        status: true,
        createdAt: true,
      },
    });

    const inviter = await this.prisma.user.findUnique({
      where: { id: inviterId },
      select: { username: true, firstName: true },
    });
    const inviterLabel =
      inviter?.firstName ?? inviter?.username ?? 'Участник';

    await this.actionsService.createAndBroadcast({
      workspaceId,
      type: 'WORKSPACE_INVITE',
      title: `Приглашение в «${workspace.name}» от ${inviterLabel}`,
      meta: { inviteId: invite.id, workspaceName: workspace.name },
      actorUserId: inviterId,
      recipientUserId: inviteeUserId,
      broadcast: false,
    });

    return invite;
  }

  async listPendingInvitesForUser(userId: string) {
    return this.prisma.workspaceInvite.findMany({
      where: {
        invitedUserId: userId,
        status: WorkspaceInviteStatus.PENDING,
      },
      select: {
        id: true,
        workspaceId: true,
        invitedByUserId: true,
        createdAt: true,
        workspace: {
          select: { id: true, name: true, ownerId: true },
        },
        invitedBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async acceptInvite(inviteId: string, userId: string) {
    const invite = await this.prisma.workspaceInvite.findFirst({
      where: {
        id: inviteId,
        invitedUserId: userId,
        status: WorkspaceInviteStatus.PENDING,
      },
      include: {
        workspace: { select: { id: true, name: true, ownerId: true } },
      },
    });
    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    await this.prisma.workspaceMember.create({
      data: {
        workspaceId: invite.workspaceId,
        userId,
      },
    });

    await this.prisma.workspaceInvite.update({
      where: { id: inviteId },
      data: { status: WorkspaceInviteStatus.ACCEPTED },
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
      },
    });

    const display =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      user.username ||
      'Новый участник';

    await this.actionsService.createAndBroadcast({
      workspaceId: invite.workspaceId,
      type: 'WORKSPACE_MEMBER_JOINED',
      title: `${display} присоединился к «${invite.workspace.name}»`,
      meta: {
        userId: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        inviteId,
      },
      actorUserId: userId,
      broadcastWorkspaceIds: [invite.workspaceId],
    });

    await this.wssInternal.publishMemberJoined({
      workspaceId: invite.workspaceId,
      inviteId,
      member: {
        userId: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });

    return { ok: true as const, workspaceId: invite.workspaceId };
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
