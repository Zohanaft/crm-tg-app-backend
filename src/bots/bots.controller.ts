import {
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
  Req,
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
import type { Request } from 'express';
import type { User } from '../generated/prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { BotsService } from './bots.service';
import { CreateBotDto } from './dto/create-bot.dto';
import { UpdateBotDto } from './dto/update-bot.dto';

function parseCfVisitorScheme(
  header: string | string[] | undefined,
): string | undefined {
  if (!header || Array.isArray(header)) return undefined;
  try {
    const parsed = JSON.parse(header) as { scheme?: string };
    return typeof parsed.scheme === 'string'
      ? parsed.scheme.toLowerCase()
      : undefined;
  } catch {
    return undefined;
  }
}

/** Public hostname (e.g. zohanafttcrm.com), not localhost / docker service name without dots */
function looksLikePublicHostname(hostname: string): boolean {
  const h = hostname.split(':')[0].toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return false;
  if (h.endsWith('.local')) return false;
  return h.includes('.');
}

function inferWebhookBaseUrl(req: Request): string | undefined {
  const forwardedProtoRaw = req.headers['x-forwarded-proto'];
  const forwardedHostRaw = req.headers['x-forwarded-host'];
  const hostRaw = req.headers.host;

  let proto =
    parseCfVisitorScheme(req.headers['cf-visitor']) ??
    (Array.isArray(forwardedProtoRaw)
      ? forwardedProtoRaw[0]
      : forwardedProtoRaw?.split(',')[0]?.trim());

  const host = Array.isArray(forwardedHostRaw)
    ? forwardedHostRaw[0]
    : forwardedHostRaw?.split(',')[0]?.trim() || hostRaw;

  if (!host) {
    return undefined;
  }

  const hostOnly = host.split(':')[0];
  // TLS terminator (nginx/Cloudflare): inner hop may be http:// but public URL must be https
  if (proto === 'http' && looksLikePublicHostname(hostOnly)) {
    proto = 'https';
  }
  if (!proto) {
    proto = looksLikePublicHostname(hostOnly) ? 'https' : 'http';
  }

  return `${proto}://${host}`;
}

@ApiTags('Боты')
@Controller('bots')
@UseGuards(JwtAuthGuard)
export class BotsController {
  constructor(private readonly botsService: BotsService) {}

  @Post()
  @ApiOperation({
    summary: 'Подключить бота',
    description:
      'Добавить Telegram-бота по токену из @BotFather. Требуется авторизация.',
  })
  @ApiBody({
    type: CreateBotDto,
    description: 'Токен бота (привязка к текущему пользователю)',
  })
  @ApiResponse({ status: 201, description: 'Бот успешно подключён' })
  @ApiResponse({
    status: 400,
    description: 'Неверный токен или бот уже подключён',
  })
  @ApiResponse({ status: 401, description: 'Требуется авторизация' })
  create(
    @CurrentUser() user: User,
    @Body() dto: CreateBotDto,
    @Req() req: Request,
  ) {
    const webhookBaseUrl = inferWebhookBaseUrl(req);
    return this.botsService.create(user.id, dto.token, webhookBaseUrl);
  }

  @Get()
  @ApiOperation({
    summary: 'Список ботов',
    description: 'Возвращает список ботов текущего пользователя с пагинацией.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Номер страницы (по умолчанию: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Количество на странице (по умолчанию: 20, макс: 100)',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: 'Поле сортировки (например: createdAt)',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Направление сортировки',
  })
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
    description:
      'Изменить отображаемое имя или юзернейм бота. Только владелец может обновлять.',
  })
  @ApiParam({ name: 'botId', description: 'Идентификатор бота' })
  @ApiBody({ type: UpdateBotDto, description: 'Поля для обновления' })
  @ApiResponse({ status: 200, description: 'Бот обновлён' })
  @ApiResponse({ status: 401, description: 'Требуется авторизация' })
  @ApiResponse({ status: 404, description: 'Бот не найден' })
  update(
    @CurrentUser() user: User,
    @Param('botId') botId: string,
    @Body() dto: UpdateBotDto,
  ) {
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
