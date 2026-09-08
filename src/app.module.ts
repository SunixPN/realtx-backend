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
        entities: [EstateEntity, UserEntity, RefreshTokenEntity, EmailVerificationTokenEntity],
        synchronize: true,
      }),
      inject: [ConfigService],
    }),
    MailModule,
    EstateModule,
    ParserModule,
    UserModule,
    AuthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
