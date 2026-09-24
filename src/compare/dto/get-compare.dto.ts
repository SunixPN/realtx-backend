import { IsIn, IsOptional, IsString } from 'class-validator';

export class GetCompareDto {
    @IsOptional()
    @IsString()
    @IsIn(['USD', 'BYN', 'EUR'])
    displayCurrency?: 'USD' | 'BYN' | 'EUR' = 'USD';
}
