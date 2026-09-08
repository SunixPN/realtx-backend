import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuthService } from './auth.service.js';

@Injectable()
export class TokenCleanupService {
  private readonly logger = new Logger(TokenCleanupService.name);

  constructor(private readonly authService: AuthService) {}

  // Каждый день в 03:00 — удаляем истёкшие refresh-токены
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredTokens(): Promise<void> {
    const deleted = await this.authService.deleteExpiredTokens();
    this.logger.log(`Очистка токенов: удалено ${deleted} истёкших записей`);
  }
}
