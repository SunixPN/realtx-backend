import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Помечает эндпоинт как публичный — глобальный JwtAuthGuard его пропустит без токена.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
