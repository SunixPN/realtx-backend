import { Module, forwardRef } from '@nestjs/common';
import {TypeOrmModule} from "@nestjs/typeorm";
import {EstateEntity} from "./entities/estate.entity.js";
import { FavoriteEntity } from '../favorite/entities/favorite.entity.js';
import {EstateController} from "./estate.controller.js";
import {EstateService} from "./estate.service.js";
import { CurrencyModule } from '../currency/currency.module.js';

@Module({
    imports: [
        TypeOrmModule.forFeature([EstateEntity, FavoriteEntity]),
        forwardRef(() => CurrencyModule),
    ],
    controllers: [EstateController],
    providers: [EstateService],
    exports: [EstateService],
})
export class EstateModule {
}
