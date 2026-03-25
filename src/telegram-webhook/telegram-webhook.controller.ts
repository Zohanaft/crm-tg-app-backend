import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { TelegramWebhookService } from './telegram-webhook.service';

/**
 * Публичный endpoint для Telegram setWebhook.
 * URL: {TELEGRAM_WEBHOOK_BASE_URL}/telegram/webhook/{webhookSecret}
 */
@Controller('telegram/webhook')
export class TelegramWebhookController {
  constructor(
    private readonly telegramWebhookService: TelegramWebhookService,
  ) {}

  @Post(':secret')
  @HttpCode(HttpStatus.OK)
  async handle(@Param('secret') secret: string, @Body() body: unknown) {
    return this.telegramWebhookService.handle(
      secret,
      body as Parameters<TelegramWebhookService['handle']>[1],
    );
  }
}
