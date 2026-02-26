import * as crypto from 'node:crypto';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

const AUTH_DATE_MAX_AGE_SEC = 86400; // 24 hours

export interface TelegramAuthPayload {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export interface TokenPayload {
  sub: string;
  telegramId: string;
  type: 'access' | 'refresh';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  verifyTelegramHash(payload: TelegramAuthPayload, botToken: string): boolean {
    if (!payload.hash || !botToken) return false;
    const { hash, ...rest } = payload;
    const dataCheckString = Object.keys(rest)
      .sort()
      .map((k) => `${k}=${(rest as Record<string, unknown>)[k]}`)
      .join('\n');
    const secretKey = crypto.createHash('sha256').update(botToken).digest();
    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');
    if (expectedHash !== hash) return false;
    if (Math.floor(Date.now() / 1000) - payload.auth_date > AUTH_DATE_MAX_AGE_SEC) {
      return false;
    }
    return true;
  }

  async findOrCreateUser(payload: TelegramAuthPayload) {
    const telegramId = BigInt(payload.id);
    let user = await this.prisma.user.findUnique({ where: { telegramId } });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          telegramId,
          firstName: payload.first_name ?? null,
          lastName: payload.last_name ?? null,
          username: payload.username ?? null,
          photoUrl: payload.photo_url ?? null,
          authDate: payload.auth_date ?? null,
        },
      });
    } else {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          firstName: payload.first_name ?? user.firstName,
          lastName: payload.last_name ?? user.lastName,
          username: payload.username ?? user.username,
          photoUrl: payload.photo_url ?? user.photoUrl,
          authDate: payload.auth_date ?? user.authDate,
        },
      });
    }
    return user;
  }

  async loginWithTelegram(payload: TelegramAuthPayload, botToken: string) {
    if (!this.verifyTelegramHash(payload, botToken)) {
      throw new UnauthorizedException('Invalid Telegram auth data');
    }
    const user = await this.findOrCreateUser(payload);
    const accessExpiresSec = Number(process.env.JWT_ACCESS_EXPIRES) || 15 * 60;
    const refreshExpiresSec = Number(process.env.JWT_REFRESH_EXPIRES) || 7 * 24 * 60 * 60;
    const accessToken = this.jwtService.sign(
      { sub: user.id, telegramId: String(user.telegramId), type: 'access' },
      { expiresIn: accessExpiresSec },
    );
    const refreshToken = this.jwtService.sign(
      { sub: user.id, telegramId: String(user.telegramId), type: 'refresh' },
      { expiresIn: refreshExpiresSec },
    );
    return { user, accessToken, refreshToken };
  }

  refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token required');
    }
    try {
      const payload = this.jwtService.verify<TokenPayload>(refreshToken);
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }
      const accessExpiresSec = Number(process.env.JWT_ACCESS_EXPIRES) || 15 * 60;
      const refreshExpiresSec = Number(process.env.JWT_REFRESH_EXPIRES) || 7 * 24 * 60 * 60;
      const accessToken = this.jwtService.sign(
        { sub: payload.sub, telegramId: payload.telegramId, type: 'access' },
        { expiresIn: accessExpiresSec },
      );
      const newRefreshToken = this.jwtService.sign(
        { sub: payload.sub, telegramId: payload.telegramId, type: 'refresh' },
        { expiresIn: refreshExpiresSec },
      );
      return { accessToken, refreshToken: newRefreshToken };
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'TokenExpiredError') {
        throw new BadRequestException('Сессия истекла');
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
