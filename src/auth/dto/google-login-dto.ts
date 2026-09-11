import { IsString, Length } from 'class-validator';

export class GoogleLoginDto {
  @IsString()
  @Length(100, 4000)
  idToken: string;
}
