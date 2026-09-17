import {
    ArrayNotEmpty,
    ArrayUnique,
    IsArray,
    IsBoolean,
    IsIn,
    IsOptional,
    IsString,
    Length,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SubscriptionFiltersDto } from './subscription-filters.dto.js';

const FREQUENCIES = ['instant', 'daily', 'weekly'] as const;
const TRIGGERS = ['new', 'price-down'] as const;
const CHANNELS = ['email'] as const;

export class UpdateSubscriptionDto {
    @IsOptional() @IsString() @Length(1, 120)
    name?: string;

    @IsOptional()
    @ValidateNested()
    @Type(() => SubscriptionFiltersDto)
    filters?: SubscriptionFiltersDto;

    @IsOptional() @IsString() @IsIn(FREQUENCIES as unknown as string[])
    frequency?: (typeof FREQUENCIES)[number];

    @IsOptional()
    @IsArray() @ArrayNotEmpty() @ArrayUnique()
    @IsIn(TRIGGERS as unknown as string[], { each: true })
    triggers?: (typeof TRIGGERS)[number][];

    @IsOptional()
    @IsArray() @ArrayNotEmpty() @ArrayUnique()
    @IsIn(CHANNELS as unknown as string[], { each: true })
    channels?: (typeof CHANNELS)[number][];

    @IsOptional() @IsBoolean()
    quietHours?: boolean;

    @IsOptional() @IsBoolean()
    paused?: boolean;
}
