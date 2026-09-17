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

export class CreateSubscriptionDto {
    @IsString()
    @Length(1, 120)
    name: string;

    @ValidateNested()
    @Type(() => SubscriptionFiltersDto)
    filters: SubscriptionFiltersDto;

    @IsString()
    @IsIn(FREQUENCIES as unknown as string[])
    frequency: (typeof FREQUENCIES)[number];

    @IsArray()
    @ArrayNotEmpty()
    @ArrayUnique()
    @IsIn(TRIGGERS as unknown as string[], { each: true })
    triggers: (typeof TRIGGERS)[number][];

    @IsArray()
    @ArrayNotEmpty()
    @ArrayUnique()
    @IsIn(CHANNELS as unknown as string[], { each: true })
    channels: (typeof CHANNELS)[number][];

    @IsOptional()
    @IsBoolean()
    quietHours?: boolean;
}
