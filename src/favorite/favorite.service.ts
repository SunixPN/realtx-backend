import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FavoriteEntity } from './entities/favorite.entity.js';
import { EstateEntity } from '../estate/entities/estate.entity.js';
import { GetFavoritesDto } from './dto/get-favorites.dto.js';
import {
    CurrencyRatesService,
    CURRENCY_USD,
    CURRENCY_BYN,
    CURRENCY_EUR,
} from '../currency/currency-rates.service.js';
import { CurrencyRateEntity } from '../currency/entities/currency-rate.entity.js';

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

type FavoriteItem = {
    id: number;
    favoritedAt: string;
    price: number | null;
    pricePerM2: number | null;
    priceCurrency: number;
    priceChangeDirection: number | null;
    priceDeltaUsd: number | null;
    rooms: number | null;
    areaTotal: number | null;
    storey: number | null;
    storeys: number | null;
    address: string | null;
    photos: string[];
    metroStation: string | null;
    metroTime: number | null;
    sellerType: number | null;
    isActive: boolean;
    publishedAt: string | null;
    sourceUrl: string | null;
    headline: string | null;
};

@Injectable()
export class FavoriteService {
    constructor(
        @InjectRepository(FavoriteEntity)
        private readonly favoriteRepo: Repository<FavoriteEntity>,
        @InjectRepository(EstateEntity)
        private readonly estateRepo: Repository<EstateEntity>,
        private readonly currencyRates: CurrencyRatesService,
    ) {}

    async getFavorites(userId: string, dto: GetFavoritesDto): Promise<FavoriteItem[]> {
        const currency = dto.displayCurrency ?? 'USD';
        const priceCol = PRICE_COL[currency];
        const perM2Col = PER_M2_COL[currency];
        const currencyCode = CURRENCY_CODE[currency];

        const favorites = await this.favoriteRepo.find({
            where: { userId },
            relations: { estate: true } as any,
            order: { createdAt: 'DESC' },
        });

        const rates = await this.currencyRates.getLatest();

        const items: FavoriteItem[] = favorites.map(f => {
            const e = f.estate;
            return {
                id: e.id,
                favoritedAt: f.createdAt.toISOString(),
                price: e[priceCol] as number | null,
                pricePerM2: e[perM2Col] as number | null,
                priceCurrency: currencyCode,
                priceChangeDirection: e.priceChangeDirection,
                priceDeltaUsd: this.computePriceDeltaUsd(e, rates),
                rooms: e.rooms,
                areaTotal: e.areaTotal,
                storey: e.storey,
                storeys: e.storeys,
                address: e.address,
                photos: e.photos,
                metroStation: e.metroStation,
                metroTime: e.metroTime,
                sellerType: e.sellerType,
                isActive: e.isActive,
                publishedAt: e.publishedAt?.toISOString() ?? null,
                sourceUrl: e.sourceUrl,
                headline: e.headline,
            };
        });

        return this.sortItems(items, dto.sort ?? 'recent');
    }

    async getFavoriteIds(userId: string): Promise<{ ids: number[] }> {
        const rows = await this.favoriteRepo.find({
            where: { userId },
            select: { estateId: true },
        });
        return { ids: rows.map(r => r.estateId) };
    }

    async addFavorite(userId: string, estateId: number): Promise<void> {
        await this.favoriteRepo
            .createQueryBuilder()
            .insert()
            .into(FavoriteEntity)
            .values({ userId, estateId })
            .orIgnore()
            .execute();
    }

    async removeFavorite(userId: string, estateId: number): Promise<void> {
        await this.favoriteRepo.delete({ userId, estateId });
    }

    async bulkRemove(userId: string, ids: number[]): Promise<void> {
        if (!ids.length) return;
        await this.favoriteRepo
            .createQueryBuilder()
            .delete()
            .where('userId = :userId AND estateId IN (:...ids)', { userId, ids })
            .execute();
    }

    // Signed delta vs first known price. Negative = dropped, positive = risen.
    private computePriceDeltaUsd(estate: EstateEntity, rates: CurrencyRateEntity): number | null {
        if (estate.priceChangeDirection !== -1 && estate.priceChangeDirection !== 1) return null;
        const history = estate.priceHistory;
        if (!history?.length) return null;

        const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
        const first = sorted[0];
        const firstUsd = this.currencyRates.convert(first.price, first.currency, CURRENCY_USD, rates);
        const lastUsd = this.currencyRates.convert(estate.price, estate.priceCurrency, CURRENCY_USD, rates);
        if (firstUsd === null || lastUsd === null) return null;
        const delta = Math.round(lastUsd - firstUsd);
        return delta === 0 ? null : delta;
    }

    private sortItems(items: FavoriteItem[], sort: 'recent' | 'price-drop' | 'price-asc'): FavoriteItem[] {
        if (sort === 'price-asc') {
            return [...items].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
        }
        if (sort === 'price-drop') {
            const order = (dir: number | null): number =>
                dir === -1 ? 0 : dir === 1 ? 2 : 1;
            return [...items].sort((a, b) => {
                const diff = order(a.priceChangeDirection) - order(b.priceChangeDirection);
                if (diff !== 0) return diff;
                if (a.priceChangeDirection === -1 && b.priceChangeDirection === -1) {
                    // Most negative drop first
                    return (a.priceDeltaUsd ?? 0) - (b.priceDeltaUsd ?? 0);
                }
                return 0;
            });
        }
        return items; // recent: already DESC from DB
    }
}
