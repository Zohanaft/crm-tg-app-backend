import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async searchForWorkspaceInvite(params: {
    workspaceId: string;
    q: string;
    currentUserId: string;
  }) {
    const { workspaceId, q, currentUserId } = params;
    const trimmed = q.trim().replace(/^@+/, '');
    if (trimmed.length < 1) {
      return [];
    }

    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: currentUserId },
      select: { id: true },
    });
    if (!member) {
      throw new ForbiddenException('Access denied');
    }

    const existingMemberIds = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      select: { userId: true },
    });
    const memberIdSet = new Set(existingMemberIds.map((m) => m.userId));

    const pendingInviteeIds = await this.prisma.workspaceInvite.findMany({
      where: {
        workspaceId,
        status: 'PENDING',
      },
      select: { invitedUserId: true },
    });
    for (const row of pendingInviteeIds) {
      memberIdSet.add(row.invitedUserId);
    }

    const users = await this.prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        AND: [
          { id: { notIn: [...memberIdSet] } },
          {
            OR: [
              { username: { contains: trimmed, mode: 'insensitive' } },
              { firstName: { contains: trimmed, mode: 'insensitive' } },
              { lastName: { contains: trimmed, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        photoUrl: true,
      },
      take: 20,
      orderBy: { username: 'asc' },
    });

    return users;
  }
}
