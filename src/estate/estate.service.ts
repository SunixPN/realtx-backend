import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { EstateEntity } from "./entities/estate.entity.js";
import { EstateFilterBaseDto } from "./dto/estate-filter-base.dto.js";
import { FilterEstatesDto } from "./dto/filter-estates.dto.js";
import { MapPointFilterDto } from "./dto/map-point-filter.dto.js";
import { GetEstateDto } from "./dto/get-estate.dto.js";
import { HouseEstatesDto } from "./dto/house-estates.dto.js";
import {
    CurrencyRatesService,
    CURRENCY_USD,
    CURRENCY_BYN,
    CURRENCY_EUR,
    type ConvertibleCurrency,
} from '../currency/currency-rates.service.js';
import { CurrencyRateEntity } from '../currency/entities/currency-rate.entity.js';

// Маппинг ISO 4217 → колонки с денормализованной ценой в EstateEntity.
// Единый источник — тут; ниже используется и в applyFilters, и в SELECT.
const PRICE_COL_BY_CURRENCY: Record<ConvertibleCurrency, 'priceUsd' | 'priceByn' | 'priceEur'> = {
    [CURRENCY_USD]: 'priceUsd',
    [CURRENCY_BYN]: 'priceByn',
    [CURRENCY_EUR]: 'priceEur',
};

const PER_M2_COL_BY_CURRENCY: Record<ConvertibleCurrency, 'pricePerM2Usd' | 'pricePerM2Byn' | 'pricePerM2Eur'> = {
    [CURRENCY_USD]: 'pricePerM2Usd',
    [CURRENCY_BYN]: 'pricePerM2Byn',
    [CURRENCY_EUR]: 'pricePerM2Eur',
};

const RECOMPUTE_BATCH_SIZE = 1000;

@Injectable()
export class EstateService {
    constructor(
        @InjectRepository(EstateEntity)
        private readonly estateRepo: Repository<EstateEntity>,
        private readonly currencyRates: CurrencyRatesService,
    ) {}

    private resolveCurrency(dto: EstateFilterBaseDto): ConvertibleCurrency {
        const c = dto.displayCurrency ?? CURRENCY_USD;
        if (c === CURRENCY_USD || c === CURRENCY_BYN || c === CURRENCY_EUR) return c;
        return CURRENCY_USD;
    }

    private applyFilters(qb: SelectQueryBuilder<EstateEntity>, dto: EstateFilterBaseDto) {
        const currency = this.resolveCurrency(dto);
        const priceCol = PRICE_COL_BY_CURRENCY[currency];

        // Ценовой фильтр — по денормализованной колонке в выбранной валюте.
        // Никаких runtime-конвертаций, границы сравниваются как есть.
        if (dto.priceMin != undefined) qb.andWhere(`e.${priceCol} >= :priceMin`, { priceMin: dto.priceMin });
        if (dto.priceMax != undefined) qb.andWhere(`e.${priceCol} <= :priceMax`, { priceMax: dto.priceMax });

        if (dto.rooms?.length) {
            const has5plus = dto.rooms.includes(5);
            const exact = dto.rooms.filter(r => r < 5);
            if (has5plus && exact.length) {
                qb.andWhere('(e.rooms IN (:...exact) OR e.rooms >= 5)', { exact });
            } else if (has5plus) {
                qb.andWhere('e.rooms >= 5');
            } else {
                qb.andWhere('e.rooms IN (:...rooms)', { rooms: dto.rooms });
            }
        }

        if (dto.areaMin !== undefined) qb.andWhere('e.areaTotal >= :areaMin', { areaMin: dto.areaMin });
        if (dto.areaMax !== undefined) qb.andWhere('e.areaTotal <= :areaMax', { areaMax: dto.areaMax });

        if (dto.storeyMin !== undefined) qb.andWhere('e.storey >= :sMin', { sMin: dto.storeyMin });
        if (dto.storeyMax !== undefined) qb.andWhere('e.storey <= :sMax', { sMax: dto.storeyMax });
        if (dto.notFirstOrLast) qb.andWhere('e.storey > 1 AND e.storey < e.storeys');

        if (dto.buildingYearMin !== undefined) qb.andWhere('e.buildingYear >= :yMin', { yMin: dto.buildingYearMin });
        if (dto.buildingYearMax !== undefined) qb.andWhere('e.buildingYear <= :yMax', { yMax: dto.buildingYearMax });

        if (dto.wallMaterial?.length) qb.andWhere('e.wallMaterial IN (:...wm)', { wm: dto.wallMaterial });
        if (dto.repairState?.length) qb.andWhere('e.repairState IN (:...rs)', { rs: dto.repairState });
        if (dto.districts?.length) qb.andWhere('e.districtName IN (:...d)', { d: dto.districts });

        if (dto.metroTimeMax !== undefined) qb.andWhere('e.metroTime <= :mt', { mt: dto.metroTimeMax });
        if (dto.ownerOnly) qb.andWhere('e.agencyUuid IS NULL');

        if (dto.q?.trim()) {
            qb.andWhere('(e.address ILIKE :q OR e.metroStation ILIKE :q)', { q: `%${dto.q.trim()}%` });
        }

        qb.andWhere('e.isActive = :active', { active: dto.isActive ?? true });
    }

