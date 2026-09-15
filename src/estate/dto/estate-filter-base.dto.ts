import { IsOptional, IsInt, IsNumber, IsBoolean, IsString, IsArray, IsIn, Min, ArrayMaxSize } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { CURRENCY_USD, CURRENCY_BYN, CURRENCY_EUR } from '../../currency/currency-rates.service.js';

// Приём валюты в двух форматах: буквенный ISO 4217 ('USD') — для удобных
// URL, и числовой (840) — для обратной совместимости.
const ISO_ALPHA_TO_NUMERIC: Record<string, number> = {
    USD: CURRENCY_USD,
    BYN: CURRENCY_BYN,
    EUR: CURRENCY_EUR,
};

function toCurrencyCode(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'number') return value;
    const s = String(value).trim().toUpperCase();
    if (s in ISO_ALPHA_TO_NUMERIC) return ISO_ALPHA_TO_NUMERIC[s];
    const n = Number(s);
    return isNaN(n) ? undefined : n;
}

function toNumberArray(value: unknown): number[] | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const arr = Array.isArray(value) ? value : String(value).split(',');
    const mapped = arr.map(Number).filter(n => !isNaN(n));
    return mapped.length ? mapped : undefined;
}

function toStringArray(value: unknown): string[] | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const arr = Array.isArray(value) ? value.map(String) : String(value).split(',');
    return arr.length ? arr : undefined;
}

export class EstateFilterBaseDto {
    @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
    priceMin?: number;

    @IsOptional() @Type(() => Number) @IsNumber()
    priceMax?: number;

    /**
     * Валюта отображения: USD/BYN/EUR (или 840/933/978). НЕ фильтр —
     * priceMin/priceMax трактуются в этой валюте, а `price` в ответе
     * подставляется из соответствующей денормализованной колонки.
     * Дефолт: USD.
     */
    @IsOptional()
    @Transform(({ value }) => toCurrencyCode(value))
    @IsInt()
    @IsIn([CURRENCY_USD, CURRENCY_BYN, CURRENCY_EUR])
    displayCurrency?: number;

    @IsOptional()
    @Transform(({ value }) => toNumberArray(value))
    @IsArray() @IsInt({ each: true }) @ArrayMaxSize(6)
    rooms?: number[];

    @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
    areaMin?: number;

    @IsOptional() @Type(() => Number) @IsNumber()
    areaMax?: number;

    @IsOptional() @Type(() => Number) @IsInt() @Min(1)
    storeyMin?: number;

    @IsOptional() @Type(() => Number) @IsInt()
    storeyMax?: number;

    @IsOptional() @Type(() => Boolean) @IsBoolean()
    notFirstOrLast?: boolean;

    @IsOptional() @Type(() => Number) @IsInt()
    buildingYearMin?: number;

    @IsOptional() @Type(() => Number) @IsInt()
    buildingYearMax?: number;

    @IsOptional()
    @Transform(({ value }) => toNumberArray(value))
    @IsArray() @IsInt({ each: true })
    wallMaterial?: number[];

    @IsOptional()
    @Transform(({ value }) => toNumberArray(value))
    @IsArray() @IsInt({ each: true })
    repairState?: number[];

    @IsOptional()
    @Transform(({ value }) => toStringArray(value))
    @IsArray() @IsString({ each: true })
    districts?: string[];

    @IsOptional() @Type(() => Number) @IsInt()
    metroTimeMax?: number;

    @IsOptional() @Type(() => Boolean) @IsBoolean()
    ownerOnly?: boolean;

    @IsOptional() @Type(() => Boolean) @IsBoolean()
    isActive?: boolean;

    // Поиск одной строкой по адресу или станции метро (ILIKE %q%).
    // Наполняется из комбобокса-подсказки на фронте.
    @IsOptional() @IsString()
    q?: string;
}
