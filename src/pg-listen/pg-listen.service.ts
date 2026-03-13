import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Client } from 'pg';
import { PrismaService } from '../prisma/prisma.service';

function getConnectionString(): string {
  const url = process.env['DATABASE_URL'];
  if (url) return url;
  const user = process.env['POSTGRES_DB_USER'];
  const password = process.env['POSTGRES_DB_PASSWORD'];
  const dbName = process.env['POSTGRES_DB_NAME'];
  const port = process.env['POSTGRES_PORT'] ?? '5432';
  const host = process.env['POSTGRES_HOST'] ?? 'localhost';
  if (user && password && dbName) {
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(dbName)}`;
  }
  return 'postgresql://postgres:postgres@localhost:5432/app';
}

export const PLAN_EXPIRED_CHANNEL = 'plan_expired';

export interface PlanExpiredPayload {
  user_id: string;
}

@Injectable()
export class PgListenService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PgListenService.name);
  private client: Client | null = null;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    this.client = new Client({ connectionString: getConnectionString() });
    await this.client.connect();
    await this.client.query(`LISTEN ${PLAN_EXPIRED_CHANNEL}`);
    this.client.on('notification', (msg) => {
      if (msg.channel !== PLAN_EXPIRED_CHANNEL) return;
      try {
        const data = JSON.parse(msg.payload ?? '{}') as PlanExpiredPayload;
        this.eventEmitter.emit(PLAN_EXPIRED_CHANNEL, data);
      } catch (err) {
        this.logger.warn('Failed to parse plan_expired payload', err);
      }
    });
    this.logger.log(`LISTEN ${PLAN_EXPIRED_CHANNEL} active`);
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.end();
      this.client = null;
      this.logger.log(`LISTEN ${PLAN_EXPIRED_CHANNEL} stopped`);
    }
  }
}
