import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CompareItemEntity } from './entities/compare-item.entity.js';
import { ComparePreferenceEntity } from './entities/compare-preference.entity.js';
import { EstateEntity } from '../estate/entities/estate.entity.js';
import { GetCompareDto } from './dto/get-compare.dto.js';
import { UpdateComparePreferencesDto } from './dto/update-compare-preferences.dto.js';
import {
    CurrencyRatesService,
    CURRENCY_USD,
    CURRENCY_BYN,
    CURRENCY_EUR,
} from '../currency/currency-rates.service.js';
import { CurrencyRateEntity } from '../currency/entities/currency-rate.entity.js';

export const COMPARE_LIMIT = 4;

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

export type CompareItem = {
    id: number;
    addedAt: string;
    price: number | null;
    priceUsd: number | null;
    priceByn: number | null;
    priceEur: number | null;
    pricePerM2: number | null;
    priceCurrency: number;
    priceChangeDirection: number | null;
    priceDeltaUsd: number | null;
    priceDeltaPctUsd: number | null;
    rooms: number | null;
    areaTotal: number | null;
    areaLiving: number | null;
    areaKitchen: number | null;
    balconyType: number | null;
    storey: number | null;
    storeys: number | null;
    buildingYear: number | null;
    wallMaterial: number | null;
    repairState: number | null;
    districtName: string | null;
    address: string | null;
    photo: string | null;
    metroStation: string | null;
    metroTime: number | null;
    sellerType: number | null;
    isActive: boolean;
    publishedAt: string | null;
    sourceUrl: string | null;
    headline: string | null;
};

@Injectable()
export class CompareService {
    constructor(
        @InjectRepository(CompareItemEntity)
        private readonly compareRepo: Repository<CompareItemEntity>,
        @InjectRepository(EstateEntity)
        private readonly estateRepo: Repository<EstateEntity>,
        @InjectRepository(ComparePreferenceEntity)
        private readonly prefRepo: Repository<ComparePreferenceEntity>,
        private readonly currencyRates: CurrencyRatesService,
    ) {}

    async getPreferences(userId: string): Promise<{ hiddenRows: string[] }> {
        const row = await this.prefRepo.findOne({ where: { userId } });
        return { hiddenRows: row?.hiddenRows ?? [] };
    }

    async updatePreferences(userId: string, dto: UpdateComparePreferencesDto): Promise<{ hiddenRows: string[] }> {
        const hiddenRows = Array.from(new Set(dto.hiddenRows));
        await this.prefRepo.upsert({ userId, hiddenRows }, ['userId']);
        return { hiddenRows };
    }

    async getCompare(userId: string, dto: GetCompareDto): Promise<{ items: CompareItem[]; count: number; limit: number }> {
        const currency = dto.displayCurrency ?? 'USD';
        const priceCol = PRICE_COL[currency];
        const perM2Col = PER_M2_COL[currency];
        const currencyCode = CURRENCY_CODE[currency];

        const rows = await this.compareRepo.find({
            where: { userId },
            relations: { estate: true } as any,
            order: { createdAt: 'ASC' },
        });

        const rates = await this.currencyRates.getLatest();

        const items: CompareItem[] = rows.map(f => {
            const e = f.estate;
            const delta = this.computePriceDelta(e, rates);
            return {
                id: e.id,
                addedAt: f.createdAt.toISOString(),
                price: e[priceCol] as number | null,
                priceUsd: e.priceUsd,
                priceByn: e.priceByn,
                priceEur: e.priceEur,
                pricePerM2: e[perM2Col] as number | null,
                priceCurrency: currencyCode,
                priceChangeDirection: e.priceChangeDirection,
                priceDeltaUsd: delta?.deltaUsd ?? null,
                priceDeltaPctUsd: delta?.pctUsd ?? null,
                rooms: e.rooms,
                areaTotal: e.areaTotal,
                areaLiving: e.areaLiving,
                areaKitchen: e.areaKitchen,
                balconyType: e.balconyType,
                storey: e.storey,
                storeys: e.storeys,
                buildingYear: e.buildingYear,
                wallMaterial: e.wallMaterial,
                repairState: e.repairState,
                districtName: e.districtName,
                address: e.address,
                photo: e.photos?.[0] ?? null,
                metroStation: e.metroStation,
                metroTime: e.metroTime,
                sellerType: e.sellerType,
                isActive: e.isActive,
                publishedAt: e.publishedAt?.toISOString() ?? null,
                sourceUrl: e.sourceUrl,
                headline: e.headline,
            };
        });

        return { items, count: items.length, limit: COMPARE_LIMIT };
    }

    async getCompareIds(userId: string): Promise<{ ids: number[]; limit: number }> {
        const rows = await this.compareRepo.find({
            where: { userId },
            select: { estateId: true },
            order: { createdAt: 'ASC' },
        });
        return { ids: rows.map(r => r.estateId), limit: COMPARE_LIMIT };
    }

    async addToCompare(userId: string, estateId: number): Promise<{ ok: true }> {
        const exists = await this.compareRepo.existsBy({ userId, estateId });
        if (exists) throw new ConflictException('ALREADY_IN_COMPARE');
        const count = await this.compareRepo.countBy({ userId });
        if (count >= COMPARE_LIMIT) {
            throw new UnprocessableEntityException({
                code: 'COMPARE_LIMIT_REACHED',
                message: `Максимум ${COMPARE_LIMIT} объектов в сравнении`,
                limit: COMPARE_LIMIT,
            });
        }
        await this.compareRepo.insert({ userId, estateId });
        return { ok: true };
    }

    async removeFromCompare(userId: string, estateId: number): Promise<void> {
        await this.compareRepo.delete({ userId, estateId });
    }

    async clearCompare(userId: string): Promise<void> {
        await this.compareRepo.delete({ userId });
    }

    private computePriceDelta(estate: EstateEntity, rates: CurrencyRateEntity): { deltaUsd: number | null; pctUsd: number | null } | null {
        if (estate.priceChangeDirection !== -1 && estate.priceChangeDirection !== 1) return null;
        const history = estate.priceHistory;
        if (!history?.length) return null;
        const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
        const first = sorted[0];
        const firstUsd = this.currencyRates.convert(first.price, first.currency, CURRENCY_USD, rates);
        const lastUsd = this.currencyRates.convert(estate.price, estate.priceCurrency, CURRENCY_USD, rates);
        if (firstUsd === null || lastUsd === null) return null;
        const deltaUsd = Math.round(lastUsd - firstUsd);
        const pctUsd = firstUsd !== 0 ? Math.round(((lastUsd - firstUsd) / Math.abs(firstUsd)) * 1000) / 10 : null;
        if (deltaUsd === 0) return null;
        return { deltaUsd, pctUsd };
    }
}
