import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { User } from '../generated/prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UsersService } from './users.service';

@ApiTags('Пользователи')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('search')
  @ApiOperation({
    summary: 'Поиск пользователей для приглашения в workspace',
    description:
      'Возвращает пользователей, которые ещё не в workspace и без активного приглашения. Только для участников workspace.',
  })
  @ApiQuery({ name: 'q', required: true })
  @ApiQuery({ name: 'workspaceId', required: true })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403 })
  search(
    @CurrentUser() user: User,
    @Query('q') q: string,
    @Query('workspaceId') workspaceId: string,
  ) {
    return this.usersService.searchForWorkspaceInvite({
      workspaceId,
      q: q ?? '',
      currentUserId: user.id,
    });
  }
}
