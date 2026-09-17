import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
    type Relation,
} from 'typeorm';
import { UserEntity } from '../../user/entities/user.entity.js';

export type SubscriptionFrequency = 'instant' | 'daily' | 'weekly';
export type SubscriptionTrigger = 'new' | 'price-down';
export type SubscriptionChannel = 'email';

@Entity('search_subscriptions')
@Index(['userId', 'createdAt'])
export class SearchSubscriptionEntity extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    userId: string;

    @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: Relation<UserEntity>;

    @Column({ type: 'varchar', length: 120 })
    name: string;

    // Снимок фильтров EstateFilterBaseDto + displayCurrency. Храним JSONB —
    // структура фильтров эволюционирует, а миграции полей нам не нужны.
    @Column({ type: 'jsonb' })
    filters: Record<string, unknown>;

    @Column({ type: 'varchar', length: 16, default: 'instant' })
    frequency: SubscriptionFrequency;

    @Column({ type: 'text', array: true, default: () => `ARRAY['new']::text[]` })
    triggers: SubscriptionTrigger[];

    @Column({ type: 'text', array: true, default: () => `ARRAY['email']::text[]` })
    channels: SubscriptionChannel[];

    @Column({ type: 'boolean', default: false })
    quietHours: boolean;

    @Column({ type: 'boolean', default: false })
    paused: boolean;

    @Column({ type: 'timestamptz', nullable: true })
    lastCheckedAt: Date | null;

    // Счётчик непросмотренных совпадений после проверок. Инкрементится в
    // SubscriptionCheckService при каждой удачной рассылке, обнуляется когда
    // пользователь переходит на список объектов (mark-seen).
    @Column({ type: 'int', default: 0 })
    fresh: number;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
