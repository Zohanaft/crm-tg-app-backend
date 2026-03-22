import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Публичный endpoint для Telegram setWebhook.
 * URL: {TELEGRAM_WEBHOOK_BASE_URL}/telegram/webhook/{webhookSecret}
 */
@Controller('telegram/webhook')
export class TelegramWebhookController {
  constructor(private readonly prisma: PrismaService) {}

  @Post(':secret')
  @HttpCode(HttpStatus.OK)
  async handle(@Param('secret') secret: string, @Body() _body: unknown) {
    const bot = await this.prisma.tgBot.findFirst({
      where: { webhookSecret: secret },
      select: { id: true },
    });
    if (bot) {
      // TODO: обработка update (messages, callback_query и т.д.)
    }
    return { ok: true };
  }
}
