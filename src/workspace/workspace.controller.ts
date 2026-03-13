import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import type { User } from '../generated/prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { WorkspaceService } from './workspace.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

@Controller('workspace')
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get(':ownerId')
  findAllByOwner(@CurrentUser() user: User, @Param('ownerId') ownerId: string) {
    if (user.id !== ownerId) {
      throw new ForbiddenException('Access denied');
    }
    return this.workspaceService.findAllByOwnerId(ownerId);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateWorkspaceDto) {
    return this.workspaceService.create(user.id, dto.name);
  }

  @Patch(':id')
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateWorkspaceDto) {
    if (dto.name !== undefined) {
      return this.workspaceService.update(id, user.id, dto.name);
    }
    return this.workspaceService.update(id, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: User, @Param('id') id: string) {
    await this.workspaceService.remove(id, user.id);
  }
}
