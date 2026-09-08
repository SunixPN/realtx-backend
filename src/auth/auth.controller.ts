import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { EmailVerificationService } from './email-verification.service.js';
import { RegisterDto } from './dto/register-dto.js';
import { LoginDto } from './dto/login-dto.js';
import { VerifyEmailDto } from './dto/verify-email-dto.js';
import { Public } from './decorators/public.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { UserEntity } from '../user/entities/user.entity.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerificationService: EmailVerificationService,
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
    const oldToken = req.cookies?.refresh as string | undefined;

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
    const token = req.cookies?.refresh as string | undefined;
    await this.authService.logout(token);
    res.clearCookie('refresh', { path: '/auth' });
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
    res.clearCookie('refresh', { path: '/auth' });
  }

  // --- Удаление аккаунта ---

  @Delete('account')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(
    @CurrentUser() user: UserEntity,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.deleteAccount(user.id);
    res.clearCookie('refresh', { path: '/auth' });
  }

  private setRefreshCookie(res: Response, token: string): void {
    const days = Number(this.config.get('JWT_REFRESH_TTL_DAYS') ?? 30);
    const secure = this.config.get('COOKIE_SECURE') === 'true';

    res.cookie('refresh', token, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: '/auth',
      maxAge: days * 24 * 60 * 60 * 1000,
    });
  }
}
