import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'node:crypto';
import { UserEntity } from '../user/entities/user.entity.js';
import { RefreshTokenEntity } from './entities/refresh.entity.js';
import { RegisterDto } from './dto/register-dto.js';
import { LoginDto } from './dto/login-dto.js';
import { EmailVerificationService } from './email-verification.service.js';

const BCRYPT_ROUNDS = 12;

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: Omit<UserEntity, 'passwordHash' | 'refreshTokens'>;
}

export interface SessionContext {
  userAgent?: string | null;
  ipAddress?: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,

    @InjectRepository(RefreshTokenEntity)
    private readonly refreshRepo: Repository<RefreshTokenEntity>,

    private readonly emailVerificationService: EmailVerificationService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto, ctx: SessionContext = {}): Promise<AuthResult> {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Пользователь с таким email уже зарегистрирован');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.userRepo.save(
      this.userRepo.create({
        email: dto.email,
        name: dto.name,
        passwordHash,
        lastLoginAt: new Date(),
      }),
    );

    // Отправляем верификационное письмо в фоне — не блокируем регистрацию,
    // если Resend временно не отвечает, пользователь всё равно зарегистрируется
    this.emailVerificationService.sendVerificationEmail(user).catch((err) => {
      console.error('Не удалось отправить верификационное письмо:', err);
    });

    return this.issueTokens(user, ctx);
  }

  async login(dto: LoginDto, ctx: SessionContext = {}): Promise<AuthResult> {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: dto.email })
      .getOne();

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    await this.userRepo.update(user.id, { lastLoginAt: new Date() });

    return this.issueTokens(user, ctx);
  }

  // Обмен старого refresh на новую пару (rotation)
  async refresh(oldRefreshToken: string, ctx: SessionContext = {}): Promise<AuthResult> {
    if (!oldRefreshToken) {
      throw new UnauthorizedException('Refresh token отсутствует');
    }

    const tokenHash = this.hashToken(oldRefreshToken);

    const record = await this.refreshRepo.findOne({
      where: { tokenHash, revokedAt: IsNull() },
      relations: { user: true },
    });

    if (!record) {
      // Токен уже отозван (или подделан) — возможно кто-то украл.
      // На всякий случай инвалидируем все токены этого юзера если сможем понять кого именно
      throw new UnauthorizedException('Недействительный refresh token');
    }

    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token истёк');
    }

    // Rotation: старый токен помечаем отозванным
    record.revokedAt = new Date();
    await this.refreshRepo.save(record);

    return this.issueTokens(record.user, ctx);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return; // молча — logout идемпотентен

    const tokenHash = this.hashToken(refreshToken);
    await this.refreshRepo.update(
      { tokenHash, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  // Список активных сессий юзера
  async listSessions(userId: string) {
    const sessions = await this.refreshRepo.find({
      where: { userId, revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });

    // Не отдаём tokenHash наружу
    return sessions.map(({ tokenHash: _, ...s }) => s);
  }

  // Отозвать одну конкретную сессию
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.refreshRepo.findOne({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException('Сессия не найдена');
    }
    if (session.revokedAt) return; // уже отозвана — ок

    session.revokedAt = new Date();
    await this.refreshRepo.save(session);
  }

  // Выход со всех устройств
  async logoutAll(userId: string): Promise<void> {
    await this.refreshRepo.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  // Удаление аккаунта — вместе с ним каскадом уйдут все refresh_tokens
  async deleteAccount(userId: string): Promise<void> {
    const result = await this.userRepo.delete(userId);
    if (result.affected === 0) {
      throw new NotFoundException('Пользователь не найден');
    }
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async issueTokens(
    user: UserEntity,
    ctx: SessionContext,
  ): Promise<AuthResult> {
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id },
      {
        secret: this.config.get('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_TTL') ?? '15m',
      },
    );

    const refreshToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(refreshToken);

    const days = Number(this.config.get('JWT_REFRESH_TTL_DAYS') ?? 30);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.refreshRepo.save(
      this.refreshRepo.create({
        userId: user.id,
        tokenHash,
        expiresAt,
        userAgent: ctx.userAgent ?? null,
        ipAddress: ctx.ipAddress ?? null,
      }),
    );

    const { passwordHash: _p, refreshTokens: _r, ...safeUser } = user;
    return { accessToken, refreshToken, user: safeUser as any };
  }
}
