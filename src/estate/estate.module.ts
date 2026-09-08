import { Module } from '@nestjs/common';
import {TypeOrmModule} from "@nestjs/typeorm";
import {EstateEntity} from "./entities/estate.entity.js";
import {EstateController} from "./estate.controller.js";
import {EstateService} from "./estate.service.js";

@Module({
    imports: [
        TypeOrmModule.forFeature([EstateEntity]),
    ],
    controllers: [EstateController],
    providers: [EstateService],
})
export class EstateModule {
}
