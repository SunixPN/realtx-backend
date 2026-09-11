import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { EmailVerificationService } from './email-verification.service.js';
import { PasswordResetService } from './password-reset.service.js';
import { FirebaseAdminService } from './firebase-admin.service.js';
import { RegisterDto } from './dto/register-dto.js';
import { LoginDto } from './dto/login-dto.js';
import { VerifyEmailDto } from './dto/verify-email-dto.js';
import { RequestPasswordResetDto } from './dto/request-password-reset-dto.js';
import { VerifyResetTokenDto } from './dto/verify-reset-token-dto.js';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset-dto.js';
import { PhoneLoginDto } from './dto/phone-login-dto.js';
import { GoogleLoginDto } from './dto/google-login-dto.js';
import { Public } from './decorators/public.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { UserEntity } from '../user/entities/user.entity.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly passwordResetService: PasswordResetService,
    private readonly firebaseAdmin: FirebaseAdminService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto, {
      userAgent: req.headers['user-agent'] ?? null,
      ipAddress: req.ip ?? null,
    });

    this.setRefreshCookie(res, result.refreshToken);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, {
      userAgent: req.headers['user-agent'] ?? null,
      ipAddress: req.ip ?? null,
    });

    this.setRefreshCookie(res, result.refreshToken);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Get('me')
  me(@CurrentUser() user: UserEntity) {
    const { passwordHash: _p, refreshTokens: _r, ...safeUser } = user;
    return safeUser;
  }

  // --- Верификация email ---

  // Юзер запрашивает повторное письмо (например, первое потерялось / срок истёк)
  @Post('verify-email/resend')
  @HttpCode(HttpStatus.ACCEPTED)
  async resendVerificationEmail(@CurrentUser() user: UserEntity) {
    await this.emailVerificationService.sendVerificationEmail(user);
    return { message: 'Письмо отправлено' };
  }

  // Фронт вызывает после клика по ссылке из письма
  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.emailVerificationService.verifyEmail(dto.token);
    return { message: 'Email подтверждён' };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const oldToken = req.cookies?.refresh_token as string | undefined;

    const result = await this.authService.refresh(oldToken!, {
      userAgent: req.headers['user-agent'] ?? null,
      ipAddress: req.ip ?? null,
    });

    this.setRefreshCookie(res, result.refreshToken);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.refresh_token as string | undefined;
    await this.authService.logout(token);
    res.clearCookie('refresh_token', { path: '/' });
  }

  // --- Управление сессиями ---

  @Get('sessions')
  listSessions(@CurrentUser() user: UserEntity) {
    return this.authService.listSessions(user.id);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @CurrentUser() user: UserEntity,
    @Param('id', ParseUUIDPipe) sessionId: string,
  ) {
    await this.authService.revokeSession(user.id, sessionId);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(
    @CurrentUser() user: UserEntity,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logoutAll(user.id);
    res.clearCookie('refresh_token', { path: '/' });
  }

  // --- Удаление аккаунта ---

  @Delete('account')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(
    @CurrentUser() user: UserEntity,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.deleteAccount(user.id);
    res.clearCookie('refresh_token', { path: '/' });
  }

  // --- Вход по номеру телефона (Firebase Phone Auth) ---

  // Фронт делает весь phone-auth флоу через Firebase JS SDK: RecaptchaVerifier →
  // signInWithPhoneNumber → confirm(code) → getIdToken(). Полученный ID токен шлёт сюда.
  // Мы проверяем его через Firebase Admin SDK и выдаём наши JWT.
  @Public()
  @Post('phone/login')
  @HttpCode(HttpStatus.OK)
  async phoneLogin(
    @Body() dto: PhoneLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { phone } = await this.firebaseAdmin.verifyPhoneToken(dto.idToken);

    const result = await this.authService.phoneLogin(phone, {
      userAgent: req.headers['user-agent'] ?? null,
      ipAddress: req.ip ?? null,
    });

    this.setRefreshCookie(res, result.refreshToken);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  // Подтверждение номера для уже залогиненного юзера (например, регистрировался по email).
  // Фронт делает тот же Firebase Phone Auth флоу и присылает ID токен сюда с JWT.
  @Post('phone/confirm')
  @HttpCode(HttpStatus.OK)
  async phoneConfirm(
    @CurrentUser() user: UserEntity,
    @Body() dto: PhoneLoginDto,
  ) {
    const { phone } = await this.firebaseAdmin.verifyPhoneToken(dto.idToken);
    const updated = await this.authService.confirmPhone(user.id, phone);
    const { passwordHash: _p, refreshTokens: _r, ...safeUser } = updated;
    return safeUser;
  }

  // --- Вход через Google (Firebase Google Sign-In) ---

  @Public()
  @Post('google/login')
  @HttpCode(HttpStatus.OK)
  async googleLogin(
    @Body() dto: GoogleLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { email, name, emailVerified } = await this.firebaseAdmin.verifyGoogleToken(dto.idToken);

    if (!emailVerified) {
      throw new UnauthorizedException('Google не подтвердил email');
    }

    const result = await this.authService.googleLogin(email, name, {
      userAgent: req.headers['user-agent'] ?? null,
      ipAddress: req.ip ?? null,
    });

    this.setRefreshCookie(res, result.refreshToken);

    return {
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  // --- Сброс пароля ---

  // Шаг 1: запрос ссылки. Всегда 202 — не палим наличие аккаунта.
  @Public()
  @Post('password-reset/request')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    await this.passwordResetService.requestReset(dto.email);
    return { message: 'Если такой email существует, письмо отправлено' };
  }

  // Шаг 2: фронт проверяет токен при монтировании /reset/new — показать форму или «ссылка протухла».
  @Public()
  @Post('password-reset/verify')
  @HttpCode(HttpStatus.OK)
  async verifyResetToken(@Body() dto: VerifyResetTokenDto) {
    await this.passwordResetService.verifyToken(dto.token);
    return { valid: true };
  }

  // Шаг 3: установка нового пароля. Токен удаляется, все сессии инвалидируются.
  @Public()
  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmPasswordReset(@Body() dto: ConfirmPasswordResetDto) {
    await this.passwordResetService.confirmReset(dto.token, dto.password);
    return { message: 'Пароль обновлён' };
  }

  private setRefreshCookie(res: Response, token: string): void {
    const days = Number(this.config.get('JWT_REFRESH_TTL_DAYS') ?? 30);
    const secure = this.config.get('COOKIE_SECURE') === 'true';

    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: '/',
      maxAge: days * 24 * 60 * 60 * 1000,
    });
  }
}
