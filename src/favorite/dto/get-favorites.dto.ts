import { IsIn, IsOptional, IsString } from 'class-validator';

export class GetFavoritesDto {
    @IsOptional()
    @IsString()
    @IsIn(['recent', 'price-drop', 'price-asc'])
    sort?: 'recent' | 'price-drop' | 'price-asc' = 'recent';

    @IsOptional()
    @IsString()
    @IsIn(['USD', 'BYN', 'EUR'])
    displayCurrency?: 'USD' | 'BYN' | 'EUR' = 'USD';
}
