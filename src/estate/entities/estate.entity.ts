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
    @Column({ type: 'int', unique: true })
    sourceId: number;

    @Column({ type: 'varchar' })
    sourceUrl: string;

    // --- Контент ---
    @Column({ type: 'varchar', nullable: true })
    headline: string | null;

    @Column({ type: 'text', nullable: true })
    description: string | null;

    // --- Цены ---
    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
    priceUsd: number | null;

    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
    priceByn: number | null;

    @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
    priceEur: number | null;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    pricePerM2Usd: number | null;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    pricePerM2Byn: number | null;

    @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
    pricePerM2Eur: number | null;

    @Column({ type: 'varchar', nullable: true })
    priceCurrencyOriginal: string | null;

    // --- Характеристики ---
    @Column({ type: 'int', nullable: true })
    rooms: number | null;

    @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
    areaTotal: number | null;

    @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
    areaLiving: number | null;

    @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
    areaKitchen: number | null;

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    areaBalcony: number | null;

    @Column({ type: 'int', nullable: true })
    storey: number | null;

    @Column({ type: 'int', nullable: true })
    storeys: number | null;

    @Column({ type: 'int', nullable: true })
    buildingYear: number | null;

    @Column({ type: 'varchar', nullable: true })
    houseType: string | null;

    @Column({ type: 'varchar', nullable: true })
    repairState: string | null;

    // --- Локация ---
    @Column({ type: 'varchar', nullable: true })
    address: string | null;

    @Column({ type: 'varchar', nullable: true })
    town: string | null;

    @Column({ type: 'varchar', nullable: true })
    district: string | null;

    @Column({ type: 'varchar', nullable: true })
    subDistrict: string | null;

    @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
    lat: number | null;

    @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
    lng: number | null;

    // Координаты строкой как пришли из источника
    @Column({ type: 'varchar', nullable: true })
    coordsRaw: string | null;

    // --- Метро ---
    @Column({ type: 'varchar', nullable: true })
    metroStation: string | null;

    @Column({ type: 'varchar', nullable: true })
    metroLine: string | null;

    @Column({ type: 'int', nullable: true })
    metroTime: number | null;

    @Column({ type: 'jsonb', default: '[]' })
    metroNearest: { station: string; line: string; time: number | null }[];

    // --- Фото ---
    @Column({ type: 'jsonb', default: '[]' })
    photos: string[];

    @Column({ type: 'int', default: 0 })
    photosCount: number;

    // --- Продавец ---
    @Column({ type: 'varchar', nullable: true })
    sellerType: 'agency' | 'owner' | null;

    @Column({ type: 'varchar', nullable: true })
    sellerName: string | null;

    // --- Даты объявления ---
    @Column({ type: 'timestamptz', nullable: true })
    publishedAt: Date | null;

    @Column({ type: 'int', nullable: true })
    daysOnMarket: number | null;

    // --- История цен ---
    @Column({ type: 'jsonb', default: '[]' })
    priceHistory: {
        date: string;
        priceUsd: number | null;
        priceByn: number | null;
    }[];

    // --- Статус ---
    @Column({ type: 'boolean', default: true })
    isActive: boolean;

    // --- Системные даты ---
    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
