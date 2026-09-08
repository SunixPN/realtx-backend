import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('estates')
export class EstateEntity {
    @PrimaryGeneratedColumn()
    id: number;

    // --- Источник ---
    @Column({ type: 'varchar', unique: true })
    sourceUuid: string; // UUID объявления на realt.by ("00137590-8e4c-11f1-...")

    @Column({ type: 'varchar', nullable: true })
    sourceUnid: string | null; // Короткий код ("SITEJ4VHTS7F")

    @Column({ type: 'varchar', nullable: true })
    sourceUrl: string | null; // Ссылка на объявление

    // --- Контент ---
    @Column({ type: 'varchar', nullable: true })
    headline: string | null;

    @Column({ type: 'text', nullable: true })
    description: string | null;

    // --- Цены (оригинальные из источника) ---
    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
    price: number | null; // Цена в оригинальной валюте

    @Column({ type: 'int', nullable: true })
    priceCurrency: number | null; // 933=BYN, 840=USD, 978=EUR

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    pricePerM2: number | null;

    @Column({ type: 'int', nullable: true })
    priceChangeDirection: number | null; // 0=нет, 1=вверх, -1=вниз

    @Column({ type: 'timestamptz', nullable: true })
    priceChangeDate: Date | null;

    // --- Характеристики ---
    @Column({ type: 'int', nullable: true })
    rooms: number | null;

    @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
    areaTotal: number | null;

    @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
    areaLiving: number | null;

    @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
    areaKitchen: number | null;

    @Column({ type: 'int', nullable: true })
    balconyType: number | null; // числовой код из API

    @Column({ type: 'int', nullable: true })
    storey: number | null;

    @Column({ type: 'int', nullable: true })
    storeys: number | null;

    @Column({ type: 'int', nullable: true })
    buildingYear: number | null;

    @Column({ type: 'int', nullable: true })
    wallMaterial: number | null; // числовой код (панель/кирпич/монолит)

    @Column({ type: 'int', nullable: true })
    repairState: number | null; // числовой код (без ремонта/евро/и тд)

    // --- Локация ---
    @Column({ type: 'varchar', nullable: true })
    address: string | null;

    @Column({ type: 'varchar', nullable: true })
    townName: string | null;

    @Column({ type: 'varchar', nullable: true })
    districtName: string | null;

    @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
    lat: number | null;

    @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
    lng: number | null;

    // --- Метро ---
    @Column({ type: 'varchar', nullable: true })
    metroStation: string | null;

    @Column({ type: 'int', nullable: true })
    metroLineId: number | null;

    @Column({ type: 'int', nullable: true })
    metroTime: number | null;

    // --- Фото ---
    @Column({ type: 'jsonb', default: '[]' })
    photos: string[];

    // --- Продавец ---
    @Column({ type: 'int', nullable: true })
    sellerType: number | null; // 0=агентство, 1=собственник

    @Column({ type: 'varchar', nullable: true })
    agencyName: string | null;

    @Column({ type: 'varchar', nullable: true })
    agencyUuid: string | null;

    // --- История цен ---
    @Column({ type: 'jsonb', default: '[]' })
    priceHistory: { date: string; price: number; currency: number }[];

    // --- Статус ---
    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    // --- Даты объявления ---
    @Column({ type: 'timestamptz', nullable: true })
    publishedAt: Date | null;

    @Column({ type: 'timestamptz', nullable: true })
    sourceUpdatedAt: Date | null;

    // --- Системные даты ---
    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
