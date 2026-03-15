import { ApiProperty } from '@nestjs/swagger';

export class CreateBotDto {
  @ApiProperty({ description: 'Токен бота Telegram от @BotFather' })
  token!: string;
}
