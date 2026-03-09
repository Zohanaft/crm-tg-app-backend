import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BotsModule } from './bots/bots.module';
import { ChatsModule } from './chats/chats.module';
import { ClientsModule } from './clients/clients.module';
import { DealsModule } from './deals/deals.module';
import { MessagesModule } from './messages/messages.module';
import { PrismaModule } from './prisma/prisma.module';
import { TelegramModule } from './telegram/telegram.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    BotsModule,
    ClientsModule,
    ChatsModule,
    MessagesModule,
    DealsModule,
    TelegramModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
