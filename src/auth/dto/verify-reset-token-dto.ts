import { IsString, Length } from 'class-validator';

export class VerifyResetTokenDto {
  @IsString()
  @Length(32, 128)
  token: string;
}
