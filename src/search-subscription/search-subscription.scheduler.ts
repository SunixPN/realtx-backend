import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { SubscriptionCheckService } from './subscription-check.service.js';
import { SettingsService } from '../settings/settings.service.js';

const JOBS: Array<{ name: string; settingKey: string; frequency: 'instant' | 'daily' | 'weekly' }> = [
    { name: 'subs.instant', settingKey: 'cron.subscriptions.instant', frequency: 'instant' },
    { name: 'subs.daily', settingKey: 'cron.subscriptions.daily', frequency: 'daily' },
    { name: 'subs.weekly', settingKey: 'cron.subscriptions.weekly', frequency: 'weekly' },
];

@Injectable()
export class SearchSubscriptionScheduler implements OnModuleInit {
    private readonly logger = new Logger(SearchSubscriptionScheduler.name);

    constructor(
        private readonly check: SubscriptionCheckService,
        private readonly registry: SchedulerRegistry,
        private readonly settings: SettingsService,
    ) {}

    onModuleInit() {
        for (const j of JOBS) {
            this.register(j.name, j.settingKey, j.frequency);
            this.settings.onKeyChange(j.settingKey, ({ value }) =>
                this.reschedule(j.name, value, j.frequency),
            );
        }
    }

    private handler(frequency: 'instant' | 'daily' | 'weekly') {
        return async () => {
            this.logger.log(`Проверка подписок (${frequency})…`);
            await this.check.runCheck([frequency]);
        };
    }

    private register(name: string, settingKey: string, frequency: 'instant' | 'daily' | 'weekly') {
        const expr = this.settings.get(settingKey);
        const job = new CronJob(expr, this.handler(frequency));
        this.registry.addCronJob(name, job as any);
        job.start();
        this.logger.log(`Cron ${name} = "${expr}"`);
    }

    private reschedule(name: string, expr: string, frequency: 'instant' | 'daily' | 'weekly') {
        try {
            this.registry.deleteCronJob(name);
        } catch {}
        const job = new CronJob(expr, this.handler(frequency));
        this.registry.addCronJob(name, job as any);
        job.start();
        this.logger.log(`Cron ${name} перезапущен: "${expr}"`);
    }
}
