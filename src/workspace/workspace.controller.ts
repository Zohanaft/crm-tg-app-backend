import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { User } from '../generated/prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { WorkspaceService } from './workspace.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

@ApiTags('Рабочие пространства')
@Controller('workspace')
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Мои рабочие пространства',
    description: 'Список workspace текущего пользователя (как владельца).',
  })
  @ApiResponse({ status: 200, description: 'Массив рабочих пространств' })
  @ApiResponse({ status: 401, description: 'Требуется авторизация' })
  findMine(@CurrentUser() user: User) {
    return this.workspaceService.findAllByOwnerId(user.id);
  }

  @Get(':ownerId')
  @ApiOperation({
    summary: 'Список пространств по владельцу',
    description: 'Возвращает все рабочие пространства пользователя. Запросить можно только свой список (ownerId должен совпадать с текущим пользователем).',
  })
  @ApiParam({ name: 'ownerId', description: 'ID владельца (должен совпадать с текущим пользователем)' })
  @ApiResponse({ status: 200, description: 'Массив рабочих пространств' })
  @ApiResponse({ status: 401, description: 'Требуется авторизация' })
  @ApiResponse({ status: 403, description: 'Доступ запрещён (не свой ownerId)' })
  findAllByOwner(@CurrentUser() user: User, @Param('ownerId') ownerId: string) {
    if (user.id !== ownerId) {
      throw new ForbiddenException('Access denied');
    }
    return this.workspaceService.findAllByOwnerId(ownerId);
  }

  @Post()
  @ApiOperation({
    summary: 'Создать рабочее пространство',
    description: 'Создать новое рабочее пространство. Количество ограничено планом (free: 3, premium: 5, prime: 10).',
  })
  @ApiBody({ type: CreateWorkspaceDto, description: 'Название пространства' })
  @ApiResponse({ status: 201, description: 'Рабочее пространство создано' })
  @ApiResponse({ status: 400, description: 'Достигнут лимит пространств по плану' })
  @ApiResponse({ status: 401, description: 'Требуется авторизация' })
  create(@CurrentUser() user: User, @Body() dto: CreateWorkspaceDto) {
    return this.workspaceService.create(user.id, dto.name);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Обновить рабочее пространство',
    description: 'Изменить название. Только владелец может обновлять.',
  })
  @ApiParam({ name: 'id', description: 'ID рабочего пространства' })
  @ApiBody({ type: UpdateWorkspaceDto, description: 'Новое название (опционально)' })
  @ApiResponse({ status: 200, description: 'Рабочее пространство обновлено' })
  @ApiResponse({ status: 401, description: 'Требуется авторизация' })
  @ApiResponse({ status: 403, description: 'Только владелец может обновлять' })
  @ApiResponse({ status: 404, description: 'Рабочее пространство не найдено' })
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateWorkspaceDto) {
    if (dto.name !== undefined) {
      return this.workspaceService.update(id, user.id, dto.name);
    }
    return this.workspaceService.update(id, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Удалить рабочее пространство',
    description: 'Удалить рабочее пространство. Только владелец может удалять.',
  })
  @ApiParam({ name: 'id', description: 'ID рабочего пространства' })
  @ApiResponse({ status: 204, description: 'Рабочее пространство удалено' })
  @ApiResponse({ status: 401, description: 'Требуется авторизация' })
  @ApiResponse({ status: 403, description: 'Только владелец может удалять' })
  @ApiResponse({ status: 404, description: 'Рабочее пространство не найдено' })
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    await this.workspaceService.remove(id, user.id);
  }
}
