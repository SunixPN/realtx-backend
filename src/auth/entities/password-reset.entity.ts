import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { UserEntity } from '../../user/entities/user.entity.js';

@Entity('password_reset_tokens')
export class PasswordResetTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<UserEntity>;

  // Хеш токена — сам токен уходит только в письмо
  @Column({ unique: true })
  tokenHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
