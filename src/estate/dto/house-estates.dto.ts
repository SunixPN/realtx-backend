import { IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { EstateFilterBaseDto } from './estate-filter-base.dto.js';

/**
 * bbox приходит от Mapbox-кластера с фронта (clusterProperties.minLng/maxLng/…).
 * На бэке ограничиваем ширину bbox, чтобы «дом» не превратился в поиск по району.
 *
 * Наследуемся от EstateFilterBaseDto: карта показывает метки уже отфильтрованные
 * через getMapPoints → getHouseEstates должен применять те же фильтры, иначе
 * при клике по метке "2 квартиры" в drawer выпадают 6 (все объекты дома).
 */
export class HouseEstatesDto extends EstateFilterBaseDto {
    @Type(() => Number) @IsNumber()
    minLat: number;

    @Type(() => Number) @IsNumber()
    maxLat: number;

    @Type(() => Number) @IsNumber()
    minLng: number;

    @Type(() => Number) @IsNumber()
    maxLng: number;
}
