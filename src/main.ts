import { config } from 'dotenv';

const envPath = process.env.DOTENV_CONFIG_PATH
  ?? (process.env.NODE_ENV === 'development' ? '.env.local' : '.env');
config({ path: envPath });

// Ensure DATABASE_URL is set for Prisma (from POSTGRES_* if needed)
if (!process.env.DATABASE_URL && process.env.POSTGRES_DB_USER && process.env.POSTGRES_DB_PASSWORD && process.env.POSTGRES_DB_NAME) {
  const host = process.env.POSTGRES_HOST ?? 'localhost';
  const port = process.env.POSTGRES_PORT ?? '5432';
  const user = encodeURIComponent(process.env.POSTGRES_DB_USER);
  const password = encodeURIComponent(process.env.POSTGRES_DB_PASSWORD);
  const dbName = encodeURIComponent(process.env.POSTGRES_DB_NAME);
  process.env.DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${dbName}`;
}

import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST ?? '0.0.0.0';
  try {
    await app.listen(port, host);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Set PORT in .env (e.g. PORT=3001) or stop the other process.`);
    }
    throw err;
  }
}
bootstrap();
