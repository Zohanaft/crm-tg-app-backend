import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { User } from '../generated/prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ClientsService } from './clients.service';

@ApiTags('Клиенты')
@Controller('clients')
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @ApiOperation({
    summary: 'Список клиентов для workspace',
    description:
      'Возвращает клиентов, которые относятся к владельцу workspace текущего пользователя.',
  })
  @ApiResponse({ status: 200, description: 'Список клиентов' })
  @ApiResponse({ status: 401, description: 'Требуется авторизация' })
  async listForWorkspace(
    @Query('workspaceId') workspaceId: string,
    @CurrentUser() user: User,
  ) {
    if (!workspaceId) {
      throw new BadRequestException('workspaceId is required');
    }
    return this.clientsService.listForWorkspace(workspaceId, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Удалить клиента из workspace',
    description:
      'Удаляет связь клиента с владельцем выбранного workspace. Если у клиента больше нет владельцев, удаляет клиента полностью.',
  })
  @ApiResponse({ status: 204, description: 'Клиент удалён' })
  @ApiResponse({ status: 401, description: 'Требуется авторизация' })
  @ApiResponse({ status: 404, description: 'Клиент или workspace не найден' })
  async removeForWorkspace(
    @Param('id') clientId: string,
    @Query('workspaceId') workspaceId: string,
    @CurrentUser() user: User,
  ) {
    if (!workspaceId) {
      throw new BadRequestException('workspaceId is required');
    }
    await this.clientsService.removeForWorkspace(workspaceId, user.id, clientId);
  }
}
