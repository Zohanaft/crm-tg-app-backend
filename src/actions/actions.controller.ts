import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
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
      'Без workspaceId/workspaceIds — личная лента: только записи, где вы actor или recipient, по всем вашим workspace. ' +
      'С workspaceId или непустым workspaceIds — история выбранных пространств: также общие (recipient пустой), персональные только свои; нужно быть участником каждого id. ' +
      'workspaceId эквивалентен одному элементу в workspaceIds.',
  })
  @ApiQuery({
    name: 'workspaceId',
    required: false,
    description: 'Один workspace; режим истории (как workspaceIds из одного id)',
  })
  @ApiQuery({
    name: 'workspaceIds',
    required: false,
    isArray: true,
    description:
      'Список id (повтор параметра или CSV в одном значении). Режим истории workspace.',
  })
  @ApiResponse({ status: 200 })
  list(
    @CurrentUser() user: User,
    @Query('workspaceId') workspaceId?: string,
    @Query('workspaceIds') workspaceIds?: string | string[],
  ) {
    return this.actionsService.listForUser({
      userId: user.id,
      workspaceId: workspaceId?.trim() || undefined,
      workspaceIds,
    });
  }

  @Post(':id/read')
  @ApiOperation({
    summary: 'Отметить уведомление как прочитанное',
    description: 'Фиксирует readAt для текущего пользователя.',
  })
  @ApiParam({ name: 'id', description: 'ID уведомления (действия)' })
  @ApiResponse({ status: 200 })
  markRead(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ) {
    return this.actionsService.markRead(user.id, id);
  }
}
