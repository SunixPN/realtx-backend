import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserEntity } from '../../user/entities/user.entity.js';

/**
 * Достаёт текущего юзера из request.user (кладёт туда JwtStrategy.validate).
 * Использование: async endpoint(@CurrentUser() user: UserEntity) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserEntity => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
