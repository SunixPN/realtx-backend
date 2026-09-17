import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EstateEntity } from '../estate/entities/estate.entity.js';
import { InternalParserController } from './internal-parser.controller.js';
import { ParserService } from './parser.service.js';
import { DistrictService } from './district.service.js';
import { CurrencyModule } from '../currency/currency.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([EstateEntity]),
    CurrencyModule,
    ConfigModule,
  ],
  controllers: [InternalParserController],
  providers: [ParserService, DistrictService],
  exports: [DistrictService, ParserService],
})
export class ParserModule {}
