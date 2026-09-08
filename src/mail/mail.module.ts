import { Module, Global } from '@nestjs/common';
import { MailService } from './mail.service.js';

@Global() // делаем глобальным — MailService будет доступен во всех модулях без импорта
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
