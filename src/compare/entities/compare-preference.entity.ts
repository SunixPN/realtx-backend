import { BaseEntity, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn, Column, type Relation } from 'typeorm';
import { UserEntity } from '../../user/entities/user.entity.js';

@Entity('compare_preferences')
export class ComparePreferenceEntity extends BaseEntity {
    @PrimaryColumn({ type: 'uuid' })
    userId: string;

    @OneToOne(() => UserEntity, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: Relation<UserEntity>;

    @Column({ type: 'text', array: true, default: () => "'{}'::text[]" })
    hiddenRows: string[];

    @UpdateDateColumn()
    updatedAt: Date;
}
