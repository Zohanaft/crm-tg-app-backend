import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: 'ID пользователя в Telegram' })
  id!: number;

  @ApiPropertyOptional({ description: 'Имя пользователя' })
  first_name?: string;

  @ApiPropertyOptional({ description: 'Фамилия пользователя' })
  last_name?: string;

  @ApiPropertyOptional({ description: 'Юзернейм в Telegram (без @)' })
  username?: string;

  @ApiPropertyOptional({ description: 'URL фото профиля' })
  photo_url?: string;

  @ApiProperty({ description: 'Unix-время авторизации' })
  auth_date!: number;

  @ApiProperty({ description: 'Хэш для проверки данных от Telegram' })
  hash!: string;
}
