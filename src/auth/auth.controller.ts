import { Body, Controller, Post, Res, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import type { TelegramAuthPayload } from './auth.service';
import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Body() body: TelegramAuthPayload,
    @Res({ passthrough: false }) res: Response,
  ) {
    const botToken = process.env.TG_AUTH_BOT_TOKEN;
    if (!botToken) {
      throw new UnauthorizedException('Telegram bot token not configured');
    }
    const { user, accessToken, refreshToken } =
      await this.authService.loginWithTelegram(body, botToken);

    const accessMaxAge = 15 * 60; // 15 min in seconds
    const refreshMaxAge = 7 * 24 * 60 * 60; // 7 days in seconds

    res.setHeader('Set-Cookie', [
      `access_token=${accessToken}; Max-Age=${accessMaxAge}; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
      `refresh_token=${refreshToken}; Max-Age=${refreshMaxAge}; Path=/; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
    ]);

    res.json({
      ok: true,
      user: {
        id: user.id,
        telegramId: String(user.telegramId),
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        photoUrl: user.photoUrl,
      },
    });
  }
}
