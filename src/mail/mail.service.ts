import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

interface SendMailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      throw new Error('RESEND_API_KEY не задан в .env');
    }
    this.resend = new Resend(apiKey);

    const email = this.config.get<string>('MAIL_FROM');
    const name = this.config.get<string>('MAIL_FROM_NAME');
    this.from = name ? `${name} <${email}>` : email!;
  }

  async send({ to, subject, html, text }: SendMailParams): Promise<void> {
    const { data, error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject,
      html,
      text: text ?? this.stripHtml(html),
    });

    if (error) {
      this.logger.error(`Ошибка отправки письма на ${to}: ${error.message}`);
      throw new Error(`Не удалось отправить письмо: ${error.message}`);
    }

    this.logger.log(`Письмо отправлено на ${to} (id: ${data?.id})`);
  }

  // Грубое удаление HTML тегов для plain-text версии
  private stripHtml(html: string): string {
    return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  }
}
