import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ParserService } from './parser.service.js';

@Injectable()
export class ParserScheduler {
  private readonly logger = new Logger(ParserScheduler.name);

  constructor(private readonly parserService: ParserService) {}

  // Каждый день в 06:00
  @Cron('0 6 * * *')
  async runDailyParse() {
    this.logger.log('Запуск ежедневного парсинга realt.by...');
    await this.parserService.parseAll();
    this.logger.log('Парсинг завершён.');
  }

  // Каждый день в 08:00 — после парсинга, чтобы деактивировать фантомы
  // которые API realt.by возвращает, но страница которых уже не существует.
  @Cron('0 8 * * *')
  async runDailyValidate() {
    this.logger.log('Запуск валидации активных объявлений...');
    await this.parserService.validateActiveListings();
    this.logger.log('Валидация завершена.');
  }
}
