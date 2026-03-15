import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBotDto {
  @ApiPropertyOptional({ description: 'Отображаемое имя бота' })
  firstName?: string;

  @ApiPropertyOptional({ description: 'Юзернейм бота (без @)' })
  username?: string;
}
