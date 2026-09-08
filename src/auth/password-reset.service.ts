import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../user/entities/user.entity.js';
import { RefreshTokenEntity } from './entities/refresh.entity.js';
import { PasswordResetTokenEntity } from './entities/password-reset.entity.js';
import { MailService } from '../mail/mail.service.js';

const TOKEN_TTL_MINUTES = 15;
const BCRYPT_ROUNDS = 12;

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,

    @InjectRepository(PasswordResetTokenEntity)
    private readonly tokenRepo: Repository<PasswordResetTokenEntity>,

    @InjectRepository(RefreshTokenEntity)
    private readonly refreshRepo: Repository<RefreshTokenEntity>,

    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Шаг 1: запрос сброса пароля.
   * Намеренно возвращает одинаковый ответ независимо от того,
   * существует ли email — предотвращаем утечку информации о наличии аккаунта.
   */
  async requestReset(email: string): Promise<void> {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();

    if (!user || !user.passwordHash) {
      // Тихо логируем, но не выбрасываем ошибку — anti-enumeration
      this.logger.log(`Запрос сброса пароля для несуществующего/OAuth аккаунта: ${email}`);
      return;
    }

    // Удаляем предыдущие токены сброса — только один токен в любой момент
    await this.tokenRepo.delete({ userId: user.id });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    await this.tokenRepo.save(
      this.tokenRepo.create({
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000),
      }),
    );

    const frontendUrl = this.config.get<string>('FRONTEND_URL');
    const link = `${frontendUrl}/reset/new?token=${rawToken}`;

    await this.mailService.send({
      to: user.email!,
      subject: 'Сброс пароля — RealtX',
      html: this.buildHtml(user.name ?? 'пользователь', link),
    });

    this.logger.log(`Письмо для сброса пароля отправлено юзеру ${user.id}`);
  }

  /**
   * Шаг 2: проверка токена из ссылки.
   * Фронт вызывает при монтировании /reset/new, чтобы показать форму
   * или экран «ссылка протухла». Токен НЕ удаляется — он ещё нужен для confirm.
   */
  async verifyToken(rawToken: string): Promise<void> {
    const record = await this.findValidRecord(rawToken);
    // Если дошли сюда — токен валиден, просто возвращаем 200
    void record;
  }

  /**
   * Шаг 3: установка нового пароля.
   * Токен удаляется, все активные refresh-сессии инвалидируются.
   */
  async confirmReset(rawToken: string, newPassword: string): Promise<void> {
    const record = await this.findValidRecord(rawToken);

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.userRepo.update(record.userId, { passwordHash });

    // Удаляем все сессии — раз пароль скомпрометирован, сессии тоже небезопасны
    await this.refreshRepo.delete({ userId: record.userId });

    // Удаляем токен только после успешного сброса
    await this.tokenRepo.delete(record.id);

    this.logger.log(`Пароль сброшен для юзера ${record.userId}`);
  }

  // Общая проверка токена — используется в verifyToken и confirmReset
  private async findValidRecord(rawToken: string): Promise<PasswordResetTokenEntity> {
    const tokenHash = this.hashToken(rawToken);

    const record = await this.tokenRepo.findOne({ where: { tokenHash } });

    if (!record) {
      throw new NotFoundException('Ссылка недействительна или уже использована');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Срок действия ссылки истёк');
    }

    return record;
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private buildHtml(userName: string, link: string): string {
    return `
      <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #111;">Сброс пароля</h2>
        <p>Здравствуйте, ${userName}!</p>
        <p>Мы получили запрос на сброс пароля от вашего аккаунта в RealtX. Нажмите кнопку ниже, чтобы установить новый пароль:</p>
        <p style="margin: 32px 0;">
          <a href="${link}" style="background: #111; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Установить новый пароль
          </a>
        </p>
        <p style="color: #666; font-size: 14px;">
          Или скопируйте ссылку в браузер:<br>
          <a href="${link}" style="color: #666;">${link}</a>
        </p>
        <p style="color: #666; font-size: 14px;">Ссылка действительна ${TOKEN_TTL_MINUTES} минут.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">
        <p style="color: #999; font-size: 13px;">
          Если вы не запрашивали сброс пароля — просто проигнорируйте это письмо.
          Ваш пароль останется прежним.
        </p>
      </div>
    `;
  }
}
