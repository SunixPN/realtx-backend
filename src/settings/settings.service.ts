import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter } from 'node:events';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AppSettingEntity } from './entities/app-setting.entity.js';
import { SETTINGS, SETTINGS_BY_KEY } from './settings.keys.js';

export interface SettingChange {
  key: string;
  value: string;
  previous: string | null;
}

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);
  private readonly cache = new Map<string, string>();
  private readonly emitter = new EventEmitter();

  constructor(
    @InjectRepository(AppSettingEntity)
    private readonly repo: Repository<AppSettingEntity>,
    private readonly config: ConfigService,
  ) {
    this.emitter.setMaxListeners(50);
  }

  async onModuleInit() {
    await this.reload();
    await this.seedDefaults();
  }

  private async seedDefaults() {
    for (const def of SETTINGS) {
      if (this.cache.has(def.key)) continue;
      const value = def.default(this.config);
      await this.repo.save({ key: def.key, value });
      this.cache.set(def.key, value);
    }
  }

  async reload() {
    const rows = await this.repo.find();
    this.cache.clear();
    for (const r of rows) this.cache.set(r.key, r.value);
    this.logger.log(`Настройки загружены (${rows.length}).`);
  }

  get(key: string): string {
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;
    const def = SETTINGS_BY_KEY.get(key);
    if (!def) throw new Error(`Unknown setting: ${key}`);
    return def.default(this.config);
  }

  getNumber(key: string): number {
    const raw = this.get(key);
    const n = Number(raw);
    if (!Number.isFinite(n)) throw new Error(`Setting ${key} is not a number: ${raw}`);
    return n;
  }

  async set(key: string, value: string): Promise<SettingChange> {
    if (!SETTINGS_BY_KEY.has(key)) throw new Error(`Unknown setting: ${key}`);
    const previous = this.cache.get(key) ?? null;
    await this.repo.save({ key, value });
    this.cache.set(key, value);
    const change: SettingChange = { key, value, previous };
    this.emitter.emit('change', change);
    this.emitter.emit(`change:${key}`, change);
    return change;
  }

  onChange(listener: (change: SettingChange) => void) {
    this.emitter.on('change', listener);
  }

  onKeyChange(key: string, listener: (change: SettingChange) => void) {
    this.emitter.on(`change:${key}`, listener);
  }
}
