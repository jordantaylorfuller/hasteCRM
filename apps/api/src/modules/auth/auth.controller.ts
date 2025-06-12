import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Get,
  Res,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { LoginWithTwoFactorDto } from "./dto/two-factor.dto";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RateLimitGuard } from "../../common/guards/rate-limit.guard";
import { RateLimit } from "../../common/decorators/rate-limit.decorator";
import { RateLimits } from "../../common/config/rate-limits";
import { AuthResponse } from "../../common/types/auth.types";
import { AuthGuard } from "@nestjs/passport";
import { Response } from "express";

@Controller("auth")
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("register")
  @RateLimit(RateLimits.AUTH.REGISTER)
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponse> {
    try {
      console.log("Registration request received:", {
        email: registerDto.email,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        workspaceName: registerDto.workspaceName,
      });
      const result = await this.authService.register(registerDto);
      console.log("Registration successful for:", registerDto.email);
      return result;
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  }

  @Post("login")
  @RateLimit(RateLimits.AUTH.LOGIN)
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post("login/2fa")
  @RateLimit(RateLimits.AUTH.TWO_FACTOR)
  @HttpCode(HttpStatus.OK)
  async loginWithTwoFactor(@Body() loginDto: LoginWithTwoFactorDto) {
    return this.authService.loginWithTwoFactor(loginDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Request() req) {
    return this.authService.refreshTokens(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Request() _req) {
    // In a real app, you might want to blacklist the token or clear session
    return { message: "Logged out successfully" };
  }

  @UseGuards(JwtAuthGuard)
  @Post("me")
  @HttpCode(HttpStatus.OK)
  async me(@Request() req) {
    try {
      return await this.authService.getCurrentUser(req.user.sub);
    } catch (error) {
      // If getting full user data fails, return JWT payload
      return req.user;
    }
  }

  @Get("google")
  @UseGuards(AuthGuard("google"))
  async googleAuth() {
    // Guard redirects to Google
  }

  @Get("google/callback")
  @UseGuards(AuthGuard("google"))
  async googleAuthCallback(@Request() req, @Res() res: Response) {
    // Successful authentication, redirect with tokens
    const authData = req.user as AuthResponse;

    // In production, you'd redirect to your frontend with tokens as query params
    // For now, we'll return JSON response for testing
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3001";
    const redirectUrl = new URL(`${frontendUrl}/auth/callback`);
    redirectUrl.searchParams.append("accessToken", authData.accessToken);
    redirectUrl.searchParams.append("refreshToken", authData.refreshToken);

    res.redirect(redirectUrl.toString());
  }

  @Post("verify-email")
  @RateLimit(RateLimits.AUTH.VERIFY_EMAIL)
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body("token") token: string) {
    return this.authService.verifyEmail(token);
  }

  @Post("resend-verification")
  @RateLimit(RateLimits.AUTH.VERIFY_EMAIL)
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body("email") email: string) {
    return this.authService.resendVerificationEmail(email);
  }

  @Post("forgot-password")
  @RateLimit(RateLimits.AUTH.PASSWORD_RESET)
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body("email") email: string) {
    return this.authService.requestPasswordReset(email);
  }

  @Post("reset-password")
  @RateLimit(RateLimits.AUTH.PASSWORD_RESET)
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body("token") token: string,
    @Body("password") password: string,
  ) {
    return this.authService.resetPassword(token, password);
  }
}
