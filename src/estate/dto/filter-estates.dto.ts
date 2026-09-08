import { IsOptional, IsInt, IsNumber, IsBoolean, IsString, IsArray, Min, Max, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';

export class FilterEstatesDto {
    // --- Цена ---
    @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
    priceMin?: number;

    @IsOptional() @Type(() => Number) @IsNumber()
    priceMax?: number;

    @IsOptional() @IsInt()
    priceCurrency?: number; // 933/840/978 — если фильтруем в конкретной валюте

    // --- Комнаты (массив, поддержка 5+) ---
    @IsOptional() @IsArray() @IsInt({ each: true }) @ArrayMaxSize(6)
    rooms?: number[];

    // --- Площадь ---
    @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
    areaMin?: number;

    @IsOptional() @Type(() => Number) @IsNumber()
    areaMax?: number;

    // --- Этажность ---
    @IsOptional() @Type(() => Number) @IsInt() @Min(1)
    storeyMin?: number;

    @IsOptional() @Type(() => Number) @IsInt()
    storeyMax?: number;

    @IsOptional() @Type(() => Boolean) @IsBoolean()
    notFirstOrLast?: boolean;

    // --- Год постройки ---
    @IsOptional() @Type(() => Number) @IsInt()
    buildingYearMin?: number;

    @IsOptional() @Type(() => Number) @IsInt()
    buildingYearMax?: number;

    // --- Тип дома / ремонт (multi-select) ---
    @IsOptional() @IsArray() @IsInt({ each: true })
    wallMaterial?: number[];

    @IsOptional() @IsArray() @IsInt({ each: true })
    repairState?: number[];

    // --- Локация ---
    @IsOptional() @IsArray() @IsString({ each: true })
    districts?: string[]; // ["Центральный", "Советский", ...]

    // --- Метро ---
    @IsOptional() @Type(() => Number) @IsInt()
    metroTimeMax?: number; // максимум минут пешком

    // --- Продавец ---
    @IsOptional() @Type(() => Boolean) @IsBoolean()
    ownerOnly?: boolean; // sellerType === 1 или agencyUuid IS NULL

    // --- Статус ---
    @IsOptional() @Type(() => Boolean) @IsBoolean()
    isActive?: boolean;

    // --- Пагинация и сортировка ---
    @IsOptional() @Type(() => Number) @IsInt() @Min(1)
    page?: number = 1;

    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
    limit?: number = 20;

    @IsOptional() @IsString()
    sortBy?: 'price' | 'areaTotal' | 'publishedAt' | 'pricePerM2' = 'publishedAt';

    @IsOptional() @IsString()
    sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