    /**
     * Собирает список Estate + подставляет `price`/`pricePerM2` в выбранной
     * валюте. Оригинальные поля `price + priceCurrency` тоже остаются в ответе —
     * пригодится в карточке «оригинал: X BYN».
     */
    private projectByCurrency(items: EstateEntity[], currency: ConvertibleCurrency) {
        const priceKey = PRICE_COL_BY_CURRENCY[currency];
        const perM2Key = PER_M2_COL_BY_CURRENCY[currency];
        return items.map((e) => ({
            ...e,
            price: e[priceKey] as number | null,
            pricePerM2: e[perM2Key] as number | null,
            originalPrice: e.price,
            originalCurrency: e.priceCurrency,
            displayCurrency: currency,
        }));
    }

    /**
     * Конвертирует сырую историю цен + текущую цену через ОДИН снапшот курсов.
     * Критично: если брать history через `convert()`, а current из
     * денормализованных `priceUsd/Byn/Eur` — точки поедут между валютами на
     * дельту курса, и график в BYN уйдёт вверх, а в EUR — вниз для того же
     * объекта. Поэтому текущую цену тоже конвертим live из `entity.price/priceCurrency`.
     */
    private buildPriceHistoryPoints(
        entity: EstateEntity,
        rates: CurrencyRateEntity,
    ): Array<{ date: string; usd: number | null; byn: number | null; eur: number | null }> {
        const historical = entity.priceHistory.map((h) => ({
            date: h.date,
            usd: this.currencyRates.convert(h.price, h.currency, CURRENCY_USD, rates),
            byn: this.currencyRates.convert(h.price, h.currency, CURRENCY_BYN, rates),
            eur: this.currencyRates.convert(h.price, h.currency, CURRENCY_EUR, rates),
        }));
        historical.push({
            date: entity.updatedAt.toISOString(),
            usd: this.currencyRates.convert(entity.price, entity.priceCurrency, CURRENCY_USD, rates),
            byn: this.currencyRates.convert(entity.price, entity.priceCurrency, CURRENCY_BYN, rates),
            eur: this.currencyRates.convert(entity.price, entity.priceCurrency, CURRENCY_EUR, rates),
        });
        return historical;
    }

    /**
     * Дельта первая→последняя точка. Процент считаем отдельно для каждой
     * валюты, а не только в USD — иначе в BYN получаем +153 Br и одновременно
     * +0.0% (потому что в USD это округляется до нуля). Фронт берёт нужный
     * пакет по displayCurrency.
     */
    private buildPriceChange(
        points: Array<{ date: string; usd: number | null; byn: number | null; eur: number | null }>,
        changesCount: number,
    ): {
        deltaUsd: number | null;
        deltaByn: number | null;
        deltaEur: number | null;
        deltaPctUsd: number | null;
        deltaPctByn: number | null;
        deltaPctEur: number | null;
        changes: number;
    } | null {
        if (points.length < 2) return null;
        const first = points[0];
        const last = points[points.length - 1];

        const sub = (a: number | null, b: number | null) =>
            a !== null && b !== null ? Math.round(a - b) : null;

        const pct = (a: number | null, b: number | null) =>
            a !== null && b !== null && b !== 0
                ? Math.round(((a - b) / Math.abs(b)) * 1000) / 10
                : null;

        return {
            deltaUsd: sub(last.usd, first.usd),
            deltaByn: sub(last.byn, first.byn),
            deltaEur: sub(last.eur, first.eur),
            deltaPctUsd: pct(last.usd, first.usd),
            deltaPctByn: pct(last.byn, first.byn),
            deltaPctEur: pct(last.eur, first.eur),
            changes: changesCount,
        };
    }

