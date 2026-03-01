import { Body, Controller, Get, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { TelegramAuthPayload } from './auth.service';
import { AuthService } from './auth.service';

const accessMaxAge = 15 * 60;
const refreshMaxAge = 7 * 24 * 60 * 60;
const secureSuffix = process.env.NODE_ENV === 'production' ? '; Secure' : '';

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

    res.setHeader('Set-Cookie', [
      `access_token=${accessToken}; Max-Age=${accessMaxAge}; Path=/; HttpOnly; SameSite=Lax${secureSuffix}`,
      `refresh_token=${refreshToken}; Max-Age=${refreshMaxAge}; Path=/; HttpOnly; SameSite=Lax${secureSuffix}`,
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

  @Get('profile')
  async profile(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    const accessToken = req.cookies?.access_token;
    const user = await this.authService.getProfileFromAccessToken(accessToken);
    res.json({
      id: user.id,
      telegramId: String(user.telegramId),
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      photoUrl: user.photoUrl,
    });
  }

  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: false }) res: Response) {
    const refreshToken = req.cookies?.refresh_token;
    const { accessToken, refreshToken: newRefreshToken } =
      this.authService.refresh(refreshToken);

    res.setHeader('Set-Cookie', [
      `access_token=${accessToken}; Max-Age=${accessMaxAge}; Path=/; HttpOnly; SameSite=Lax${secureSuffix}`,
      `refresh_token=${newRefreshToken}; Max-Age=${refreshMaxAge}; Path=/; HttpOnly; SameSite=Lax${secureSuffix}`,
    ]);
    res.json({ ok: true });
  }

  @Post('logout')
  logout(@Res({ passthrough: false }) res: Response) {
    const base = 'Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
    res.setHeader('Set-Cookie', [
      `access_token=; ${base}${secureSuffix}`,
      `refresh_token=; ${base}${secureSuffix}`,
    ]);
    res.json({ ok: true });
  }
}
