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

@Entity('refresh_tokens')
export class RefreshTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, (user) => user.refreshTokens, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: Relation<UserEntity>;

  @Column({ unique: true })
  tokenHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'varchar', nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', nullable: true })
  ipAddress: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