    async getAnyEstates(dto: FilterEstatesDto) {
        const currency = this.resolveCurrency(dto);
        const qb = this.estateRepo.createQueryBuilder('e');
        this.applyFilters(qb, dto);
        // sortBy=price → сортируем по колонке выбранной валюты, иначе фронт
        // видит бардак при переключении $/BYN/€.
        const sortCol = dto.sortBy === 'price' ? `e.${PRICE_COL_BY_CURRENCY[currency]}`
                      : dto.sortBy === 'pricePerM2' ? `e.${PER_M2_COL_BY_CURRENCY[currency]}`
                      : `e.${dto.sortBy}`;
        qb.orderBy(sortCol, dto.sortOrder)
            .skip((dto.page! - 1) * dto.limit!)
            .take(dto.limit!);
        const [items, total] = await qb.getManyAndCount();
        return { total, page: dto.page, limit: dto.limit, currency, estates: this.projectByCurrency(items, currency) };
    }

    async getMapPoints(dto: MapPointFilterDto) {
        const currency = this.resolveCurrency(dto);
        const priceCol = PRICE_COL_BY_CURRENCY[currency];
        const qb = this.estateRepo.createQueryBuilder('e')
            .select(['e.id', 'e.lat', 'e.lng', `e.${priceCol}`, 'e.price', 'e.priceCurrency', 'e.rooms'])
            .andWhere('e.lat IS NOT NULL')
            .andWhere('e.lng IS NOT NULL');
        this.applyFilters(qb, dto);
        const items = await qb.getMany();
        return items.map(e => ({
            id: e.id,
            lat: e.lat,
            lng: e.lng,
            price: e[priceCol] as number | null,
            priceCurrency: currency,
            originalPrice: e.price,
            originalCurrency: e.priceCurrency,
            rooms: e.rooms,
        }));
    }

    async getById(id: number, dto: GetEstateDto) {
        const entity = await this.estateRepo.findOne({ where: { id } });
        if (!entity) throw new NotFoundException(`Estate ${id} not found`);
        const currency = this.resolveCurrency(dto);
        const rates = await this.currencyRates.getLatest();
        const base = this.projectByCurrency([entity], currency)[0];
        const priceHistory = this.buildPriceHistoryPoints(entity, rates);
        const priceChange = this.buildPriceChange(priceHistory, entity.priceHistory.length);
        return { ...base, priceHistory, priceChange };
    }

    /**
     * Ограничитель ширины bbox для «дома»: 0.002° ≈ 130 м. Всё, что шире —
     * это уже не дом, а район, и грузить весь район в drawer мы не будем.
     */
    private static readonly MAX_HOUSE_SPAN_DEG = 0.002;

    async getHouseEstates(dto: HouseEstatesDto) {
        const spanLat = dto.maxLat - dto.minLat;
        const spanLng = dto.maxLng - dto.minLng;
        const max = EstateService.MAX_HOUSE_SPAN_DEG;
        if (spanLat < 0 || spanLng < 0 || spanLat > max || spanLng > max) {
            return { items: [] };
        }
        const currency = this.resolveCurrency(dto);
        const priceCol = PRICE_COL_BY_CURRENCY[currency];
        const perM2Col = PER_M2_COL_BY_CURRENCY[currency];
        const qb = this.estateRepo.createQueryBuilder('e')
            .andWhere('e.lat BETWEEN :minLat AND :maxLat', { minLat: dto.minLat, maxLat: dto.maxLat })
            .andWhere('e.lng BETWEEN :minLng AND :maxLng', { minLng: dto.minLng, maxLng: dto.maxLng });
        // Применяем те же фильтры, что и getMapPoints — иначе счётчик на метке
        // ("2 квартиры") не сходится с содержимым drawer'а после клика.
        this.applyFilters(qb, dto);
        const items = await qb
            .orderBy('e.rooms', 'ASC')
            .addOrderBy('e.areaTotal', 'ASC')
            .getMany();
        return {
            items: items.map((e) => ({
                id: e.id,
                price: e[priceCol] as number | null,
                pricePerM2: e[perM2Col] as number | null,
                priceCurrency: currency,
                originalPrice: e.price,
                originalCurrency: e.priceCurrency,
                rooms: e.rooms,
                areaTotal: e.areaTotal,
                storey: e.storey,
                storeys: e.storeys,
                address: e.address,
                metroStation: e.metroStation,
                metroTime: e.metroTime,
                photo: e.photos?.[0] ?? null,
                sellerType: e.sellerType,
            })),
        };
    }

