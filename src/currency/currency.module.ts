import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurrencyRateEntity } from './entities/currency-rate.entity.js';
import { CurrencyRatesService } from './currency-rates.service.js';
import { CurrencyRatesScheduler } from './currency-rates.scheduler.js';
import { CurrencyController } from './currency.controller.js';
import { EstateModule } from '../estate/estate.module.js';

@Module({
    imports: [
        ScheduleModule.forRoot(),
        TypeOrmModule.forFeature([CurrencyRateEntity]),
        forwardRef(() => EstateModule),
    ],
    controllers: [CurrencyController],
    providers: [CurrencyRatesService, CurrencyRatesScheduler],
    exports: [CurrencyRatesService],
})
export class CurrencyModule {}
