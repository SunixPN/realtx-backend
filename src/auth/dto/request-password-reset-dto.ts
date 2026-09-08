import { IsEmail, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class RequestPasswordResetDto {
  @IsEmail({}, { message: 'Некорректный email' })
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email: string;
}