    /**
     * Пересчитывает priceUsd/Byn/Eur и pricePerM2Usd/Byn/Eur у всех записей по
     * актуальным курсам. Батчами, чтобы не тянуть всю таблицу в память.
     * Вызывается после апдейта курсов в CurrencyRatesScheduler и разово
     * вручную через POST /currency/recompute.
     */
    /**
     * Подсказки для строки поиска: станции метро + адреса, встречающиеся в
     * АКТИВНЫХ объявлениях. Метро идут первыми — их конечное множество и
     * пользователь чаще ищет по ним. Матчим по substring (`ILIKE '%q%'`), а
     * не префиксом: у нас все адреса вида "Минск <улица> ..." — префиксный
     * поиск по названию улицы не сработает.
     */
    async suggest(q: string | undefined, limit: number): Promise<Array<{ type: 'metro' | 'address'; value: string }>> {
        const raw = (q ?? '').trim();
        const pattern = raw ? `%${raw}%` : '%';

        const metroQb = this.estateRepo
            .createQueryBuilder('e')
            .select('DISTINCT e.metroStation', 'value')
            .where('e.metroStation IS NOT NULL')
            .andWhere('e.isActive = true');
        if (raw) metroQb.andWhere('e.metroStation ILIKE :p', { p: pattern });
        metroQb.orderBy('value', 'ASC').limit(limit);
        const metroRows = await metroQb.getRawMany<{ value: string }>();

        const remaining = Math.max(0, limit - metroRows.length);
        let addressRows: { value: string }[] = [];
        if (remaining > 0) {
            const addrQb = this.estateRepo
                .createQueryBuilder('e')
                .select('DISTINCT e.address', 'value')
                .where('e.address IS NOT NULL')
                .andWhere('e.isActive = true');
            if (raw) addrQb.andWhere('e.address ILIKE :p', { p: pattern });
            addrQb.orderBy('value', 'ASC').limit(remaining);
            addressRows = await addrQb.getRawMany<{ value: string }>();
        }

        return [
            ...metroRows.map((r) => ({ type: 'metro' as const, value: r.value })),
            ...addressRows.map((r) => ({ type: 'address' as const, value: r.value })),
        ];
    }

    async recomputePrices(): Promise<number> {
        const rates = await this.currencyRates.getLatest();
        let lastId = 0;
        let processed = 0;

        while (true) {
            const batch = await this.estateRepo
                .createQueryBuilder('e')
                .select(['e.id', 'e.price', 'e.priceCurrency', 'e.pricePerM2'])
                .where('e.id > :lastId', { lastId })
                .orderBy('e.id', 'ASC')
                .take(RECOMPUTE_BATCH_SIZE)
                .getMany();

            if (batch.length === 0) break;

            await Promise.all(batch.map((e) => {
                const price = e.price;
                const pricePerM2 = e.pricePerM2;
                const from = e.priceCurrency;
                return this.estateRepo.update(e.id, {
                    priceUsd: this.currencyRates.convert(price, from, CURRENCY_USD, rates),
                    priceByn: this.currencyRates.convert(price, from, CURRENCY_BYN, rates),
                    priceEur: this.currencyRates.convert(price, from, CURRENCY_EUR, rates),
                    pricePerM2Usd: this.currencyRates.convert(pricePerM2, from, CURRENCY_USD, rates),
                    pricePerM2Byn: this.currencyRates.convert(pricePerM2, from, CURRENCY_BYN, rates),
                    pricePerM2Eur: this.currencyRates.convert(pricePerM2, from, CURRENCY_EUR, rates),
                });
            }));

            processed += batch.length;
            lastId = batch[batch.length - 1].id;
        }

        return processed;
    }
}
