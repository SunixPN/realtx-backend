import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ViewedEntity } from './entities/viewed.entity.js';
import { FavoriteEntity } from '../favorite/entities/favorite.entity.js';
import { ViewedController } from './viewed.controller.js';
import { ViewedService } from './viewed.service.js';
import { ViewedCleanupScheduler } from './viewed-cleanup.scheduler.js';
import { CurrencyModule } from '../currency/currency.module.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([ViewedEntity, FavoriteEntity]),
        ScheduleModule.forRoot(),
        CurrencyModule,
    ],
    controllers: [ViewedController],
    providers: [ViewedService, ViewedCleanupScheduler],
    exports: [ViewedService, TypeOrmModule],
})
export class ViewedModule {}
