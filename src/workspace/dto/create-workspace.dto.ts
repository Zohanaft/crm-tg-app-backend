import { ApiProperty } from '@nestjs/swagger';

export class CreateWorkspaceDto {
  @ApiProperty({ description: 'Название рабочего пространства' })
  name!: string;
}
