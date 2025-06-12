import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Get,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RateLimitGuard } from "../../common/guards/rate-limit.guard";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { RateLimits } from "../../common/config/rate-limits";
import { TwoFactorService } from "./two-factor.service";
import { AuthService } from "./auth.service";
import {
  EnableTwoFactorDto,
  VerifyTwoFactorDto,
  DisableTwoFactorDto,
  LoginWithTwoFactorDto,
  TwoFactorSetupResponse,
  TwoFactorStatusResponse,
} from "./dto/two-factor.dto";
import { AuthResponse } from "../../common/types/auth.types";

@Controller("auth/2fa")
@UseGuards(RateLimitGuard)
export class TwoFactorController {
  constructor(
    private twoFactorService: TwoFactorService,
    private authService: AuthService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get("status")
  @HttpCode(HttpStatus.OK)
  async getTwoFactorStatus(@Request() req): Promise<TwoFactorStatusResponse> {
    return this.twoFactorService.getTwoFactorStatus(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post("setup")
  @HttpCode(HttpStatus.OK)
  async setupTwoFactor(
    @Request() req,
    @Body() dto: EnableTwoFactorDto,
  ): Promise<TwoFactorSetupResponse> {
    return this.twoFactorService.setupTwoFactor(req.user.userId, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Post("verify")
  @HttpCode(HttpStatus.OK)
  async verifyAndEnableTwoFactor(
    @Request() req,
    @Body() dto: VerifyTwoFactorDto,
  ): Promise<{ message: string }> {
    await this.twoFactorService.verifyAndEnableTwoFactor(
      req.user.userId,
      dto.token,
    );
    return { message: "Two-factor authentication enabled successfully" };
  }

  @UseGuards(JwtAuthGuard)
  @Post("disable")
  @HttpCode(HttpStatus.OK)
  async disableTwoFactor(
    @Request() req,
    @Body() dto: DisableTwoFactorDto,
  ): Promise<{ message: string }> {
    await this.twoFactorService.disableTwoFactor(
      req.user.userId,
      dto.password,
      dto.token,
    );
    return { message: "Two-factor authentication disabled successfully" };
  }

  @UseGuards(JwtAuthGuard)
  @Post("regenerate-backup-codes")
  @HttpCode(HttpStatus.OK)
  async regenerateBackupCodes(
    @Request() req,
    @Body() dto: EnableTwoFactorDto,
  ): Promise<{ backupCodes: string[] }> {
    const backupCodes = await this.twoFactorService.regenerateBackupCodes(
      req.user.userId,
      dto.password,
    );
    return { backupCodes };
  }

  @Post("login")
  @RateLimit(RateLimits.AUTH.TWO_FACTOR)
  @HttpCode(HttpStatus.OK)
  async loginWithTwoFactor(
    @Body() dto: LoginWithTwoFactorDto,
  ): Promise<AuthResponse> {
    return this.authService.loginWithTwoFactor(dto);
  }
}
