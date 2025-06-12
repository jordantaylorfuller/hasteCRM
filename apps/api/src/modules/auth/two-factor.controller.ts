import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from "@nestjs/common";
import { TwoFactorService } from "./two-factor.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RateLimitGuard } from "../../common/guards/rate-limit.guard";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";

@Controller("auth/2fa")
@UseGuards(RateLimitGuard, JwtAuthGuard)
export class TwoFactorController {
  constructor(private twoFactorService: TwoFactorService) {}

  @Post("setup")
  @RateLimit({ points: 5, duration: 900 }) // 5 attempts per 15 minutes
  @HttpCode(HttpStatus.CREATED)
  async setupTwoFactor(@Request() req, @Body("password") password: string) {
    return this.twoFactorService.setupTwoFactor(req.user.sub, password);
  }

  @Post("enable")
  @RateLimit({ points: 5, duration: 900 })
  @HttpCode(HttpStatus.OK)
  async enableTwoFactor(@Request() req, @Body("token") token: string) {
    await this.twoFactorService.verifyAndEnableTwoFactor(req.user.sub, token);
    return { message: "Two-factor authentication enabled successfully" };
  }

  @Post("disable")
  @RateLimit({ points: 5, duration: 900 })
  @HttpCode(HttpStatus.OK)
  async disableTwoFactor(
    @Request() req,
    @Body("password") password: string,
    @Body("token") token?: string,
  ) {
    await this.twoFactorService.disableTwoFactor(
      req.user.sub,
      password,
      token || "",
    );
    return { message: "Two-factor authentication disabled successfully" };
  }

  @Post("verify")
  @RateLimit({ points: 5, duration: 900 })
  @HttpCode(HttpStatus.OK)
  async verifyTwoFactor(
    @Body("email") email: string,
    @Body("token") token: string,
  ) {
    return this.twoFactorService.verifyTwoFactorLogin(email, token);
  }

  @Post("recover")
  @RateLimit({ points: 3, duration: 3600 }) // 3 attempts per hour
  @HttpCode(HttpStatus.OK)
  async recoverWithBackupCode(
    @Request() req,
    @Body("password") password: string,
    @Body("backupCode") backupCode: string,
  ) {
    const isValid = await this.twoFactorService.verifyBackupCode(
      req.user.email,
      backupCode,
    );
    if (!isValid) {
      throw new UnauthorizedException("Invalid backup code");
    }
    return { message: "Backup code verified successfully" };
  }
}
