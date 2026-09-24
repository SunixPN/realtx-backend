import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

export class UpdateComparePreferencesDto {
    @IsArray()
    @ArrayMaxSize(200)
    @IsString({ each: true })
    hiddenRows: string[];
}
