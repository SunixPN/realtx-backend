import { Inject, Injectable, Logger, OnModuleInit, forwardRef } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrencyRateEntity } from './entities/currency-rate.entity.js';
import { CurrencyRatesService } from './currency-rates.service.js';
import { EstateService } from '../estate/estate.service.js';

/**
 * Раз в день в 05:15 (до парсинга в 06:00): забираем курсы из НБ РБ и
 * пересчитываем денормализованные priceUsd/Byn/Eur у всех объявлений.
 * onModuleInit — bootstrap, если сегодняшней записи ещё нет.
 */
@Injectable()
export class CurrencyRatesScheduler implements OnModuleInit {
    private readonly logger = new Logger(CurrencyRatesScheduler.name);

    constructor(
        private readonly currencyRates: CurrencyRatesService,
        @Inject(forwardRef(() => EstateService))
        private readonly estateService: EstateService,
        @InjectRepository(CurrencyRateEntity)
        private readonly ratesRepo: Repository<CurrencyRateEntity>,
    ) {}

    async onModuleInit() {
        const today = new Date().toISOString().slice(0, 10);
        const existing = await this.ratesRepo.findOne({ where: { effectiveOn: today } });
        if (existing) return;
        try {
            await this.refresh();
        } catch (e) {
            this.logger.error('Bootstrap-фетч курсов не удался: ' + (e as Error).message);
        }
    }

    @Cron('15 5 * * *')
    async daily() {
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
