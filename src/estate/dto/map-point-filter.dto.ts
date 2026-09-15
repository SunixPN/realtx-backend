import { EstateFilterBaseDto } from './estate-filter-base.dto.js';

/**
 * DTO для GET /estate/map-points.
 * Полностью наследует EstateFilterBaseDto — все @Transform для массивов
 * (rooms/wallMaterial/repairState/districts) уже там и корректно обрабатывают
 * как comma-separated строку из query, так и обычный JSON-массив из body.
 */
export class MapPointFilterDto extends EstateFilterBaseDto {}
