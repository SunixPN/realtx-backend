import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsEmail({}, { message: 'Некорректный email' })
  @MaxLength(255, { message: 'Email слишком длинный' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;

  @IsString()
  @MinLength(8, { message: 'Пароль должен быть не короче 8 символов' })
  @MaxLength(72, { message: 'Пароль не должен быть длиннее 72 символов' })
  @Matches(/[a-z]/, { message: 'Пароль должен содержать строчную букву' })
  @Matches(/[A-Z]/, { message: 'Пароль должен содержать заглавную букву' })
  @Matches(/[0-9]/, { message: 'Пароль должен содержать цифру' })
  @Matches(/[^a-zA-Z0-9]/, { message: 'Пароль должен содержать специальный символ (!@#$% и т.д.)' })
  password: string;
}
