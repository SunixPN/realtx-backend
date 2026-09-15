import { EstateFilterBaseDto } from './estate-filter-base.dto.js';

/**
 * DTO для GET /estate/district-profitability.
 * Наследует все фильтры; поле `districts` принимается но игнорируется —
 * тепловая карта всегда показывает все районы.
 */
export class DistrictProfitabilityDto extends EstateFilterBaseDto {}
