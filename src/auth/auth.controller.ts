import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { TelegramAuthPayload } from './auth.service';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

function parseTgAuthResult(
  tgAuthResult: string | undefined,
): TelegramAuthPayload {
  if (!tgAuthResult || typeof tgAuthResult !== 'string') {
    throw new BadRequestException('tgAuthResult is required');
  }
  try {
    const json = Buffer.from(tgAuthResult, 'base64').toString('utf8');
    const payload = JSON.parse(json) as TelegramAuthPayload;
    if (
      typeof payload?.id !== 'number' ||
      typeof payload?.auth_date !== 'number' ||
      typeof payload?.hash !== 'string'
    ) {
      throw new BadRequestException('Invalid tgAuthResult payload');
    }
    return payload;
  } catch (err) {
    if (err instanceof BadRequestException) throw err;
    throw new BadRequestException('Invalid tgAuthResult encoding');
  }
}

const accessMaxAge = 15 * 60;
const refreshMaxAge = 7 * 24 * 60 * 60;
const secureSuffix = process.env.NODE_ENV === 'production' ? '; Secure' : '';

@ApiTags('Авторизация')
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({
    summary: 'Вход через Telegram',
    description:
      'Авторизация по данным виджета Telegram. Устанавливает cookies с access и refresh токенами.',
  })
  @ApiBody({ type: LoginDto, description: 'Данные от Telegram Login Widget' })
  @ApiResponse({
    status: 200,
    description:
      'Успешный вход, возвращается пользователь и устанавливаются cookies',
  })
  @ApiResponse({ status: 401, description: 'Неверные данные Telegram' })
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

  @Get('auth/telegram')
  @ApiOperation({
    summary: 'OAuth-колбэк Telegram',
    description:
      'Редирект после авторизации в Telegram. Устанавливает cookies и перенаправляет на дашборд.',
  })
  @ApiQuery({
    name: 'tgAuthResult',
    required: true,
    description: 'Данные авторизации Telegram в Base64 (JSON)',
  })
  @ApiResponse({ status: 302, description: 'Редирект на дашборд' })
  @ApiResponse({
    status: 400,
    description: 'Неверный или отсутствующий tgAuthResult',
  })
  @ApiResponse({ status: 401, description: 'Ошибка авторизации Telegram' })
  async authTelegram(
    @Query('tgAuthResult') tgAuthResult: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    const botToken = process.env.TG_AUTH_BOT_TOKEN;
    if (!botToken) {
      throw new UnauthorizedException('Telegram bot token not configured');
    }
    const payload = parseTgAuthResult(tgAuthResult);
    const { user, accessToken, refreshToken } =
      await this.authService.loginWithTelegram(payload, botToken);

    res.setHeader('Set-Cookie', [
      `access_token=${accessToken}; Max-Age=${accessMaxAge}; Path=/; HttpOnly; SameSite=Lax${secureSuffix}`,
      `refresh_token=${refreshToken}; Max-Age=${refreshMaxAge}; Path=/; HttpOnly; SameSite=Lax${secureSuffix}`,
    ]);

    const frontendUrl = process.env.FRONTEND_URL;
    const redirectPath = '/dashboard';
    const redirectUrl = frontendUrl
      ? `${frontendUrl.replace(/\/$/, '')}${redirectPath}`
      : `${req.protocol}://${req.get('Host') ?? ''}${redirectPath}`;

    res.redirect(302, redirectUrl);
  }

  @Get('profile')
  @ApiOperation({
    summary: 'Профиль текущего пользователя',
    description:
      'Возвращает данные пользователя. Требуется access_token в cookie или заголовке Authorization.',
  })
  @ApiResponse({
    status: 200,
    description: 'Профиль пользователя (id, telegramId, имя, юзернейм, фото)',
  })
  @ApiResponse({ status: 401, description: 'Требуется авторизация' })
  async profile(
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
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
  @ApiOperation({
    summary: 'Обновить токены',
    description:
      'Выдать новые access и refresh токены. Используется refresh_token из cookie.',
  })
  @ApiResponse({
    status: 200,
    description: 'Новые токены в теле ответа и в Set-Cookie',
  })
  @ApiResponse({
    status: 401,
    description: 'Неверный или истёкший refresh token',
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: false }) res: Response,
  ) {
    const refreshToken = req.cookies?.refresh_token;
    const { accessToken, refreshToken: newRefreshToken } =
      this.authService.refresh(refreshToken);

    res.setHeader('Set-Cookie', [
      `access_token=${accessToken}; Max-Age=${accessMaxAge}; Path=/; HttpOnly; SameSite=Lax${secureSuffix}`,
      `refresh_token=${newRefreshToken}; Max-Age=${refreshMaxAge}; Path=/; HttpOnly; SameSite=Lax${secureSuffix}`,
    ]);
    res.json({ ok: true, accessToken, refreshToken: newRefreshToken });
  }

  @Post('logout')
  @ApiOperation({
    summary: 'Выход',
    description: 'Очищает cookies авторизации.',
  })
  @ApiResponse({ status: 200, description: 'Cookies очищены' })
  logout(@Res({ passthrough: false }) res: Response) {
    const base = 'Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
    res.setHeader('Set-Cookie', [
      `access_token=; ${base}${secureSuffix}`,
      `refresh_token=; ${base}${secureSuffix}`,
    ]);
    res.json({ ok: true });
  }
}
