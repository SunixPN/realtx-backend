import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Repository } from 'typeorm';
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

    // Отправляем верификационное письмо в фоне — не блокируем регистрацию
    this.emailVerificationService.sendVerificationEmail(user).catch((err) => {
      console.error('Не удалось отправить верификационное письмо:', err);
    });

    return this.issueTokens(user, ctx);
  }

  /**
   * Вход/регистрация через Google.
   * Email уже верифицирован Google — ставим emailVerified: true.
   * Если аккаунт с таким email уже есть (регистрация по паролю) — мержим: логиним в него.
   */
  async googleLogin(
    googleEmail: string,
    googleName: string | null,
    ctx: SessionContext = {},
  ): Promise<AuthResult> {
    let user = await this.userRepo.findOne({ where: { email: googleEmail } });

    if (!user) {
      user = await this.userRepo.save(
        this.userRepo.create({
          email: googleEmail,
          name: googleName ?? undefined,
          emailVerified: true,
          lastLoginAt: new Date(),
        }),
      );
    } else {
      const patch: Partial<UserEntity> = { lastLoginAt: new Date() };
      if (!user.emailVerified) patch.emailVerified = true;
      if (!user.name && googleName) patch.name = googleName;
      await this.userRepo.update(user.id, patch);
      user = { ...user, ...patch };
    }

    return this.issueTokens(user, ctx);
  }

  /**
   * Вход/регистрация по номеру телефона.
   * Вызывается после того, как FirebaseAdminService уже проверил ID токен
   * и извлёк из него номер — так что здесь номеру можно доверять.
   */
  async phoneLogin(phone: string, ctx: SessionContext = {}): Promise<AuthResult> {
    let user = await this.userRepo.findOne({ where: { phone } });

    if (!user) {
      // Первый вход — регистрируем юзера. Пароля/email нет, phoneVerified = true.
      user = await this.userRepo.save(
        this.userRepo.create({
          phone,
          phoneVerified: true,
          lastLoginAt: new Date(),
        }),
      );
    } else {
      await this.userRepo.update(user.id, { lastLoginAt: new Date() });
    }

    return this.issueTokens(user, ctx);
  }

  /**
   * Подтверждение номера для уже залогиненного юзера.
   * ID токен уже проверен во FirebaseAdminService, номер доверенный.
   * Если этот номер уже привязан к другому аккаунту — конфликт.
   */
  async confirmPhone(userId: string, phone: string): Promise<UserEntity> {
    const owner = await this.userRepo.findOne({ where: { phone } });
    if (owner && owner.id !== userId) {
      throw new ConflictException('Этот номер уже привязан к другому аккаунту');
    }

    await this.userRepo.update(userId, { phone, phoneVerified: true });

    const updated = await this.userRepo.findOne({ where: { id: userId } });
    if (!updated) {
      throw new NotFoundException('Пользователь не найден');
    }
    return updated;
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

  // Rotation: удаляем старый токен, выдаём новую пару
  async refresh(oldRefreshToken: string, ctx: SessionContext = {}): Promise<AuthResult> {
    if (!oldRefreshToken) {
      throw new UnauthorizedException('Refresh token отсутствует');
    }

    const tokenHash = this.hashToken(oldRefreshToken);

    const record = await this.refreshRepo.findOne({
      where: { tokenHash },
      relations: { user: true },
    });

    if (!record) {
      throw new UnauthorizedException('Недействительный refresh token');
    }

    if (record.expiresAt.getTime() < Date.now()) {
      // Истёкший токен удаляем — cron его всё равно бы убрал
      await this.refreshRepo.delete(record.id);
      throw new UnauthorizedException('Refresh token истёк');
    }

    // Rotation: удаляем старый токен и сразу выдаём новый
    await this.refreshRepo.delete(record.id);

    return this.issueTokens(record.user, ctx);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;

    const tokenHash = this.hashToken(refreshToken);
    await this.refreshRepo.delete({ tokenHash });
  }

  // Список активных (не истёкших) сессий юзера
  async listSessions(userId: string) {
    const sessions = await this.refreshRepo.find({
      where: { userId, expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC' },
    });

    return sessions.map(({ tokenHash: _, ...s }) => s);
  }

  // Отозвать одну конкретную сессию
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const result = await this.refreshRepo.delete({ id: sessionId, userId });

    if (result.affected === 0) {
      throw new NotFoundException('Сессия не найдена');
    }
  }

  // Выход со всех устройств
  async logoutAll(userId: string): Promise<void> {
    await this.refreshRepo.delete({ userId });
  }

  // Удалить истёкшие токены — вызывается из TokenCleanupService
  async deleteExpiredTokens(): Promise<number> {
    const result = await this.refreshRepo.delete({
      expiresAt: LessThan(new Date()),
    });
    return result.affected ?? 0;
  }

  // Удаление аккаунта — каскадом уйдут все refresh_tokens
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
