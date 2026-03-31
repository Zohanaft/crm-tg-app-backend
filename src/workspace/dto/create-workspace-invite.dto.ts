import { ApiProperty } from '@nestjs/swagger';

export class CreateWorkspaceInviteDto {
  @ApiProperty({ description: 'ID пользователя, которого приглашают' })
  invitedUserId!: string;
}
