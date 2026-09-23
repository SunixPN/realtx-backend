import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EstateModule } from './estate/estate.module.js';
import { ParserModule } from './parser/parser.module.js';
import { EstateEntity } from './estate/entities/estate.entity.js';
import { UserEntity } from './user/entities/user.entity.js';
import { UserModule } from './user/user.module.js';
import { AuthModule } from './auth/auth.module.js';
import { RefreshTokenEntity } from './auth/entities/refresh.entity.js';
import { EmailVerificationTokenEntity } from './auth/entities/email-verification.entity.js';
import { MailModule } from './mail/mail.module.js';
import {PasswordResetTokenEntity} from "./auth/entities/password-reset.entity.js";
import { CurrencyModule } from './currency/currency.module.js';
import { CurrencyRateEntity } from './currency/entities/currency-rate.entity.js';
import { FavoriteModule } from './favorite/favorite.module.js';
import { FavoriteEntity } from './favorite/entities/favorite.entity.js';
import { ViewedModule } from './viewed/viewed.module.js';
import { ViewedEntity } from './viewed/entities/viewed.entity.js';
import { SearchSubscriptionModule } from './search-subscription/search-subscription.module.js';
import { SearchSubscriptionEntity } from './search-subscription/entities/search-subscription.entity.js';
import { SettingsModule } from './settings/settings.module.js';
import { AppSettingEntity } from './settings/entities/app-setting.entity.js';
import { AdminPanelModule } from './admin/admin.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get('DB_USER'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_NAME'),
        entities: [EstateEntity, UserEntity, RefreshTokenEntity, EmailVerificationTokenEntity, PasswordResetTokenEntity, CurrencyRateEntity, FavoriteEntity, ViewedEntity, SearchSubscriptionEntity, AppSettingEntity],
        migrations: ['dist/migrations/*.js'],
        synchronize: config.get('DB_SYNC') === 'true',
        migrationsRun: config.get('DB_MIGRATIONS_RUN') !== 'false',
      }),
      inject: [ConfigService],
    }),
    SettingsModule,
    MailModule,
    CurrencyModule,
    EstateModule,
    ParserModule,
    UserModule,
    AuthModule,
    FavoriteModule,
    ViewedModule,
    SearchSubscriptionModule,
    AdminPanelModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
