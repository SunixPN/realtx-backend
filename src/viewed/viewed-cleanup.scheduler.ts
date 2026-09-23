import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { ViewedService } from './viewed.service.js';
import { SettingsService } from '../settings/settings.service.js';

const JOB_NAME = 'viewed.cleanup';
const CRON_KEY = 'cron.viewed.cleanup';
const RETENTION_KEY = 'viewed.retentionDays';

@Injectable()
export class ViewedCleanupScheduler implements OnModuleInit {
    private readonly logger = new Logger(ViewedCleanupScheduler.name);

    constructor(
        private readonly viewed: ViewedService,
        private readonly registry: SchedulerRegistry,
        private readonly settings: SettingsService,
    ) {}

    onModuleInit() {
        this.register();
        this.settings.onKeyChange(CRON_KEY, ({ value }) => this.reschedule(value));
    }

    private handler() {
        return async () => {
            const days = Number(this.settings.get(RETENTION_KEY)) || 30;
            const deleted = await this.viewed.deleteOlderThan(days);
            if (deleted > 0) this.logger.log(`Удалено просмотров старше ${days} дней: ${deleted}`);
        };
    }

    private register() {
        const expr = this.settings.get(CRON_KEY);
        const job = new CronJob(expr, this.handler());
        this.registry.addCronJob(JOB_NAME, job as any);
        job.start();
        this.logger.log(`Cron ${JOB_NAME} = "${expr}"`);
    }

    private reschedule(expr: string) {
        try { this.registry.deleteCronJob(JOB_NAME); } catch {}
        const job = new CronJob(expr, this.handler());
        this.registry.addCronJob(JOB_NAME, job as any);
        job.start();
        this.logger.log(`Cron ${JOB_NAME} перезапущен: "${expr}"`);
    }
}
