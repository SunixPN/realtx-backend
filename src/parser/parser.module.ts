import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EstateEntity } from '../estate/entities/estate.entity.js';
import { ParserController } from './parser.controller.js';
import { ParserScheduler } from './parser.scheduler.js';
import { ParserService } from './parser.service.js';
import { DistrictService } from './district.service.js';
import { CurrencyModule } from '../currency/currency.module.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([EstateEntity]),
    CurrencyModule,
  ],
  controllers: [ParserController],
  providers: [ParserService, ParserScheduler, DistrictService],
  exports: [DistrictService],
})
export class ParserModule {}
