import { Module } from '@nestjs/common';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ClientsModule } from '../clients/clients.module';
import { ActionsModule } from '../actions/actions.module';
import { TelegramWebhookService } from './telegram-webhook.service';

@Module({
  imports: [PrismaModule, ClientsModule, ActionsModule],
  controllers: [TelegramWebhookController],
  providers: [TelegramWebhookService],
})
export class TelegramWebhookModule {}
