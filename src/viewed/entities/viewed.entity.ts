import { BaseEntity, Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { UserEntity } from '../../user/entities/user.entity.js';
import { EstateEntity } from '../../estate/entities/estate.entity.js';

@Entity('viewed_estates')
@Index('IDX_viewed_user_time', ['userId', 'viewedAt'])
export class ViewedEntity extends BaseEntity {
    @PrimaryColumn({ type: 'uuid' })
    userId: string;

    @PrimaryColumn({ type: 'int' })
    estateId: number;

    // Обновляется при каждом повторном просмотре — вручную через orUpdate,
    // потому что @UpdateDateColumn триггерится только UPDATE, не upsert.
    @Column({ type: 'timestamp with time zone', default: () => 'now()' })
    viewedAt: Date;

    @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: Relation<UserEntity>;

    @ManyToOne(() => EstateEntity, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'estateId' })
    estate: Relation<EstateEntity>;
}
