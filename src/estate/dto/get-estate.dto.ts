import { IsIn, IsInt, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { CURRENCY_USD, CURRENCY_BYN, CURRENCY_EUR } from '../../currency/currency-rates.service.js';

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

export class GetEstateDto {
    @IsOptional()
    @Transform(({ value }) => toCurrencyCode(value))
    @IsInt()
    @IsIn([CURRENCY_USD, CURRENCY_BYN, CURRENCY_EUR])
    displayCurrency?: number;
}
