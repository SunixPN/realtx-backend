import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompareItemEntity } from './entities/compare-item.entity.js';
import { ComparePreferenceEntity } from './entities/compare-preference.entity.js';
import { EstateEntity } from '../estate/entities/estate.entity.js';
import { CompareController } from './compare.controller.js';
import { CompareService } from './compare.service.js';
import { CurrencyModule } from '../currency/currency.module.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([CompareItemEntity, ComparePreferenceEntity, EstateEntity]),
        CurrencyModule,
    ],
    controllers: [CompareController],
    providers: [CompareService],
    exports: [TypeOrmModule],
})
export class CompareModule {}
