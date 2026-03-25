import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

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

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const adapter = new PrismaPg({ connectionString: getConnectionString() });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
