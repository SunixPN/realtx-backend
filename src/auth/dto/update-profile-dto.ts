import { IsBoolean, IsOptional, IsString, Length, MaxLength, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateProfileDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 60, { message: 'Имя должно быть от 1 до 60 символов' })
  name?: string;

  // Пустая строка = очистить город
  @IsOptional()
  @Transform(({ value }) => {
    const v = trim({ value });
    return v === '' ? null : v;
  })
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(80, { message: 'Название города слишком длинное' })
  city?: string | null;

  @IsOptional()
  @IsBoolean()
  notifyByEmail?: boolean;
}
