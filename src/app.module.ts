import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClientsModule } from './clients/clients.module';
import { ChatsModule } from './chats/chats.module';
import { MessagesModule } from './messages/messages.module';
import { DealsModule } from './deals/deals.module';
import { TelegramModule } from './telegram/telegram.module';

@Module({
  imports: [AuthModule, UsersModule, ClientsModule, ChatsModule, MessagesModule, DealsModule, TelegramModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
