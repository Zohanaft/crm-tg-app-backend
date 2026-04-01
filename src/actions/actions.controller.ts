import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { User } from '../generated/prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ActionsService } from './actions.service';

@ApiTags('Уведомления')
@Controller('actions')
@UseGuards(JwtAuthGuard)
export class ActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  @Get()
  @ApiOperation({
    summary: 'Лента действий / уведомлений',
    description:
      'Без workspaceId — последние события по всем доступным workspace. С workspaceId — только для этого пространства (нужно быть участником).',
  })
  @ApiQuery({ name: 'workspaceId', required: false })
  @ApiResponse({ status: 200 })
  list(
    @CurrentUser() user: User,
    @Query('workspaceId') workspaceId?: string,
  ) {
    return this.actionsService.listForUser({
      userId: user.id,
      workspaceId: workspaceId?.trim() || undefined,
    });
  }

  @Post(':id/read')
  @ApiOperation({
    summary: 'Отметить уведомление как прочитанное',
    description: 'Фиксирует readAt для текущего пользователя.',
  })
  @ApiResponse({ status: 200 })
  markRead(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ) {
    return this.actionsService.markRead(user.id, id);
  }
}
