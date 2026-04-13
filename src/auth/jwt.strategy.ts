import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { TokenPayload } from './auth.service';
import { AuthService } from './auth.service';

function extractFromCookieOrBearer(req: Request): string | null {
  const token = req?.cookies?.access_token;
  if (token && typeof token === 'string') {
    return token;
  }
  const auth = req?.headers?.authorization;
  if (auth && typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => extractFromCookieOrBearer(req),
      ]),
      secretOrKey: process.env.JWT_SECRET?.trim() || 'change-me-in-production',
      ignoreExpiration: false,
    });
  }

  async validate(payload: TokenPayload) {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }
    const user = await this.authService.getProfileById(payload.sub);
    const effectivePlanId =
      user.planExpiresAt && user.planExpiresAt < new Date() ? 1 : user.planId;
    return { ...user, effectivePlanId };
  }
}
