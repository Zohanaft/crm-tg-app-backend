/**
 * Должен импортироваться первым из main.ts, до загрузки AppModule,
 * чтобы JWT и остальной process.env успели прочитать .env.
 */
import { config } from 'dotenv';

const envPath =
  process.env.DOTENV_CONFIG_PATH ??
  (process.env.NODE_ENV === 'development' ? '.env.local' : '.env');

config({ path: envPath });

const DEFAULT_JWT_SECRET = 'change-me-in-production';

const jwtFromEnv = process.env.JWT_SECRET?.trim();

if (process.env.NODE_ENV === 'production') {
  if (!jwtFromEnv || jwtFromEnv === DEFAULT_JWT_SECRET) {
    throw new Error(
      'JWT_SECRET must be set to a strong random value when NODE_ENV=production (not the default placeholder).',
    );
  }
} else if (!jwtFromEnv) {
  // Docker может передать JWT_SECRET= (пустая строка); ?? в модулях тогда не подставляет дефолт.
  process.env.JWT_SECRET = DEFAULT_JWT_SECRET;
}

if (
  !process.env.DATABASE_URL &&
  process.env.POSTGRES_DB_USER &&
  process.env.POSTGRES_DB_PASSWORD &&
  process.env.POSTGRES_DB_NAME
) {
  const host = process.env.POSTGRES_HOST ?? 'localhost';
  const port = process.env.POSTGRES_PORT ?? '5432';
  const user = encodeURIComponent(process.env.POSTGRES_DB_USER);
  const password = encodeURIComponent(process.env.POSTGRES_DB_PASSWORD);
  const dbName = encodeURIComponent(process.env.POSTGRES_DB_NAME);
  process.env.DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${dbName}`;
}
