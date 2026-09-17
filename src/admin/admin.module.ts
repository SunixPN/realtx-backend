import { Module } from '@nestjs/common';
import { TypeOrmModule, getDataSourceToken } from '@nestjs/typeorm';
import { ConfigService, ConfigModule } from '@nestjs/config';
import type { DataSource } from 'typeorm';
import { AdminModule as AdminJSNestModule } from '@adminjs/nestjs';

import { UserEntity } from '../user/entities/user.entity.js';
import { EstateEntity } from '../estate/entities/estate.entity.js';
import { FavoriteEntity } from '../favorite/entities/favorite.entity.js';
import { SearchSubscriptionEntity } from '../search-subscription/entities/search-subscription.entity.js';
import { AppSettingEntity } from '../settings/entities/app-setting.entity.js';

import { SearchSubscriptionModule } from '../search-subscription/search-subscription.module.js';
import { CurrencyModule } from '../currency/currency.module.js';
import { EstateModule } from '../estate/estate.module.js';
import { SettingsModule } from '../settings/settings.module.js';

import { SubscriptionCheckService } from '../search-subscription/subscription-check.service.js';
import { CurrencyRatesService } from '../currency/currency-rates.service.js';
import { EstateService } from '../estate/estate.service.js';
import { SettingsService } from '../settings/settings.service.js';

import { AdminSeedService } from './admin-seed.service.js';
import { buildResources, verifyAdminPassword } from './admin.resources.js';

const ENTITIES = [UserEntity, EstateEntity, FavoriteEntity, SearchSubscriptionEntity, AppSettingEntity];

const registerAdminJsAdapter = async (dataSource: DataSource) => {
  const [{ default: AdminJS }, typeorm] = await Promise.all([
    import('adminjs'),
    import('@adminjs/typeorm'),
  ]);
  const { validate } = await import('class-validator');
  (typeorm as any).Resource.validate = validate;
  AdminJS.registerAdapter({ Database: (typeorm as any).Database, Resource: (typeorm as any).Resource });
  for (const Entity of ENTITIES) {
    (Entity as any).useDataSource(dataSource);
  }
};

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    SearchSubscriptionModule,
    CurrencyModule,
    EstateModule,
    SettingsModule,
    ConfigModule,
    AdminJSNestModule.createAdminAsync({
      imports: [SearchSubscriptionModule, CurrencyModule, EstateModule, SettingsModule, ConfigModule],
      inject: [
        getDataSourceToken(),
        SubscriptionCheckService,
        CurrencyRatesService,
        EstateService,
        SettingsService,
        ConfigService,
      ],
      useFactory: async (
        dataSource: DataSource,
        subscriptions: SubscriptionCheckService,
        currency: CurrencyRatesService,
        estates: EstateService,
        settings: SettingsService,
        config: ConfigService,
      ) => {
        await registerAdminJsAdapter(dataSource);

        const rootPath = '/admin';
        const resources = buildResources({ subscriptions, currency, estates, settings });

        return {
          adminJsOptions: {
            rootPath,
            branding: {
              companyName: 'RealtX Admin',
              withMadeWithLove: false,
            },
            resources,
          },
          auth: {
            authenticate: async (email: string, password: string) => {
              const user = await dataSource.getRepository(UserEntity)
                .createQueryBuilder('u')
                .addSelect('u.passwordHash')
                .where('u.email = :email', { email })
                .getOne();
              if (!user || !user.passwordHash || user.role !== 'admin') return null;
              const ok = await verifyAdminPassword(user.passwordHash, password);
              return ok ? { email: user.email!, id: user.id, role: user.role } : null;
            },
            cookieName: 'realtx.admin',
            cookiePassword: config.get<string>('ADMIN_COOKIE_SECRET') ?? 'change-me-in-env-please-32-chars-min',
          },
          sessionOptions: {
            resave: false,
            saveUninitialized: false,
            secret: config.get<string>('ADMIN_COOKIE_SECRET') ?? 'change-me-in-env-please-32-chars-min',
          },
        };
      },
    }),
  ],
  providers: [AdminSeedService],
})
export class AdminPanelModule {}
