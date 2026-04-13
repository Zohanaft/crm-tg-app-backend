import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AuthService, type TokenPayload } from './auth.service';

/**
 * Handshake for uWS: browser may send cookies while access_token is expired but refresh_token still valid.
 * JwtAuthGuard only accepts access; this guard accepts either token type and sets req.user like JwtStrategy.
 */
@Injectable()
export class WssCookieAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & { user?: unknown }
    >();
    const access = req.cookies?.access_token;
    const refresh = req.cookies?.refresh_token;
    let userId: string | null = null;

    if (access) {
      try {
        const p = this.jwtService.verify<TokenPayload>(access);
        if (p.type === 'access') userId = p.sub;
      } catch {
        /* expired or invalid access */
      }
    }

    if (!userId && refresh) {
      try {
        const p = this.jwtService.verify<TokenPayload>(refresh);
        if (p.type === 'refresh') userId = p.sub;
      } catch {
        throw new UnauthorizedException();
      }
    }

    if (!userId) {
      throw new UnauthorizedException();
    }

    const user = await this.authService.getProfileById(userId);
    const effectivePlanId =
      user.planExpiresAt && user.planExpiresAt < new Date() ? 1 : user.planId;
    req.user = { ...user, effectivePlanId };
    return true;
  }
}
