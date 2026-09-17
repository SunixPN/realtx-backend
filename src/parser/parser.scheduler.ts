import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { ParserService } from './parser.service.js';
import { SettingsService } from '../settings/settings.service.js';

const JOB_PARSE = 'parser.parseAll';
const JOB_VALIDATE = 'parser.validate';

@Injectable()
export class ParserScheduler implements OnModuleInit {
  private readonly logger = new Logger(ParserScheduler.name);

  constructor(
    private readonly parserService: ParserService,
    private readonly registry: SchedulerRegistry,
    private readonly settings: SettingsService,
  ) {}

  onModuleInit() {
    this.registerJob(JOB_PARSE, 'cron.parser.parseAll', () => this.runParse());
    this.registerJob(JOB_VALIDATE, 'cron.parser.validate', () => this.runValidate());

    this.settings.onKeyChange('cron.parser.parseAll', ({ value }) =>
      this.reschedule(JOB_PARSE, value, () => this.runParse()),
    );
    this.settings.onKeyChange('cron.parser.validate', ({ value }) =>
      this.reschedule(JOB_VALIDATE, value, () => this.runValidate()),
    );
  }

  private registerJob(name: string, settingKey: string, handler: () => Promise<void>) {
    const expr = this.settings.get(settingKey);
    const job = new CronJob(expr, handler);
    this.registry.addCronJob(name, job as any);
    job.start();
    this.logger.log(`Cron ${name} = "${expr}"`);
  }

  private reschedule(name: string, expr: string, handler: () => Promise<void>) {
    try {
      this.registry.deleteCronJob(name);
    } catch {}
    const job = new CronJob(expr, handler);
    this.registry.addCronJob(name, job as any);
    job.start();
    this.logger.log(`Cron ${name} перезапущен: "${expr}"`);
  }

  private async runParse() {
    this.logger.log('Запуск ежедневного парсинга realt.by...');
    await this.parserService.parseAll();
    this.logger.log('Парсинг завершён.');
  }

  private async runValidate() {
    this.logger.log('Запуск валидации активных объявлений...');
    await this.parserService.validateActiveListings();
    this.logger.log('Валидация завершена.');
  }
}
