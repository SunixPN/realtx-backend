import { IsEmail, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class AddEmailDto {
  @IsEmail({}, { message: 'Некорректный email' })
  @MaxLength(255, { message: 'Email слишком длинный' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;
}
