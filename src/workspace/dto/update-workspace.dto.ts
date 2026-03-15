import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWorkspaceDto {
  @ApiPropertyOptional({ description: 'Новое название рабочего пространства' })
  name?: string;
}
