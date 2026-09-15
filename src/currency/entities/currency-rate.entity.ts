import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Ежедневный снапшот курсов НБ РБ. Одна строка на дату публикации.
 * BYN — базовая валюта, поэтому храним только USD→BYN и EUR→BYN;
 * кросс-курсы USD↔EUR считаются в сервисе через BYN как pivot.
 */
@Entity('currency_rates')
export class CurrencyRateEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Index({ unique: true })
    @Column({ type: 'date' })
    effectiveOn: string;

    // Сколько BYN отдаётся за 1 USD (уже нормализованный курс, с учётом Cur_Scale).
    @Column({ type: 'decimal', precision: 12, scale: 6 })
    usdToByn: string;

    @Column({ type: 'decimal', precision: 12, scale: 6 })
    eurToByn: string;

    @UpdateDateColumn()
    fetchedAt: Date;
}
