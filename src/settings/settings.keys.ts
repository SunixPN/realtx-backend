import type { ConfigService } from '@nestjs/config';

export type SettingKind = 'string' | 'number' | 'cron';

export interface SettingDefinition {
  key: string;
  label: string;
  kind: SettingKind;
  group: 'jwt' | 'auth' | 'cron' | 'other';
  default: (config: ConfigService) => string;
  description?: string;
}

export const SETTINGS: SettingDefinition[] = [
  {
    key: 'jwt.accessTtl',
    label: 'Access-token TTL (ms/s/m/h/d)',
    kind: 'string',
    group: 'jwt',
    default: (c) => c.get<string>('JWT_ACCESS_TTL') ?? '15m',
    description: 'Формат ms/vercel: 15m, 1h, 2d. Применяется при следующем логине.',
  },
  {
    key: 'jwt.refreshTtlDays',
    label: 'Refresh-token TTL (дней)',
    kind: 'number',
    group: 'jwt',
    default: (c) => String(c.get('JWT_REFRESH_TTL_DAYS') ?? 30),
  },
  {
    key: 'auth.passwordResetTtlMinutes',
    label: 'TTL письма сброса пароля (минут)',
    kind: 'number',
    group: 'auth',
    default: () => '15',
  },
  {
    key: 'auth.emailVerificationTtlMinutes',
    label: 'TTL письма подтверждения email (минут)',
    kind: 'number',
    group: 'auth',
    default: () => '15',
  },
  {
    key: 'cron.parser.parseAll',
    label: 'Крон: парсер realt.by',
    kind: 'cron',
    group: 'cron',
    default: () => '0 6 * * *',
  },
  {
    key: 'cron.parser.validate',
    label: 'Крон: валидация фантомов',
    kind: 'cron',
    group: 'cron',
    default: () => '0 8 * * *',
  },
  {
    key: 'cron.subscriptions.instant',
    label: 'Крон: instant-подписки',
    kind: 'cron',
    group: 'cron',
    default: () => '5 * * * *',
  },
  {
    key: 'cron.subscriptions.daily',
    label: 'Крон: ежедневный дайджест',
    kind: 'cron',
    group: 'cron',
    default: () => '0 9 * * *',
  },
  {
    key: 'cron.subscriptions.weekly',
    label: 'Крон: недельный дайджест',
    kind: 'cron',
    group: 'cron',
    default: () => '0 9 * * 1',
  },
  {
    key: 'cron.currency.refresh',
    label: 'Крон: курсы НБ РБ',
    kind: 'cron',
    group: 'cron',
    default: () => '15 5 * * *',
  },
];

export const SETTINGS_BY_KEY = new Map(SETTINGS.map((s) => [s.key, s]));
