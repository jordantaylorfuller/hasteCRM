import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import * as speakeasy from "speakeasy";
import * as qrcode from "qrcode";
import * as bcrypt from "bcrypt";
import { User, TwoFactorAuth } from "../prisma/prisma-client";
import { TwoFactorSetupResponse } from "./dto/two-factor.dto";

@Injectable()
export class TwoFactorService {
  constructor(private prisma: PrismaService) {}

  async setupTwoFactor(
    userId: string,
    password: string,
  ): Promise<TwoFactorSetupResponse> {
    // Verify user password
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { twoFactorAuth: true },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Invalid user");
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid password");
    }

    // Check if 2FA is already enabled
    if (user.twoFactorAuth?.isEnabled) {
      throw new BadRequestException(
        "Two-factor authentication is already enabled",
      );
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `hasteCRM (${user.email})`,
      length: 32,
    });

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();
    const hashedBackupCodes = await Promise.all(
      backupCodes.map((code) => bcrypt.hash(code, 10)),
    );

    // Generate QR code
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url || "");

    // Save 2FA setup (but not enabled yet)
    if (user.twoFactorAuth) {
      await this.prisma.twoFactorAuth.update({
        where: { userId },
        data: {
          secret: secret.base32,
          backupCodes: hashedBackupCodes,
          isEnabled: false,
        },
      });
    } else {
      await this.prisma.twoFactorAuth.create({
        data: {
          userId,
          secret: secret.base32,
          backupCodes: hashedBackupCodes,
          isEnabled: false,
        },
      });
    }

    return {
      secret: secret.base32,
      qrCode: qrCodeUrl,
      backupCodes,
    };
  }

  async verifyAndEnableTwoFactor(userId: string, token: string): Promise<void> {
    const twoFactorAuth = await this.prisma.twoFactorAuth.findUnique({
      where: { userId },
    });

    if (!twoFactorAuth) {
      throw new BadRequestException("Two-factor authentication not set up");
    }

    if (twoFactorAuth.isEnabled) {
      throw new BadRequestException(
        "Two-factor authentication is already enabled",
      );
    }

    // Verify token
    const isValid = speakeasy.totp.verify({
      secret: twoFactorAuth.secret,
      encoding: "base32",
      token,
      window: 2,
    });

    if (!isValid) {
      throw new UnauthorizedException("Invalid verification code");
    }

    // Enable 2FA
    await this.prisma.twoFactorAuth.update({
      where: { userId },
      data: {
        isEnabled: true,
        lastUsedAt: new Date(),
      },
    });
  }

  async disableTwoFactor(
    userId: string,
    password: string,
    token: string,
  ): Promise<void> {
    // Verify user password
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { twoFactorAuth: true },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Invalid user");
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid password");
    }

    if (!user.twoFactorAuth?.isEnabled) {
      throw new BadRequestException("Two-factor authentication is not enabled");
    }

    // Verify 2FA token (only if provided)
    if (token) {
      const isValid = await this.verifyToken(userId, token);
      if (!isValid) {
        throw new UnauthorizedException("Invalid verification code");
      }
    }

    // Disable 2FA
    await this.prisma.twoFactorAuth.update({
      where: { userId },
      data: {
        isEnabled: false,
      },
    });
  }

  async verifyToken(userId: string, token: string): Promise<boolean> {
    const twoFactorAuth = await this.prisma.twoFactorAuth.findUnique({
      where: { userId },
    });

    if (!twoFactorAuth || !twoFactorAuth.isEnabled) {
      return false;
    }

    // First try TOTP verification
    const isValid = speakeasy.totp.verify({
      secret: twoFactorAuth.secret,
      encoding: "base32",
      token,
      window: 2,
    });

    if (isValid) {
      await this.prisma.twoFactorAuth.update({
        where: { userId },
        data: { lastUsedAt: new Date() },
      });
      return true;
    }

    // If TOTP fails, try backup codes
    for (const hashedCode of twoFactorAuth.backupCodes) {
      const isBackupValid = await bcrypt.compare(token, hashedCode);
      if (isBackupValid) {
        // Remove used backup code
        const updatedCodes = twoFactorAuth.backupCodes.filter(
          (code) => code !== hashedCode,
        );
        await this.prisma.twoFactorAuth.update({
          where: { userId },
          data: {
            backupCodes: updatedCodes,
            lastUsedAt: new Date(),
          },
        });
        return true;
      }
    }

    return false;
  }

  async regenerateBackupCodes(
    userId: string,
    password: string,
  ): Promise<string[]> {
    // Verify user password
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { twoFactorAuth: true },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Invalid user");
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid password");
    }

    if (!user.twoFactorAuth?.isEnabled) {
      throw new BadRequestException("Two-factor authentication is not enabled");
    }

    // Generate new backup codes
    const backupCodes = this.generateBackupCodes();
    const hashedBackupCodes = await Promise.all(
      backupCodes.map((code) => bcrypt.hash(code, 10)),
    );

    // Update backup codes
    await this.prisma.twoFactorAuth.update({
      where: { userId },
      data: {
        backupCodes: hashedBackupCodes,
      },
    });

    return backupCodes;
  }

  async getTwoFactorStatus(
    userId: string,
  ): Promise<{ enabled: boolean; method?: string }> {
    const twoFactorAuth = await this.prisma.twoFactorAuth.findUnique({
      where: { userId },
    });

    return {
      enabled: twoFactorAuth?.isEnabled || false,
      method: twoFactorAuth?.isEnabled ? twoFactorAuth.method : undefined,
    };
  }

  async verifyTwoFactorLogin(email: string, token: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { twoFactorAuth: true },
    });

    if (!user || !user.twoFactorAuth?.isEnabled) {
      throw new UnauthorizedException("Two-factor authentication not enabled");
    }

    // Verify TOTP token
    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorAuth.secret,
      encoding: "base32",
      token,
      window: 2,
    });

    if (isValid) {
      await this.prisma.twoFactorAuth.update({
        where: { userId: user.id },
        data: {
          lastUsedAt: new Date(),
        },
      });
    }

    return isValid;
  }

  async verifyBackupCode(email: string, backupCode: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { twoFactorAuth: true },
    });

    if (!user || !user.twoFactorAuth?.isEnabled) {
      throw new UnauthorizedException("Two-factor authentication not enabled");
    }

    // Check backup codes
    for (let i = 0; i < user.twoFactorAuth.backupCodes.length; i++) {
      const isValid = await bcrypt.compare(
        backupCode,
        user.twoFactorAuth.backupCodes[i],
      );
      
      if (isValid) {
        // Remove used backup code
        const newBackupCodes = [...user.twoFactorAuth.backupCodes];
        newBackupCodes.splice(i, 1);
        
        await this.prisma.twoFactorAuth.update({
          where: { userId: user.id },
          data: {
            backupCodes: newBackupCodes,
            lastUsedAt: new Date(),
          },
        });
        
        return true;
      }
    }

    return false;
  }

  private generateBackupCodes(count = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric codes
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      codes.push(code);
    }
    return codes;
  }
}
