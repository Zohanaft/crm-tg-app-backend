import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CardWorkspace,
  FilesService,
  ProductCard,
} from '../generated/prisma/client';
import type {
  CreateProductCardDto,
  ProductCardPreviewImageDto,
} from './dto/create-product-card.dto';
import type { UpdateProductCardDto } from './dto/update-product-card.dto';

const FILE_ENTITY_NAME = 'service_card';

type ProductCardDto = {
  id: string;
  title: string;
  description: string;
  workspaceOwnerId: string;
  workspaceIds: string[];
  previewImages: ProductCardPreviewImageDto[];
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class ProductCardsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeText(value: unknown, fieldName: string): string {
    if (typeof value !== 'string') {
      throw new BadRequestException(`${fieldName} is required`);
    }
    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException(`${fieldName} is required`);
    }
    return trimmed;
  }

  private normalizeWorkspaceIds(raw: unknown): string[] {
    if (!Array.isArray(raw)) {
      throw new BadRequestException('workspaceIds must be an array');
    }
    const ids = raw
      .map((x) => (typeof x === 'string' ? x.trim() : ''))
      .filter(Boolean);
    const unique = [...new Set(ids)];
    if (!unique.length) {
      throw new BadRequestException('workspaceIds must contain at least one ID');
    }
    return unique;
  }

  private normalizePreviewImages(raw: unknown): ProductCardPreviewImageDto[] {
    if (!Array.isArray(raw)) {
      throw new BadRequestException('previewImages must be an array');
    }

    const items: ProductCardPreviewImageDto[] = [];
    for (const image of raw) {
      const row = image as {
        key?: unknown;
        url?: unknown;
        signedUrl?: unknown;
        originalName?: unknown;
      };
      const key = this.normalizeText(row?.key, 'previewImages.key');
      const urlRaw = row?.url ?? row?.signedUrl;
      const url = this.normalizeText(urlRaw, 'previewImages.url');
      const originalName = this.normalizeText(
        row?.originalName,
        'previewImages.originalName',
      );
      items.push({ key, url, originalName });
    }
    return items;
  }

  private async assertOwnerForWorkspace(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    userId: string,
  ) {
    const workspace = await tx.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, ownerId: true },
    });
    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }
    if (workspace.ownerId !== userId) {
      throw new ForbiddenException('Only workspace owner can access product cards');
    }
    return workspace;
  }

  private async assertOwnerForAllWorkspaces(
    tx: Prisma.TransactionClient,
    workspaceIds: string[],
    userId: string,
  ) {
    const rows = await tx.workspace.findMany({
      where: { id: { in: workspaceIds }, ownerId: userId },
      select: { id: true },
    });
    const allowed = new Set(rows.map((x) => x.id));
    for (const workspaceId of workspaceIds) {
      if (!allowed.has(workspaceId)) {
        throw new ForbiddenException(
          'Only workspace owner can attach this workspace',
        );
      }
    }
  }

  private mapCardToDto(
    card: ProductCard & { workspaceLinks: CardWorkspace[] },
    files: FilesService[],
  ): ProductCardDto {
    return {
      id: card.id,
      title: card.title,
      description: card.description,
      workspaceOwnerId: card.workspaceOwnerId,
      workspaceIds: card.workspaceLinks.map((x) => x.workspaceId),
      previewImages: files.map((file) => ({
        key: file.key,
        url: file.url,
        originalName: file.originalName,
      })),
      createdAt: card.createdAt.toISOString(),
      updatedAt: card.updatedAt.toISOString(),
    };
  }

  private async loadCardDto(
    tx: Prisma.TransactionClient,
    cardId: string,
  ): Promise<ProductCardDto> {
    const card = await tx.productCard.findUnique({
      where: { id: cardId },
      include: {
        workspaceLinks: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!card) {
      throw new NotFoundException('Product card not found');
    }
    const files = await tx.filesService.findMany({
      where: { entityName: FILE_ENTITY_NAME, cid: cardId },
      orderBy: { createdAt: 'asc' },
    });
    return this.mapCardToDto(card, files);
  }

  async create(userId: string, dto: CreateProductCardDto): Promise<ProductCardDto> {
    const title = this.normalizeText(dto.title, 'title');
    const description = this.normalizeText(dto.description, 'description');
    const workspaceIds = this.normalizeWorkspaceIds(dto.workspaceIds);
    const previewImages = this.normalizePreviewImages(dto.previewImages);

    return this.prisma.$transaction(async (tx) => {
      await this.assertOwnerForAllWorkspaces(tx, workspaceIds, userId);

      const card = await tx.productCard.create({
        data: {
          title,
          description,
          workspaceOwnerId: userId,
        },
      });

      await tx.cardWorkspace.createMany({
        data: workspaceIds.map((workspaceId) => ({
          cardId: card.id,
          workspaceId,
        })),
        skipDuplicates: true,
      });

      for (const image of previewImages) {
        await tx.filesService.upsert({
          where: { key: image.key },
          create: {
            key: image.key,
            url: image.url,
            cid: card.id,
            entityName: FILE_ENTITY_NAME,
            originalName: image.originalName,
          },
          update: {
            url: image.url,
            cid: card.id,
            entityName: FILE_ENTITY_NAME,
            originalName: image.originalName,
          },
        });
      }

      return this.loadCardDto(tx, card.id);
    });
  }

  async listForWorkspace(workspaceId: string, userId: string): Promise<ProductCardDto[]> {
    const normalizedWorkspaceId = this.normalizeText(workspaceId, 'workspaceId');

    return this.prisma.$transaction(async (tx) => {
      await this.assertOwnerForWorkspace(tx, normalizedWorkspaceId, userId);

      const cards = await tx.productCard.findMany({
        where: {
          workspaceOwnerId: userId,
          workspaceLinks: { some: { workspaceId: normalizedWorkspaceId } },
        },
        include: {
          workspaceLinks: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!cards.length) return [];

      const files = await tx.filesService.findMany({
        where: {
          entityName: FILE_ENTITY_NAME,
          cid: { in: cards.map((card) => card.id) },
        },
        orderBy: { createdAt: 'asc' },
      });

      const filesByCardId = new Map<string, FilesService[]>();
      for (const file of files) {
        const list = filesByCardId.get(file.cid) ?? [];
        list.push(file);
        filesByCardId.set(file.cid, list);
      }

      return cards.map((card) =>
        this.mapCardToDto(card, filesByCardId.get(card.id) ?? []),
      );
    });
  }

  async getOne(
    cardId: string,
    workspaceId: string,
    userId: string,
  ): Promise<ProductCardDto> {
    const normalizedCardId = this.normalizeText(cardId, 'cardId');
    const normalizedWorkspaceId = this.normalizeText(workspaceId, 'workspaceId');

    return this.prisma.$transaction(async (tx) => {
      await this.assertOwnerForWorkspace(tx, normalizedWorkspaceId, userId);
      const dto = await this.loadCardDto(tx, normalizedCardId);
      if (!dto.workspaceIds.includes(normalizedWorkspaceId)) {
        throw new NotFoundException('Product card not found in workspace');
      }
      if (dto.workspaceOwnerId !== userId) {
        throw new ForbiddenException('Only workspace owner can access product cards');
      }
      return dto;
    });
  }

  async update(
    cardId: string,
    userId: string,
    dto: UpdateProductCardDto,
  ): Promise<ProductCardDto> {
    const normalizedCardId = this.normalizeText(cardId, 'cardId');
    const title = this.normalizeText(dto.title, 'title');
    const description = this.normalizeText(dto.description, 'description');
    const workspaceIds = this.normalizeWorkspaceIds(dto.workspaceIds);
    const previewImages = this.normalizePreviewImages(dto.previewImages);

    return this.prisma.$transaction(async (tx) => {
      const card = await tx.productCard.findUnique({
        where: { id: normalizedCardId },
        include: { workspaceLinks: true },
      });
      if (!card) {
        throw new NotFoundException('Product card not found');
      }
      if (card.workspaceOwnerId !== userId) {
        throw new ForbiddenException('Only workspace owner can update product cards');
      }

      await this.assertOwnerForAllWorkspaces(tx, workspaceIds, userId);

      await tx.productCard.update({
        where: { id: normalizedCardId },
        data: { title, description },
      });

      const nextWorkspaceIds = new Set(workspaceIds);
      const prevWorkspaceIds = new Set(card.workspaceLinks.map((x) => x.workspaceId));

      const toDelete = [...prevWorkspaceIds].filter((id) => !nextWorkspaceIds.has(id));
      if (toDelete.length) {
        await tx.cardWorkspace.deleteMany({
          where: { cardId: normalizedCardId, workspaceId: { in: toDelete } },
        });
      }

      const toCreate = [...nextWorkspaceIds].filter((id) => !prevWorkspaceIds.has(id));
      if (toCreate.length) {
        await tx.cardWorkspace.createMany({
          data: toCreate.map((workspaceId) => ({
            cardId: normalizedCardId,
            workspaceId,
          })),
          skipDuplicates: true,
        });
      }

      const nextKeys = new Set(previewImages.map((x) => x.key));
      await tx.filesService.deleteMany({
        where: {
          entityName: FILE_ENTITY_NAME,
          cid: normalizedCardId,
          ...(nextKeys.size
            ? { key: { notIn: [...nextKeys] } }
            : {}),
        },
      });

      for (const image of previewImages) {
        await tx.filesService.upsert({
          where: { key: image.key },
          create: {
            key: image.key,
            url: image.url,
            cid: normalizedCardId,
            entityName: FILE_ENTITY_NAME,
            originalName: image.originalName,
          },
          update: {
            url: image.url,
            cid: normalizedCardId,
            entityName: FILE_ENTITY_NAME,
            originalName: image.originalName,
          },
        });
      }

      return this.loadCardDto(tx, normalizedCardId);
    });
  }

  async remove(cardId: string, workspaceId: string, userId: string): Promise<void> {
    const normalizedCardId = this.normalizeText(cardId, 'cardId');
    const normalizedWorkspaceId = this.normalizeText(workspaceId, 'workspaceId');

    await this.prisma.$transaction(async (tx) => {
      await this.assertOwnerForWorkspace(tx, normalizedWorkspaceId, userId);

      const card = await tx.productCard.findUnique({
        where: { id: normalizedCardId },
        include: { workspaceLinks: true },
      });
      if (!card) {
        throw new NotFoundException('Product card not found');
      }
      if (card.workspaceOwnerId !== userId) {
        throw new ForbiddenException('Only workspace owner can delete product cards');
      }
      if (!card.workspaceLinks.some((x) => x.workspaceId === normalizedWorkspaceId)) {
        throw new NotFoundException('Product card not found in workspace');
      }

      await tx.filesService.deleteMany({
        where: { entityName: FILE_ENTITY_NAME, cid: normalizedCardId },
      });
      await tx.productCard.delete({ where: { id: normalizedCardId } });
    });
  }
}
