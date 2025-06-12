import { IsString, IsNotEmpty } from "class-validator";

export class EnableTwoFactorDto {
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class VerifyTwoFactorDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class DisableTwoFactorDto {
  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  token: string;
}

export class LoginWithTwoFactorDto {
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  token: string;
}

export class TwoFactorSetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

export class TwoFactorStatusResponse {
  enabled: boolean;
  method?: string;
}
