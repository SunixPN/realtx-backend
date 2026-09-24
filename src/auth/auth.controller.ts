import { Body, Controller, Delete, Get, HttpCode, HttpException, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FavoriteEntity } from '../favorite/entities/favorite.entity.js';
import { SearchSubscriptionEntity } from '../search-subscription/entities/search-subscription.entity.js';
import { CompareItemEntity } from '../compare/entities/compare-item.entity.js';
import { ViewedEntity } from '../viewed/entities/viewed.entity.js';
import { AuthService } from './auth.service.js';
import { UpdateProfileDto } from './dto/update-profile-dto.js';
import { AddEmailDto } from './dto/add-email-dto.js';
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
import { SettingsService } from '../settings/settings.service.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly passwordResetService: PasswordResetService,
    private readonly firebaseAdmin: FirebaseAdminService,
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
    @InjectRepository(FavoriteEntity)
    private readonly favoriteRepo: Repository<FavoriteEntity>,
    @InjectRepository(SearchSubscriptionEntity)
    private readonly subscriptionRepo: Repository<SearchSubscriptionEntity>,
    @InjectRepository(CompareItemEntity)
    private readonly compareRepo: Repository<CompareItemEntity>,
    @InjectRepository(ViewedEntity)
    private readonly viewedRepo: Repository<ViewedEntity>,
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
    return this.buildMe(user);
  }

  // Редактирование профиля: имя, город, email-уведомления
  @Patch('me')
  async updateMe(
    @CurrentUser() user: UserEntity,
    @Body() dto: UpdateProfileDto,
  ) {
    const updated = await this.authService.updateProfile(user.id, dto);
    return this.buildMe(updated);
  }

  // Добавление email (или замена неподтверждённого) — сразу шлём письмо
  @Post('email')
  @HttpCode(HttpStatus.OK)
  async addEmail(
    @CurrentUser() user: UserEntity,
    @Body() dto: AddEmailDto,
  ) {
    const updated = await this.authService.addEmail(user.id, dto.email);
    return this.buildMe(updated);
  }

  // --- Верификация email ---

  // Юзер запрашивает повторное письмо (например, первое потерялось / срок истёк)
  @Post('verify-email/resend')
  @HttpCode(HttpStatus.ACCEPTED)
  async resendVerificationEmail(@CurrentUser() user: UserEntity) {
    await this.emailVerificationService.assertResendAllowed(user.id);
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

    let result;
    try {
      result = await this.authService.refresh(oldToken!, {
        userAgent: req.headers['user-agent'] ?? null,
        ipAddress: req.ip ?? null,
      });
    } catch (err) {
      // Протухший refresh чистим. «Не найден» — НЕ чистим: чаще всего его только что
      // ротировал параллельный refresh (prefetch'и, пачка запросов после логина),
      // и Set-Cookie с пустым значением стёр бы в браузере свежий токен победителя.
      const code = err instanceof HttpException
        ? (err.getResponse() as { code?: string })?.code
        : undefined;
      if (code === 'REFRESH_EXPIRED') this.clearRefreshCookie(res);
      throw err;
    }

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
    this.clearRefreshCookie(res);
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
    this.clearRefreshCookie(res);
  }

  // --- Удаление аккаунта ---

  @Delete('account')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(
    @CurrentUser() user: UserEntity,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.deleteAccount(user.id);
    this.clearRefreshCookie(res);
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
    return this.buildMe(updated);
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

  // Юзер без секретов + счётчики активности для шапки и профиля
  private async buildMe(user: UserEntity) {
    const { passwordHash: _p, refreshTokens: _r, ...safeUser } = user;
    const [favoritesCount, subscriptionsCount, compareCount, viewedCount, freshRow] = await Promise.all([
      this.favoriteRepo.count({ where: { userId: user.id } }),
      this.subscriptionRepo.count({ where: { userId: user.id } }),
      this.compareRepo.count({ where: { userId: user.id } }),
      // Старше viewed.retentionDays вычищает cron — значит это «за последние N дней»
      this.viewedRepo.count({ where: { userId: user.id } }),
      this.subscriptionRepo
        .createQueryBuilder('s')
        .select('COALESCE(SUM(s.fresh), 0)', 'sum')
        .where('s.userId = :userId', { userId: user.id })
        .andWhere('s.paused = false')
        .getRawOne<{ sum: string }>(),
    ]);
    return {
      ...safeUser,
      favoritesCount,
      subscriptionsCount,
      compareCount,
      viewedCount,
      subscriptionsFreshCount: Number(freshRow?.sum ?? 0),
    };
  }

  private setRefreshCookie(res: Response, token: string): void {
    const days = this.settings.getNumber('jwt.refreshTtlDays');
    const secure = this.config.get('COOKIE_SECURE') === 'true';
    const domain = this.config.get<string>('COOKIE_DOMAIN') || undefined;
    const sameSite: 'none' | 'lax' = secure ? 'none' : 'lax';

    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure,
      sameSite,
      path: '/',
      maxAge: days * 24 * 60 * 60 * 1000,
      ...(domain ? { domain } : {}),
    });
  }

  private clearRefreshCookie(res: Response): void {
    const domain = this.config.get<string>('COOKIE_DOMAIN') || undefined;
    res.clearCookie('refresh_token', {
      path: '/',
      ...(domain ? { domain } : {}),
    });
  }
}
