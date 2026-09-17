import type { ResourceWithOptions } from 'adminjs';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../user/entities/user.entity.js';
import { EstateEntity } from '../estate/entities/estate.entity.js';
import { FavoriteEntity } from '../favorite/entities/favorite.entity.js';
import { SearchSubscriptionEntity } from '../search-subscription/entities/search-subscription.entity.js';
import { AppSettingEntity } from '../settings/entities/app-setting.entity.js';
import { SubscriptionCheckService } from '../search-subscription/subscription-check.service.js';
import { CurrencyRatesService } from '../currency/currency-rates.service.js';
import { EstateService } from '../estate/estate.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { SETTINGS_BY_KEY } from '../settings/settings.keys.js';

export interface AdminDeps {
  subscriptions: SubscriptionCheckService;
  currency: CurrencyRatesService;
  estates: EstateService;
  settings: SettingsService;
}

const fireAndForget = (label: string, fn: () => Promise<unknown>) => {
  fn().catch((err) => console.error(`[admin/${label}] ${(err as Error).message}`, err));
};

const jobAction = (label: string, icon: string, run: () => Promise<unknown>) => ({
  actionType: 'resource' as const,
  icon,
  label,
  component: false as const,
  handler: async () => {
    fireAndForget(label, run);
    return { notice: { message: `${label}: запущено в фоне`, type: 'success' as const } };
  },
});

export function buildResources(deps: AdminDeps): ResourceWithOptions[] {
  return [
    {
      resource: UserEntity,
      options: {
        navigation: { name: 'Пользователи', icon: 'User' },
        listProperties: ['id', 'email', 'name', 'role', 'phone', 'emailVerified', 'createdAt', 'lastLoginAt'],
        showProperties: [
          'id', 'email', 'name', 'role', 'phone', 'city', 'currency', 'language', 'theme',
          'emailVerified', 'phoneVerified', 'notifyByEmail', 'notifyByTelegram', 'weeklyDigest',
          'googleId', 'telegramId', 'createdAt', 'updatedAt', 'lastLoginAt',
        ],
        editProperties: ['name', 'email', 'role', 'phone', 'emailVerified', 'notifyByEmail', 'notifyByTelegram'],
        filterProperties: ['role', 'emailVerified', 'createdAt'],
        properties: {
          role: {
            availableValues: [
              { value: 'user', label: 'user' },
              { value: 'admin', label: 'admin' },
            ],
          },
          passwordHash: { isVisible: false },
        },
        actions: {
          new: { isAccessible: false },
        },
      },
    },
    {
      resource: EstateEntity,
      options: {
        navigation: { name: 'Объявления', icon: 'Home' },
        listProperties: ['id', 'headline', 'rooms', 'priceUsd', 'townName', 'districtName', 'isActive', 'publishedAt'],
        showProperties: [
          'id', 'sourceUuid', 'sourceUrl', 'headline', 'description',
          'price', 'priceCurrency', 'priceUsd', 'priceByn', 'priceEur', 'pricePerM2',
          'rooms', 'areaTotal', 'areaLiving', 'areaKitchen', 'storey', 'storeys', 'buildingYear',
          'address', 'townName', 'districtName', 'lat', 'lng',
          'metroStation', 'metroTime',
          'agencyName', 'sellerType',
          'isActive', 'publishedAt', 'sourceUpdatedAt', 'createdAt', 'updatedAt',
        ],
        editProperties: ['headline', 'description', 'isActive'],
        filterProperties: ['isActive', 'rooms', 'townName', 'districtName', 'publishedAt'],
        actions: {
          new: { isAccessible: false },
          currencyRefresh: jobAction('Обновить курсы + пересчёт цен', 'DollarSign', async () => {
            await deps.currency.fetchAndSaveFromNbrb();
            await deps.estates.recomputePrices();
          }),
        },
      },
    },
    {
      resource: FavoriteEntity,
      options: {
        navigation: { name: 'Избранное', icon: 'Heart' },
        listProperties: ['userId', 'estateId', 'createdAt'],
        actions: {
          new: { isAccessible: false },
          edit: { isAccessible: false },
        },
      },
    },
    {
      resource: SearchSubscriptionEntity,
      options: {
        navigation: { name: 'Подписки на поиск', icon: 'Bell' },
        listProperties: ['id', 'userId', 'name', 'frequency', 'paused', 'fresh', 'lastCheckedAt', 'createdAt'],
        showProperties: [
          'id', 'userId', 'name', 'filters', 'frequency', 'triggers', 'channels',
          'quietHours', 'paused', 'lastCheckedAt', 'fresh', 'createdAt', 'updatedAt',
        ],
        editProperties: ['name', 'frequency', 'paused'],
        filterProperties: ['frequency', 'paused', 'userId'],
        actions: {
          new: { isAccessible: false },
          subscriptionsRunInstant: jobAction('Рассылка: instant', 'Zap', () => deps.subscriptions.runCheck(['instant'])),
          subscriptionsRunDaily: jobAction('Рассылка: daily', 'Sun', () => deps.subscriptions.runCheck(['daily'])),
          subscriptionsRunWeekly: jobAction('Рассылка: weekly', 'Calendar', () => deps.subscriptions.runCheck(['weekly'])),
          subscriptionsRunAll: jobAction('Рассылка: все', 'Send', () => deps.subscriptions.runCheck()),
        },
      },
    },
    {
      resource: AppSettingEntity,
      options: {
        navigation: { name: 'Настройки', icon: 'Settings' },
        listProperties: ['key', 'value', 'updatedAt'],
        editProperties: ['value'],
        actions: {
          new: { isAccessible: false },
          delete: { isAccessible: false },
          bulkDelete: { isAccessible: false },
          edit: {
            before: async (request: any) => {
              const key = request.params?.recordId as string | undefined;
              const value = request.payload?.value;
              if (key && SETTINGS_BY_KEY.has(key) && value !== undefined) {
                await deps.settings.set(key, String(value));
              }
              return request;
            },
          },
        },
      },
    },
  ];
}

export async function verifyAdminPassword(hash: string, password: string) {
  return bcrypt.compare(password, hash);
}
