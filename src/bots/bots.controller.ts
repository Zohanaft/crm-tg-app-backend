import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { User } from '../generated/prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { BotsService } from './bots.service';
import { CreateBotDto } from './dto/create-bot.dto';
import { UpdateBotDto } from './dto/update-bot.dto';

@ApiTags('Боты')
@Controller('bots')
@UseGuards(JwtAuthGuard)
export class BotsController {
  constructor(private readonly botsService: BotsService) {}

  @Post()
  @ApiOperation({
    summary: 'Подключить бота',
    description: 'Добавить Telegram-бота по токену из @BotFather. Требуется авторизация.',
  })
  @ApiBody({ type: CreateBotDto, description: 'Токен бота' })
  @ApiResponse({ status: 201, description: 'Бот успешно подключён' })
  @ApiResponse({ status: 400, description: 'Неверный токен или бот уже подключён' })
  @ApiResponse({ status: 401, description: 'Требуется авторизация' })
  create(@CurrentUser() user: User, @Body() dto: CreateBotDto) {
    return this.botsService.create(user.id, dto.token);
  }

  @Get()
  @ApiOperation({
    summary: 'Список ботов',
    description: 'Возвращает список ботов текущего пользователя с пагинацией.',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Номер страницы (по умолчанию: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Количество на странице (по умолчанию: 20, макс: 100)' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Поле сортировки (например: createdAt)' })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'], description: 'Направление сортировки' })
  @ApiResponse({ status: 200, description: 'Список ботов и общее количество' })
  @ApiResponse({ status: 401, description: 'Требуется авторизация' })
  findAll(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.botsService.findAll(user, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      sortBy,
      sortOrder,
    });
  }

  @Get(':botId')
  @ApiOperation({
    summary: 'Получить бота по ID',
    description: 'Возвращает данные одного бота по его идентификатору.',
  })
  @ApiParam({ name: 'botId', description: 'Идентификатор бота (числовой)' })
  @ApiResponse({ status: 200, description: 'Данные бота' })
  @ApiResponse({ status: 401, description: 'Требуется авторизация' })
  @ApiResponse({ status: 404, description: 'Бот не найден' })
  findOne(@CurrentUser() user: User, @Param('botId') botId: string) {
    return this.botsService.findOne(user, botId);
  }

  @Patch(':botId')
  @ApiOperation({
    summary: 'Обновить бота',
    description: 'Изменить отображаемое имя или юзернейм бота. Только владелец может обновлять.',
  })
  @ApiParam({ name: 'botId', description: 'Идентификатор бота' })
  @ApiBody({ type: UpdateBotDto, description: 'Поля для обновления' })
  @ApiResponse({ status: 200, description: 'Бот обновлён' })
  @ApiResponse({ status: 401, description: 'Требуется авторизация' })
  @ApiResponse({ status: 404, description: 'Бот не найден' })
  update(@CurrentUser() user: User, @Param('botId') botId: string, @Body() dto: UpdateBotDto) {
    return this.botsService.update(user, botId, dto);
  }

  @Delete(':botId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Удалить бота',
    description: 'Отключить бота. Только владелец может удалять.',
  })
  @ApiParam({ name: 'botId', description: 'Идентификатор бота' })
  @ApiResponse({ status: 204, description: 'Бот удалён' })
  @ApiResponse({ status: 401, description: 'Требуется авторизация' })
  @ApiResponse({ status: 404, description: 'Бот не найден' })
  async remove(@CurrentUser() user: User, @Param('botId') botId: string) {
    await this.botsService.remove(user, botId);
  }
}
