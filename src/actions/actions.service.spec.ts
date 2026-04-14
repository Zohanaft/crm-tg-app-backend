import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ActionsService } from './actions.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { WssInternalService } from '../wss-internal/wss-internal.service';

function mockPrisma() {
  return {
    workspaceMember: { findMany: jest.fn(), findFirst: jest.fn() },
    action: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    actionRead: { upsert: jest.fn() },
    $executeRawUnsafe: jest.fn().mockResolvedValue(undefined),
  } as unknown as PrismaService;
}

describe('ActionsService', () => {
  let prisma: ReturnType<typeof mockPrisma>;
  let wss: { publishActionCreated: jest.Mock };
  let service: ActionsService;

  beforeEach(() => {
    prisma = mockPrisma();
    wss = { publishActionCreated: jest.fn() };
    service = new ActionsService(
      prisma,
      wss as unknown as WssInternalService,
    );
  });

  describe('listForUser', () => {
    it('personal mode: actor or recipient only, no workspace membership filter', async () => {
      prisma.action.findMany.mockResolvedValue([]);

      await service.listForUser({ userId: 'u1' });

      expect(prisma.workspaceMember.findMany).not.toHaveBeenCalled();
      expect(prisma.action.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { OR: [{ actorUserId: 'u1' }, { recipientUserId: 'u1' }] },
        }),
      );
    });

    it('history mode: includes broadcast and self actor/recipient', async () => {
      prisma.workspaceMember.findMany.mockResolvedValue([{ workspaceId: 'ws1' }]);
      prisma.action.findMany.mockResolvedValue([]);

      await service.listForUser({ userId: 'u1', workspaceIds: 'ws1' });

      expect(prisma.action.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { workspaceId: { in: ['ws1'] } },
              {
                OR: [
                  { recipientUserId: null },
                  { recipientUserId: 'u1' },
                  { actorUserId: 'u1' },
                ],
              },
            ],
          },
        }),
      );
    });

    it('history mode: rejects workspace user is not a member of', async () => {
      prisma.workspaceMember.findMany.mockResolvedValue([{ workspaceId: 'ws1' }]);

      await expect(
        service.listForUser({ userId: 'u1', workspaceIds: 'ws2' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.action.findMany).not.toHaveBeenCalled();
    });

    it('normalizes CSV workspaceIds into history scope', async () => {
      prisma.workspaceMember.findMany.mockResolvedValue([
        { workspaceId: 'ws1' },
        { workspaceId: 'ws2' },
      ]);
      prisma.action.findMany.mockResolvedValue([]);

      await service.listForUser({
        userId: 'u1',
        workspaceIds: 'ws1, ws2',
      });

      expect(prisma.action.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: [
              { workspaceId: { in: ['ws1', 'ws2'] } },
              expect.any(Object),
            ],
          }),
        }),
      );
    });
  });

  describe('markRead', () => {
    it('allows actor when recipient is another user (no workspace membership required)', async () => {
      prisma.action.findUnique.mockResolvedValue({
        id: 'a1',
        workspaceId: 'ws1',
        type: 'T',
        title: 't',
        meta: null,
        actorUserId: 'u1',
        recipientUserId: 'u2',
        dedupKey: null,
        createdAt: new Date(),
        reads: [],
      });
      prisma.workspaceMember.findFirst.mockResolvedValue(null);
      prisma.actionRead.upsert.mockResolvedValue({ readAt: new Date() });

      await expect(service.markRead('u1', 'a1')).resolves.toBeDefined();
      expect(prisma.workspaceMember.findFirst).not.toHaveBeenCalled();
    });

    it('allows recipient personal action without workspace membership', async () => {
      prisma.action.findUnique.mockResolvedValue({
        id: 'a1',
        workspaceId: 'ws1',
        type: 'T',
        title: 't',
        meta: null,
        actorUserId: 'u0',
        recipientUserId: 'u1',
        dedupKey: null,
        createdAt: new Date(),
        reads: [],
      });
      prisma.actionRead.upsert.mockResolvedValue({ readAt: new Date() });

      await expect(service.markRead('u1', 'a1')).resolves.toBeDefined();
      expect(prisma.workspaceMember.findFirst).not.toHaveBeenCalled();
    });

    it('broadcast: requires workspace membership when user is not actor', async () => {
      prisma.action.findUnique.mockResolvedValue({
        id: 'a1',
        workspaceId: 'ws1',
        type: 'T',
        title: 't',
        meta: null,
        actorUserId: 'u0',
        recipientUserId: null,
        dedupKey: null,
        createdAt: new Date(),
        reads: [],
      });
      prisma.workspaceMember.findFirst.mockResolvedValue(null);

      await expect(service.markRead('u1', 'a1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('forbids user who is neither recipient, actor, nor broadcast', async () => {
      prisma.action.findUnique.mockResolvedValue({
        id: 'a1',
        workspaceId: 'ws1',
        type: 'T',
        title: 't',
        meta: null,
        actorUserId: 'u0',
        recipientUserId: 'u2',
        dedupKey: null,
        createdAt: new Date(),
        reads: [],
      });

      await expect(service.markRead('u1', 'a1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('throws NotFound when action missing', async () => {
      prisma.action.findUnique.mockResolvedValue(null);

      await expect(service.markRead('u1', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
