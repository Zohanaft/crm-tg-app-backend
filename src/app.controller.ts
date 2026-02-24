import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /** Проверка работы приложения и подключения к PostgreSQL */
  @Get('health')
  async health() {
    const database = await this.appService.checkDatabase();
    return {
      status: database.ok ? 'ok' : 'error',
      database: database.ok ? 'connected' : database.message + 'connected',
    };
  }
}
