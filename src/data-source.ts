import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config as loadEnv } from 'dotenv';
import { EstateEntity } from './estate/entities/estate.entity.js';
import { UserEntity } from './user/entities/user.entity.js';
import { RefreshTokenEntity } from './auth/entities/refresh.entity.js';
import { EmailVerificationTokenEntity } from './auth/entities/email-verification.entity.js';
import { PasswordResetTokenEntity } from './auth/entities/password-reset.entity.js';
import { CurrencyRateEntity } from './currency/entities/currency-rate.entity.js';
import { FavoriteEntity } from './favorite/entities/favorite.entity.js';
import { CompareItemEntity } from './compare/entities/compare-item.entity.js';
import { ComparePreferenceEntity } from './compare/entities/compare-preference.entity.js';
import { ViewedEntity } from './viewed/entities/viewed.entity.js';
import { SearchSubscriptionEntity } from './search-subscription/entities/search-subscription.entity.js';
import { AppSettingEntity } from './settings/entities/app-setting.entity.js';

loadEnv();

const isCompiled = import.meta.url.endsWith('.js');

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [
    EstateEntity,
    UserEntity,
    RefreshTokenEntity,
    EmailVerificationTokenEntity,
    PasswordResetTokenEntity,
    CurrencyRateEntity,
    FavoriteEntity,
    CompareItemEntity,
    ComparePreferenceEntity,
    ViewedEntity,
    SearchSubscriptionEntity,
    AppSettingEntity,
  ],
  migrations: [isCompiled ? 'dist/migrations/*.js' : 'src/migrations/*.ts'],
  synchronize: false,
});
