import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client: Redis | null = null;

  async onModuleInit() {
    const url = process.env['VALKEY_URL'] ?? process.env['REDIS_URL'];
    if (!url) {
      this.logger.warn('VALKEY_URL (or REDIS_URL) not set, cache disabled');
      return;
    }
    try {
      this.client = new Redis(url, { maxRetriesPerRequest: 2 });
      this.client.on('error', (err) => this.logger.warn('Valkey error', err));
      await this.client.ping();
      this.logger.log('Valkey connected');
    } catch (err) {
      this.logger.warn('Valkey connection failed, cache disabled', err);
      this.client = null;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    try {
      return await this.client.get(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlSec?: number): Promise<void> {
    if (!this.client) return;
    try {
      if (ttlSec != null) {
        await this.client.setex(key, ttlSec, value);
      } else {
        await this.client.set(key, value);
      }
    } catch {
      // ignore
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.del(key);
    } catch {
      // ignore
    }
  }
}
