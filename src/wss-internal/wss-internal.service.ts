import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WssInternalService {
  private readonly logger = new Logger(WssInternalService.name);

  private get baseUrl(): string | undefined {
    const url = process.env['WSS_INTERNAL_URL']?.replace(/\/$/, '');
    return url || undefined;
  }

  private get sharedSecret(): string {
    return process.env['WSS_SHARED_SECRET'] ?? '';
  }

  private async post(path: string, body: unknown): Promise<void> {
    const base = this.baseUrl;
    if (!base) {
      return;
    }
    if (!this.sharedSecret) {
      this.logger.warn(
        `WSS_SHARED_SECRET is not set; skip publish ${path} (configure env to enable realtime)`,
      );
      return;
    }
    try {
      await fetch(`${base}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-wss-shared-secret': this.sharedSecret,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      this.logger.warn(`WSS publish failed: ${path} ${String(err)}`);
    }
  }

  /** Existing Telegram /start bridge */
  async publishClientStart(payload: {
    ownerId: string;
    workspaceIds: string[];
    client: {
      id: string;
      telegramId: string;
      isBot: boolean;
      firstName: string;
      lastName: string | null;
      username: string | null;
      chatId: string | null;
      chatType: string | null;
      createdAt: string | null;
      updatedAt: string | null;
    };
  }): Promise<void> {
    await this.post('/internal/events/client-start', payload);
  }

  async publishActionCreated(payload: {
    workspaceIds: string[];
    action: Record<string, unknown>;
  }): Promise<void> {
    await this.post('/internal/events/action-created', payload);
  }

  /** Personal feed: deliver action to `user:{userId}` room (e.g. invites, recipient-only rows). */
  async publishActionToUser(payload: {
    userId: string;
    action: Record<string, unknown>;
  }): Promise<void> {
    await this.post('/internal/events/user-action', payload);
  }

  async publishClientDeleted(payload: {
    workspaceIds: string[];
    clientId: string;
  }): Promise<void> {
    await this.post('/internal/events/client-deleted', payload);
  }

  async publishMemberJoined(payload: {
    workspaceId: string;
    member: {
      userId: string;
      username: string | null;
      firstName: string | null;
      lastName: string | null;
    };
    inviteId: string;
  }): Promise<void> {
    await this.post('/internal/events/workspace-member-joined', payload);
  }

  async publishMemberRemoved(payload: {
    workspaceId: string;
    removedUserId: string;
  }): Promise<void> {
    await this.post('/internal/events/workspace-member-removed', payload);
  }
}
