import { EstateFilterBaseDto } from '../../estate/dto/estate-filter-base.dto.js';

// Отдельный класс, чтобы можно было расширить набор полей фильтров
// подписки, не задев поисковый DTO. Пока — полное совпадение.
export class SubscriptionFiltersDto extends EstateFilterBaseDto {}
