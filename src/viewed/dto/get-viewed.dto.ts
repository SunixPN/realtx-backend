import { IsIn, IsOptional, IsString } from 'class-validator';

export class GetViewedDto {
    @IsOptional()
    @IsString()
    @IsIn(['USD', 'BYN', 'EUR'])
    displayCurrency?: 'USD' | 'BYN' | 'EUR' = 'USD';
}
