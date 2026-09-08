import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../user/entities/user.entity.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { EmailVerificationService } from './email-verification.service.js';
import { RefreshTokenEntity } from './entities/refresh.entity.js';
import { EmailVerificationTokenEntity } from './entities/email-verification.entity.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, RefreshTokenEntity, EmailVerificationTokenEntity]),
    PassportModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    EmailVerificationService,
    JwtStrategy,
    // Глобальный guard — все эндпоинты защищены по умолчанию
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService, EmailVerificationService],
})
export class AuthModule {}
