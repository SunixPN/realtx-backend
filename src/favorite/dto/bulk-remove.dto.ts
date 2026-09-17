import { IsArray, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class BulkRemoveFavoritesDto {
    @IsArray()
    @IsInt({ each: true })
    @Type(() => Number)
    ids: number[];
}
