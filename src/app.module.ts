import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BotsModule } from './bots/bots.module';
import { CacheModule } from './cache/cache.module';
import { ChatsModule } from './chats/chats.module';
import { ClientsModule } from './clients/clients.module';
import { DealsModule } from './deals/deals.module';
import { MessagesModule } from './messages/messages.module';
import { PgListenModule } from './pg-listen/pg-listen.module';
import { PrismaModule } from './prisma/prisma.module';
import { TelegramModule } from './telegram/telegram.module';
import { TelegramWebhookModule } from './telegram-webhook/telegram-webhook.module';
import { UsersModule } from './users/users.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { WssInternalModule } from './wss-internal/wss-internal.module';
import { ActionsModule } from './actions/actions.module';
import { ProductCardsModule } from './product-cards/product-cards.module';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 300 }],
    }),
    EventEmitterModule.forRoot(),
    CacheModule,
    PrismaModule,
    WssInternalModule,
    AuthModule,
    UsersModule,
    BotsModule,
    WorkspaceModule,
    ActionsModule,
    PgListenModule,
    ClientsModule,
    ChatsModule,
    MessagesModule,
    DealsModule,
    ProductCardsModule,
    TelegramModule,
    TelegramWebhookModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
