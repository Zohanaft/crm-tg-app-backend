import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TelegramWebhookService } from './telegram-webhook.service';

/**
 * Публичный endpoint для Telegram setWebhook.
 * URL: {TELEGRAM_WEBHOOK_BASE_URL}/telegram/webhook/{webhookSecret}
 */
@ApiTags('Telegram')
@Controller('telegram/webhook')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class TelegramWebhookController {
  constructor(
    private readonly telegramWebhookService: TelegramWebhookService,
  ) {}

  @Post(':secret')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Входящий webhook Telegram',
    description:
      'Публичный URL для setWebhook. Секрет в пути должен совпадать с сохранённым у бота.',
  })
  @ApiParam({
    name: 'secret',
    description: 'Секрет webhook (совпадает с настройкой бота)',
  })
  @ApiBody({
    description: 'Тело update от Telegram Bot API (JSON)',
    schema: { type: 'object' },
  })
  @ApiResponse({
    status: 200,
    description: 'Update обработан (ответ по логике сервиса)',
  })
  async handle(@Param('secret') secret: string, @Body() body: unknown) {
    return this.telegramWebhookService.handle(
      secret,
      body as Parameters<TelegramWebhookService['handle']>[1],
    );
  }
}
