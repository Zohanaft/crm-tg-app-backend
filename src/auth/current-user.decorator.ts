import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { User } from '../generated/prisma/client';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);
