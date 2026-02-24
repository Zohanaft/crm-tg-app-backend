import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  /** Проверка подключения к PostgreSQL */
  async checkDatabase(): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1 as ok`;
      return { ok: true, message: 'PostgreSQL connection OK' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, message: `PostgreSQL error: ${message}` };
    }
  }
}
