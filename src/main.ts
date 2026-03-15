import { config } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder, SwaggerCustomOptions } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

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

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());

  // Prevent caching of Swagger UI and OpenAPI spec (fixes stale doc on production/Cloudflare)
  app.use((req: { url?: string }, res: { setHeader: (k: string, v: string) => void }, next: () => void) => {
    if (req.url?.startsWith('/api-doc')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });

  const serverUrl = process.env.API_PUBLIC_URL ?? '/api';
  const config = new DocumentBuilder()
    .setTitle('TEST API')
    .setDescription('The TEST API description')
    .setVersion('1.0')
    .addTag('crm')
    .addServer(serverUrl, serverUrl.startsWith('http') ? 'Production' : 'Current host')
    .build();
  
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-doc', app, documentFactory);
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
