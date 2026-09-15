import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SuggestDto {
    @IsOptional() @IsString()
    q?: string;

    @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(20)
    limit?: number = 10;
}
