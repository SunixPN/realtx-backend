import { Inject, Injectable, Logger, OnModuleInit, forwardRef } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrencyRateEntity } from './entities/currency-rate.entity.js';
import { CurrencyRatesService } from './currency-rates.service.js';
import { EstateService } from '../estate/estate.service.js';
import { SettingsService } from '../settings/settings.service.js';

const JOB = 'currency.refresh';
const KEY = 'cron.currency.refresh';

@Injectable()
export class CurrencyRatesScheduler implements OnModuleInit {
    private readonly logger = new Logger(CurrencyRatesScheduler.name);

    constructor(
        private readonly currencyRates: CurrencyRatesService,
        @Inject(forwardRef(() => EstateService))
        private readonly estateService: EstateService,
        @InjectRepository(CurrencyRateEntity)
        private readonly ratesRepo: Repository<CurrencyRateEntity>,
        private readonly registry: SchedulerRegistry,
        private readonly settings: SettingsService,
    ) {}

    async onModuleInit() {
        // Bootstrap: если сегодняшних курсов нет — фетчим сразу.
        const today = new Date().toISOString().slice(0, 10);
        const existing = await this.ratesRepo.findOne({ where: { effectiveOn: today } });
        if (!existing) {
            try {
                await this.refresh();
            } catch (e) {
                this.logger.error('Bootstrap-фетч курсов не удался: ' + (e as Error).message);
            }
        }

        this.register(this.settings.get(KEY));
        this.settings.onKeyChange(KEY, ({ value }) => this.reschedule(value));
    }

    private register(expr: string) {
        const job = new CronJob(expr, () => this.safeRefresh());
        this.registry.addCronJob(JOB, job as any);
        job.start();
        this.logger.log(`Cron ${JOB} = "${expr}"`);
    }

    private reschedule(expr: string) {
        try {
            this.registry.deleteCronJob(JOB);
        } catch {}
        this.register(expr);
    }

    private async safeRefresh() {
        try {
            await this.refresh();
        } catch (e) {
            this.logger.error('Cron курсов упал: ' + (e as Error).message);
        }
    }

    private async refresh() {
        await this.currencyRates.fetchAndSaveFromNbrb();
        const affected = await this.estateService.recomputePrices();
        this.logger.log(`Пересчитаны цены у ${affected} объявлений.`);
    }
}
