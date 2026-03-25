import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Служебные')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({
    summary: 'Проверка состояния',
    description:
      'Проверка работы приложения и подключения к PostgreSQL. Используется для healthcheck.',
  })
  @ApiResponse({
    status: 200,
    description:
      'Приложение работает, в теле возвращается статус БД (ok/error)',
  })
  async health() {
    const database = await this.appService.checkDatabase();
    return {
      status: database.ok ? 'ok' : 'error',
      database: database.ok ? 'connected' : database.message + 'connected',
    };
  }
}
