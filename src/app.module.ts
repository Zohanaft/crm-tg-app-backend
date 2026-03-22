import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    CacheModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    BotsModule,
    WorkspaceModule,
    PgListenModule,
    ClientsModule,
    ChatsModule,
    MessagesModule,
    DealsModule,
    TelegramModule,
    TelegramWebhookModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
