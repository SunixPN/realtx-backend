import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../user/entities/user.entity.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { EmailVerificationService } from './email-verification.service.js';
import { PasswordResetService } from './password-reset.service.js';
import { TokenCleanupService } from './token-cleanup.service.js';
import { FirebaseAdminService } from './firebase-admin.service.js';
import { RefreshTokenEntity } from './entities/refresh.entity.js';
import { EmailVerificationTokenEntity } from './entities/email-verification.entity.js';
import { PasswordResetTokenEntity } from './entities/password-reset.entity.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      RefreshTokenEntity,
      EmailVerificationTokenEntity,
      PasswordResetTokenEntity,
    ]),
    PassportModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    EmailVerificationService,
    PasswordResetService,
    TokenCleanupService,
    FirebaseAdminService,
    JwtStrategy,
    // Глобальный guard — все эндпоинты защищены по умолчанию
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService, EmailVerificationService, PasswordResetService],
})
export class AuthModule {}
