import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSettingEntity } from './entities/app-setting.entity.js';
import { SettingsService } from './settings.service.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AppSettingEntity])],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
