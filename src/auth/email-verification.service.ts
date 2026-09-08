import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as crypto from 'node:crypto';
import { UserEntity } from '../user/entities/user.entity.js';
import { MailService } from '../mail/mail.service.js';
import { EmailVerificationTokenEntity } from './entities/email-verification.entity.js';

const TOKEN_TTL_HOURS = 24;

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,

    @InjectRepository(EmailVerificationTokenEntity)
    private readonly tokenRepo: Repository<EmailVerificationTokenEntity>,

    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  // Отправить письмо с подтверждением. Инвалидирует прошлые токены юзера.
  async sendVerificationEmail(user: UserEntity): Promise<void> {
    if (!user.email) {
      throw new BadRequestException('У пользователя не указан email');
    }
    if (user.emailVerified) {
      throw new ConflictException('Email уже подтверждён');
    }

    // Отзываем все прошлые неиспользованные токены — активной может быть только последняя ссылка
    await this.tokenRepo.update(
      { userId: user.id, usedAt: IsNull() },
      { usedAt: new Date() },
    );

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    await this.tokenRepo.save(
      this.tokenRepo.create({
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000),
      }),
    );

    const frontendUrl = this.config.get<string>('FRONTEND_URL');
    const link = `${frontendUrl}/verify-email?token=${rawToken}`;

    await this.mailService.send({
      to: user.email,
      subject: 'Подтверждение email — RealtX',
      html: this.buildHtml(user.name ?? 'пользователь', link),
    });

    this.logger.log(`Верификационное письмо отправлено юзеру ${user.id}`);
  }

  // Подтвердить email по токену из ссылки
  async verifyEmail(rawToken: string): Promise<void> {
    if (!rawToken) {
      throw new BadRequestException('Токен не передан');
    }

    const tokenHash = this.hashToken(rawToken);

    const record = await this.tokenRepo.findOne({
      where: { tokenHash },
      relations: { user: true },
    });

    if (!record) {
      throw new NotFoundException('Ссылка недействительна');
    }
    if (record.usedAt) {
      throw new BadRequestException('Ссылка уже использована');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Срок действия ссылки истёк');
    }

    // Помечаем токен использованным + юзера как подтверждённого
    record.usedAt = new Date();
    await this.tokenRepo.save(record);

    await this.userRepo.update(record.userId, { emailVerified: true });
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private buildHtml(userName: string, link: string): string {
    return `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #111;">Подтвердите ваш email</h2>
        <p>Здравствуйте, ${userName}!</p>
        <p>Чтобы подтвердить регистрацию в RealtX, нажмите кнопку ниже:</p>
        <p style="margin: 32px 0;">
          <a href="${link}" style="background: #111; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Подтвердить email
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">
          Или скопируйте ссылку в браузер:<br>
          <a href="${link}" style="color: #666;">${link}</a>
        </p>
        <p style="color: #666; font-size: 14px;">Ссылка действительна ${TOKEN_TTL_HOURS} часов.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
        <p style="color: #999; font-size: 13px;">
          Если вы не регистрировались в RealtX — просто проигнорируйте это письмо.
        </p>
      </div>
    `;
  }
}
