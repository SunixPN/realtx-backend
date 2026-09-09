import { IsString, Length } from 'class-validator';

export class PhoneLoginDto {
  // Firebase ID токен обычно ~800-1500 символов, ставим границы с запасом
  @IsString()
  @Length(100, 4000)
  idToken: string;
}
