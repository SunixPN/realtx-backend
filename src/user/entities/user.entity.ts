import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { RefreshTokenEntity } from '../../auth/entities/refresh.entity.js';

export type UserCurrency = 'USD' | 'BYN' | 'EUR';
export type UserTheme = 'light' | 'dark' | 'system';
export type UserLanguage = 'ru' | 'en' | 'be';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // --- Идентификация ---
  @Column({ type: 'varchar', nullable: true })
  name: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  email: string | null;

  @Column({ type: 'boolean', default: false })
  emailVerified: boolean;

  @Column({ type: 'varchar', unique: true, nullable: true })
  phone: string | null;

  @Column({ type: 'boolean', default: false })
  phoneVerified: boolean;

  @Column({ type: 'varchar', nullable: true })
  city: string | null;

  // --- Авторизация ---
  // Хеш пароля. NULL = вход только через OAuth/magic link
  @Column({ type: 'varchar', nullable: true, select: false })
  passwordHash: string | null;

  // ID пользователя в Google — если входит через Google OAuth
  @Column({ type: 'varchar', unique: true, nullable: true })
  googleId: string | null;

  // Chat ID в Telegram — для входа и уведомлений через бота
  @Column({ type: 'bigint', unique: true, nullable: true })
  telegramId: string | null;

  // --- Настройки отображения ---
  @Column({ type: 'varchar', default: 'USD' })
  currency: UserCurrency;

  @Column({ type: 'varchar', default: 'system' })
  theme: UserTheme;

  @Column({ type: 'varchar', default: 'ru' })
  language: UserLanguage;

  // --- Настройки уведомлений ---
  @Column({ type: 'boolean', default: true })
  notifyByEmail: boolean;

  @Column({ type: 'boolean', default: false })
  notifyByTelegram: boolean;

  @Column({ type: 'boolean', default: false })
  weeklyDigest: boolean;

  // --- Приватность ---
  @Column({ type: 'boolean', default: true })
  syncHistory: boolean;

  @Column({ type: 'boolean', default: true })
  personalRecommendations: boolean;

  // --- Роль ---
  @Column({ type: 'varchar', default: 'user' })
  role: 'user' | 'admin';

  // --- Системные ---
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt: Date | null;

  // --- Связи ---
  @OneToMany(() => RefreshTokenEntity, (token) => token.user)
  refreshTokens: Relation<RefreshTokenEntity[]>;
}
