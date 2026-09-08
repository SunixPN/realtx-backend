import { Module } from '@nestjs/common';
import {TypeOrmModule} from "@nestjs/typeorm";
import { EstateModule } from './estate/estate.module.js';
import {ConfigModule, ConfigService} from "@nestjs/config";
import {EstateEntity} from "./estate/entities/estate.entity.js";

@Module({
  imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (config: ConfigService) => ({
              type: 'postgres',
              host: config.get("DB_HOST"),
              port: config.get<number>("DB_PORT"),
              username: config.get("DB_USER"),
              password: config.get("DB_PASSWORD"),
              database: config.get("DB_NAME"),
              entities: [EstateEntity],
              synchronize: true,
          }),
          inject: [ConfigService],
      }),
      EstateModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
