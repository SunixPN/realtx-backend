import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FavoriteEntity } from './entities/favorite.entity.js';
import { CompareItemEntity } from '../compare/entities/compare-item.entity.js';
import { EstateEntity } from '../estate/entities/estate.entity.js';
import { FavoriteController } from './favorite.controller.js';
import { FavoriteService } from './favorite.service.js';
import { CurrencyModule } from '../currency/currency.module.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([FavoriteEntity, EstateEntity, CompareItemEntity]),
        CurrencyModule,
    ],
    controllers: [FavoriteController],
    providers: [FavoriteService],
})
export class FavoriteModule {}
