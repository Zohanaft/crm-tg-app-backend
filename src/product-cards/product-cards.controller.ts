import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { User } from '../generated/prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateProductCardDto } from './dto/create-product-card.dto';
import { UpdateProductCardDto } from './dto/update-product-card.dto';
import { ProductCardsService } from './product-cards.service';

@ApiTags('Карточки товаров и услуг')
@Controller('product-cards')
@UseGuards(JwtAuthGuard)
export class ProductCardsController {
  constructor(private readonly productCardsService: ProductCardsService) {}

  @Post()
  @ApiOperation({ summary: 'Создать карточку товара/услуги' })
  @ApiBody({ type: CreateProductCardDto })
  @ApiResponse({ status: 201, description: 'Карточка создана' })
  create(@CurrentUser() user: User, @Body() dto: CreateProductCardDto) {
    return this.productCardsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Список карточек для workspace' })
  @ApiQuery({
    name: 'workspaceId',
    required: true,
    description: 'ID рабочего пространства',
  })
  @ApiResponse({ status: 200, description: 'Список карточек' })
  async listForWorkspace(
    @CurrentUser() user: User,
    @Query('workspaceId') workspaceId: string,
  ) {
    if (!workspaceId?.trim()) {
      throw new BadRequestException('workspaceId is required');
    }
    return this.productCardsService.listForWorkspace(workspaceId, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Получить карточку по ID' })
  @ApiParam({ name: 'id', description: 'ID карточки' })
  @ApiQuery({
    name: 'workspaceId',
    required: true,
    description: 'ID рабочего пространства',
  })
  @ApiResponse({ status: 200, description: 'Карточка' })
  async getOne(
    @CurrentUser() user: User,
    @Param('id') cardId: string,
    @Query('workspaceId') workspaceId: string,
  ) {
    if (!workspaceId?.trim()) {
      throw new BadRequestException('workspaceId is required');
    }
    return this.productCardsService.getOne(cardId, workspaceId, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновить карточку' })
  @ApiParam({ name: 'id', description: 'ID карточки' })
  @ApiBody({ type: UpdateProductCardDto })
  @ApiResponse({ status: 200, description: 'Карточка обновлена' })
  update(
    @CurrentUser() user: User,
    @Param('id') cardId: string,
    @Body() dto: UpdateProductCardDto,
  ) {
    return this.productCardsService.update(cardId, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Удалить карточку' })
  @ApiParam({ name: 'id', description: 'ID карточки' })
  @ApiQuery({
    name: 'workspaceId',
    required: true,
    description: 'ID рабочего пространства',
  })
  @ApiResponse({ status: 204, description: 'Карточка удалена' })
  async remove(
    @CurrentUser() user: User,
    @Param('id') cardId: string,
    @Query('workspaceId') workspaceId: string,
  ) {
    if (!workspaceId?.trim()) {
      throw new BadRequestException('workspaceId is required');
    }
    await this.productCardsService.remove(cardId, workspaceId, user.id);
  }
}
