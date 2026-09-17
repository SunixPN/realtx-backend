import { SetMetadata } from '@nestjs/common';

export const IS_OPTIONAL_AUTH_KEY = 'isOptionalAuth';

/**
 * Помечает эндпоинт как «опциональная аутентификация» —
 * токен JWT принимается и раскрывается в req.user, но
 * при его отсутствии запрос не отклоняется.
 */
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);
