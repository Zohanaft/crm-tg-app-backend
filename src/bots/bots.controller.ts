import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { User } from '../generated/prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { BotsService } from './bots.service';
import { CreateBotDto } from './dto/create-bot.dto';
import { UpdateBotDto } from './dto/update-bot.dto';

@Controller('bots')
@UseGuards(JwtAuthGuard)
export class BotsController {
  constructor(private readonly botsService: BotsService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateBotDto) {
    return this.botsService.create(user.id, dto.token);
  }

  @Get()
  findAll(
    @CurrentUser() user: User,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
  ) {
    return this.botsService.findAll(user, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      sortBy,
      sortOrder,
    });
  }

  @Get(':botId')
  findOne(@CurrentUser() user: User, @Param('botId') botId: string) {
    return this.botsService.findOne(user, botId);
  }

  @Patch(':botId')
  update(@CurrentUser() user: User, @Param('botId') botId: string, @Body() dto: UpdateBotDto) {
    return this.botsService.update(user, botId, dto);
  }

  @Delete(':botId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: User, @Param('botId') botId: string) {
    await this.botsService.remove(user, botId);
  }
}
