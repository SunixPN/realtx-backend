import { Controller, HttpCode, HttpStatus, Post, Inject, forwardRef } from '@nestjs/common';
import { CurrencyRatesService } from './currency-rates.service.js';
import { EstateService } from '../estate/estate.service.js';
import { Public } from '../auth/decorators/public.decorator.js';

/**
 * Утилитарный контроллер для ручного триггера. В проде вызывается один раз
 * после деплоя, чтобы первично заполнить priceUsd/Byn/Eur у существующих
 * объявлений (дальше это делает CurrencyRatesScheduler).
 */
@Controller('currency')
export class CurrencyController {
    constructor(
        private readonly currencyRates: CurrencyRatesService,
        @Inject(forwardRef(() => EstateService))
        private readonly estateService: EstateService,
    ) {}

    @Public()
    @Post('refresh')
    @HttpCode(HttpStatus.ACCEPTED)
    async refresh() {
        const rate = await this.currencyRates.fetchAndSaveFromNbrb();
        const affected = await this.estateService.recomputePrices();
        return { effectiveOn: rate.effectiveOn, affected };
    }

    @Public()
    @Post('recompute')
    @HttpCode(HttpStatus.ACCEPTED)
    async recompute() {
        const affected = await this.estateService.recomputePrices();
        return { affected };
    }
}
