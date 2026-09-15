import { IsOptional, IsInt, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { EstateFilterBaseDto } from './estate-filter-base.dto.js';

export class FilterEstatesDto extends EstateFilterBaseDto {
    @IsOptional() @Type(() => Number) @IsInt() @Min(1)
    page?: number = 1;

    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
    limit?: number = 20;

    @IsOptional() @IsString()
    sortBy?: 'price' | 'areaTotal' | 'publishedAt' | 'pricePerM2' = 'publishedAt';

    @IsOptional() @IsString()
    sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
