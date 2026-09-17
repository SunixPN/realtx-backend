import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../user/entities/user.entity.js';

export const ADMIN_DEFAULT_EMAIL = 'admin@admin.com';
export const ADMIN_DEFAULT_PASSWORD = 'admin';

@Injectable()
export class AdminSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeedService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async onApplicationBootstrap() {
    const email = process.env.ADMIN_EMAIL ?? ADMIN_DEFAULT_EMAIL;
    const password = process.env.ADMIN_PASSWORD ?? ADMIN_DEFAULT_PASSWORD;

    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) {
      if (existing.role !== 'admin') {
        await this.userRepo.update({ id: existing.id }, { role: 'admin' });
        this.logger.log(`Пользователь ${email} повышен до admin.`);
      }
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await this.userRepo.save(
      this.userRepo.create({
        email,
        name: 'Admin',
        passwordHash,
        role: 'admin',
        emailVerified: true,
      }),
    );
    this.logger.log(`Создан админ ${email} (пароль: ${password}).`);
  }
}
