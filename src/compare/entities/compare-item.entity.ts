import { BaseEntity, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn, type Relation } from 'typeorm';
import { UserEntity } from '../../user/entities/user.entity.js';
import { EstateEntity } from '../../estate/entities/estate.entity.js';

@Entity('compare_items')
export class CompareItemEntity extends BaseEntity {
    @PrimaryColumn({ type: 'uuid' })
    userId: string;

    @PrimaryColumn({ type: 'int' })
    estateId: number;

    @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: Relation<UserEntity>;

    @ManyToOne(() => EstateEntity, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'estateId' })
    estate: Relation<EstateEntity>;

    @CreateDateColumn()
    createdAt: Date;
}
