import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { ViewedEntity } from './entities/viewed.entity.js';
import { GetViewedDto } from './dto/get-viewed.dto.js';
import {
    CurrencyRatesService,
    CURRENCY_USD,
    CURRENCY_BYN,
    CURRENCY_EUR,
} from '../currency/currency-rates.service.js';

const CURRENCY_CODE: Record<'USD' | 'BYN' | 'EUR', number> = {
    USD: CURRENCY_USD,
    BYN: CURRENCY_BYN,
    EUR: CURRENCY_EUR,
};

const PRICE_COL: Record<'USD' | 'BYN' | 'EUR', 'priceUsd' | 'priceByn' | 'priceEur'> = {
    USD: 'priceUsd',
    BYN: 'priceByn',
    EUR: 'priceEur',
};

const PER_M2_COL: Record<'USD' | 'BYN' | 'EUR', 'pricePerM2Usd' | 'pricePerM2Byn' | 'pricePerM2Eur'> = {
    USD: 'pricePerM2Usd',
    BYN: 'pricePerM2Byn',
    EUR: 'pricePerM2Eur',
};

type ViewedItem = {
    id: number;
    viewedAt: string;
    price: number | null;
    pricePerM2: number | null;
    priceCurrency: number;
    priceChangeDirection: number | null;
    rooms: number | null;
    areaTotal: number | null;
    storey: number | null;
    storeys: number | null;
    address: string | null;
    photos: string[];
    metroStation: string | null;
    metroTime: number | null;
    sellerType: number | null;
    agencyName: string | null;
    isActive: boolean;
    publishedAt: string | null;
    sourceUrl: string | null;
    headline: string | null;
};

@Injectable()
export class ViewedService {
    constructor(
        @InjectRepository(ViewedEntity)
        private readonly viewedRepo: Repository<ViewedEntity>,
        // Currency service инжектим для симметрии с FavoriteService — здесь пока
        // без дельт цен, но зарезервировано под будущее расширение.
        private readonly _currencyRates: CurrencyRatesService,
    ) {}

    async getViewed(userId: string, dto: GetViewedDto): Promise<ViewedItem[]> {
        const currency = dto.displayCurrency ?? 'USD';
        const priceCol = PRICE_COL[currency];
        const perM2Col = PER_M2_COL[currency];
        const currencyCode = CURRENCY_CODE[currency];

        const rows = await this.viewedRepo.find({
            where: { userId },
            relations: { estate: true } as any,
            order: { viewedAt: 'DESC' },
        });

        return rows.map(v => {
            const e = v.estate;
            return {
                id: e.id,
                viewedAt: v.viewedAt.toISOString(),
                price: e[priceCol] as number | null,
                pricePerM2: e[perM2Col] as number | null,
                priceCurrency: currencyCode,
                priceChangeDirection: e.priceChangeDirection,
                rooms: e.rooms,
                areaTotal: e.areaTotal,
                storey: e.storey,
                storeys: e.storeys,
                address: e.address,
                photos: e.photos,
                metroStation: e.metroStation,
                metroTime: e.metroTime,
                sellerType: e.sellerType,
                agencyName: e.agencyName,
                isActive: e.isActive,
                publishedAt: e.publishedAt?.toISOString() ?? null,
                sourceUrl: e.sourceUrl,
                headline: e.headline,
            };
        });
    }

    async getViewedIds(userId: string): Promise<{ ids: number[] }> {
        const rows = await this.viewedRepo.find({
            where: { userId },
            select: { estateId: true },
        });
        return { ids: rows.map(r => r.estateId) };
    }

    async logView(userId: string, estateId: number): Promise<void> {
        // Upsert: при повторе двигаем viewedAt на now, чтобы объект всплыл
        // в топ истории. orIgnore не подходит — время не обновится.
        await this.viewedRepo
            .createQueryBuilder()
            .insert()
            .into(ViewedEntity)
            .values({ userId, estateId, viewedAt: new Date() })
            .orUpdate(['viewedAt'], ['userId', 'estateId'])
            .execute();
    }

    async removeViewed(userId: string, estateId: number): Promise<void> {
        await this.viewedRepo.delete({ userId, estateId });
    }

    async clearAll(userId: string): Promise<void> {
        await this.viewedRepo.delete({ userId });
    }

    async deleteOlderThan(days: number): Promise<number> {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const res = await this.viewedRepo.delete({ viewedAt: LessThan(cutoff) });
        return res.affected ?? 0;
    }
}
