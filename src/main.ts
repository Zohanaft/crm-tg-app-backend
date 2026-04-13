import './load-env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser());

  const corsOrigin = process.env.CORS_ORIGIN?.trim();
  if (corsOrigin) {
    app.enableCors({
      origin: corsOrigin.split(',').map((s) => s.trim()),
      credentials: true,
    });
  }

  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    // Swagger только не на проде (development, test и т.д.)
    app.use(
      (
        req: { url?: string },
        res: { setHeader: (k: string, v: string) => void },
        next: () => void,
      ) => {
        if (req.url?.startsWith('/api-doc')) {
          res.setHeader(
            'Cache-Control',
            'no-store, no-cache, must-revalidate, proxy-revalidate',
          );
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
        next();
      },
    );
    const serverUrl = process.env.API_PUBLIC_URL ?? '/api';
    const config = new DocumentBuilder()
      .setTitle('TEST API')
      .setDescription('The TEST API description')
      .setVersion('1.0')
      .addTag('crm')
      .addServer(
        serverUrl,
        serverUrl.startsWith('http') ? 'Production' : 'Current host',
      )
      .build();
    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api-doc', app, documentFactory);
  }

  const port = Number(process.env.PORT) || 3000;
  const host = process.env.HOST ?? '0.0.0.0';
  try {
    await app.listen(port, host);
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      err.code === 'EADDRINUSE'
    ) {
      console.error(
        `Port ${port} is already in use. Set PORT in .env (e.g. PORT=3001) or stop the other process.`,
      );
    }
    throw err;
  }
}
bootstrap();
