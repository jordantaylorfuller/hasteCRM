import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { TwoFactorService } from "./two-factor.service";
import { SessionService } from "./session.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { LoginWithTwoFactorDto } from "./dto/two-factor.dto";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { JwtPayload } from "../../common/interfaces/jwt-payload.interface";
import { User } from "../prisma/prisma-client";
import { AuthResponse, TokenResponse } from "../../common/types/auth.types";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
    private twoFactorService: TwoFactorService,
    private sessionService: SessionService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { email, password, firstName, lastName, workspaceName } = registerDto;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException("User with this email already exists");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create workspace and user in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create workspace
      const workspace = await tx.workspace.create({
        data: {
          name: workspaceName,
          slug: this.generateSlug(workspaceName),
        },
      });

      // Create user with PENDING status for email verification
      const user = await tx.user.create({
        data: {
          email,
          passwordHash: hashedPassword,
          firstName,
          lastName,
          status: "PENDING", // Will be activated after email verification
        },
      });

      // User created successfully

      // Create workspace user relation
      const workspaceUser = await tx.workspaceUser.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: "ADMIN", // First user is workspace admin
          isDefault: true,
        },
        include: {
          workspace: true,
          user: true,
        },
      });

      // Create email verification token
      const verificationToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

      await tx.token.create({
        data: {
          userId: user.id,
          token: verificationToken,
          type: "EMAIL_VERIFICATION",
          expiresAt,
        },
      });

      return { user, workspace, workspaceUser, verificationToken };
    });

    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/auth/verify-email?token=${result.verificationToken}`;
    // Send verification email

    try {
      await this.emailService.sendVerificationEmail(
        result.user.email,
        verificationUrl,
      );
      // Verification email sent successfully
    } catch (error) {
      console.error("Failed to send verification email:", error);
      // Don't fail registration if email fails, but log it
    }

    // Generate tokens
    const tokens = await this.generateTokens(
      result.user,
      result.workspace.id,
      result.workspaceUser.role,
    );

    return {
      user: this.sanitizeUser(result.user),
      workspace: result.workspace,
      ...tokens,
    };
  }

  async login(
    loginDto: LoginDto,
  ): Promise<AuthResponse | { requiresTwoFactor: true; email: string }> {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        workspaces: {
          where: { isDefault: true },
          include: { workspace: true },
        },
        twoFactorAuth: true,
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Check if email is verified (skip in development for testing)
    if (user.status === "PENDING" && process.env.NODE_ENV === "production") {
      throw new UnauthorizedException(
        "Please verify your email before logging in",
      );
    }

    if (!user.workspaces.length) {
      throw new UnauthorizedException("User has no workspace");
    }

    // Check if 2FA is enabled
    if (user.twoFactorAuth?.isEnabled) {
      return {
        requiresTwoFactor: true,
        email: user.email,
      };
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const defaultWorkspace = user.workspaces[0];
    const tokens = await this.generateTokens(
      user,
      defaultWorkspace.workspaceId,
      defaultWorkspace.role,
    );

    return {
      user: this.sanitizeUser(user),
      workspace: defaultWorkspace.workspace,
      ...tokens,
    };
  }

  async loginWithTwoFactor(
    loginDto: LoginWithTwoFactorDto,
  ): Promise<AuthResponse> {
    const { email, password, token } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        workspaces: {
          where: { isDefault: true },
          include: { workspace: true },
        },
        twoFactorAuth: true,
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    // Check if email is verified (skip in development for testing)
    if (user.status === "PENDING" && process.env.NODE_ENV === "production") {
      throw new UnauthorizedException(
        "Please verify your email before logging in",
      );
    }

    if (!user.workspaces.length) {
      throw new UnauthorizedException("User has no workspace");
    }

    // Verify 2FA token
    if (!user.twoFactorAuth?.isEnabled) {
      throw new BadRequestException("Two-factor authentication is not enabled");
    }

    const isValidToken = await this.twoFactorService.verifyToken(
      user.id,
      token,
    );
    if (!isValidToken) {
      throw new UnauthorizedException("Invalid verification code");
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const defaultWorkspace = user.workspaces[0];
    const tokens = await this.generateTokens(
      user,
      defaultWorkspace.workspaceId,
      defaultWorkspace.role,
    );

    return {
      user: this.sanitizeUser(user),
      workspace: defaultWorkspace.workspace,
      ...tokens,
    };
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<Omit<User, "passwordHash"> | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return null;
    }

    return this.sanitizeUser(user);
  }

  async refreshTokens(userId: string): Promise<TokenResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        workspaces: {
          where: { isDefault: true },
          include: { workspace: true },
        },
      },
    });

    if (!user || !user.workspaces.length) {
      throw new UnauthorizedException("User not found or has no workspace");
    }

    const defaultWorkspace = user.workspaces[0];
    const tokens = await this.generateTokens(
      user,
      defaultWorkspace.workspaceId,
      defaultWorkspace.role,
    );

    return tokens;
  }

  private async generateTokens(user: User, workspaceId: string, role: string) {
    const basePayload = {
      sub: user.id,
      email: user.email,
      workspaceId,
      role,
    };

    const accessToken = await this.jwtService.signAsync(
      { ...basePayload, type: "access" as const },
      { expiresIn: "15m" },
    );

    const refreshToken = await this.jwtService.signAsync(
      { ...basePayload, type: "refresh" as const },
      { expiresIn: "7d" },
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  private sanitizeUser(user: User): Omit<User, "passwordHash"> {
    const { passwordHash: _passwordHash, ...sanitized } = user;
    return sanitized;
  }

  private generateSlug(name: string): string {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    // Add timestamp to ensure uniqueness
    return `${baseSlug}-${Date.now()}`;
  }

  async validateOAuthUser(oauthUser: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  }): Promise<AuthResponse> {
    // Check if user exists
    let user = await this.prisma.user.findUnique({
      where: { email: oauthUser.email },
      include: {
        workspaces: {
          where: { isDefault: true },
          include: { workspace: true },
        },
      },
    });

    if (user) {
      // Update Google ID if not set
      if (!user.googleId && oauthUser.googleId) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: oauthUser.googleId,
            avatarUrl: user.avatarUrl || oauthUser.avatar,
            lastLoginAt: new Date(),
          },
          include: {
            workspaces: {
              where: { isDefault: true },
              include: { workspace: true },
            },
          },
        });
      }
    } else {
      // Create new user with workspace
      const workspaceName = `${oauthUser.firstName} ${oauthUser.lastName}'s Workspace`;

      const result = await this.prisma.$transaction(async (tx) => {
        // Create workspace
        const workspace = await tx.workspace.create({
          data: {
            name: workspaceName,
            slug: this.generateSlug(workspaceName),
          },
        });

        // Create user
        const newUser = await tx.user.create({
          data: {
            email: oauthUser.email,
            googleId: oauthUser.googleId,
            firstName: oauthUser.firstName,
            lastName: oauthUser.lastName,
            avatarUrl: oauthUser.avatar,
            status: "ACTIVE", // OAuth users are pre-verified
          },
        });

        // Create workspace user relation
        const workspaceUser = await tx.workspaceUser.create({
          data: {
            workspaceId: workspace.id,
            userId: newUser.id,
            role: "ADMIN",
            isDefault: true,
          },
          include: {
            workspace: true,
            user: true,
          },
        });

        return { user: newUser, workspace, workspaceUser };
      });

      user = await this.prisma.user.findUnique({
        where: { id: result.user.id },
        include: {
          workspaces: {
            where: { isDefault: true },
            include: { workspace: true },
          },
        },
      });
    }

    if (!user || !user.workspaces.length) {
      throw new UnauthorizedException("Failed to authenticate with Google");
    }

    const defaultWorkspace = user.workspaces[0];
    const tokens = await this.generateTokens(
      user,
      defaultWorkspace.workspaceId,
      defaultWorkspace.role,
    );

    return {
      user: this.sanitizeUser(user),
      workspace: defaultWorkspace.workspace,
      ...tokens,
    };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    // Find the token
    const verificationToken = await this.prisma.token.findFirst({
      where: {
        token,
        type: "EMAIL_VERIFICATION",
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
    });

    if (!verificationToken) {
      throw new BadRequestException("Invalid or expired verification token");
    }

    // Update user status and mark token as used
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: verificationToken.userId },
        data: { status: "ACTIVE" },
      });

      await tx.token.update({
        where: { id: verificationToken.id },
        data: { usedAt: new Date() },
      });
    });

    return { message: "Email verified successfully" };
  }

  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new BadRequestException("User not found");
    }

    if (user.status === "ACTIVE") {
      throw new BadRequestException("Email already verified");
    }

    // Delete old verification tokens
    await this.prisma.token.deleteMany({
      where: {
        userId: user.id,
        type: "EMAIL_VERIFICATION",
        usedAt: null,
      },
    });

    // Create new verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await this.prisma.token.create({
      data: {
        userId: user.id,
        token: verificationToken,
        type: "EMAIL_VERIFICATION",
        expiresAt,
      },
    });

    // Send verification email
    const verificationUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/auth/verify-email?token=${verificationToken}`;
    await this.emailService.sendVerificationEmail(email, verificationUrl);

    return { message: "Verification email sent" };
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists or not
      return {
        message: "If the email exists, a password reset link has been sent",
      };
    }

    // Delete old password reset tokens
    await this.prisma.token.deleteMany({
      where: {
        userId: user.id,
        type: "PASSWORD_RESET",
        usedAt: null,
      },
    });

    // Create password reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiry

    await this.prisma.token.create({
      data: {
        userId: user.id,
        token: resetToken,
        type: "PASSWORD_RESET",
        expiresAt,
      },
    });

    // Send password reset email
    const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/auth/reset-password?token=${resetToken}`;
    await this.emailService.sendPasswordResetEmail(email, resetUrl);

    return {
      message: "If the email exists, a password reset link has been sent",
    };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    // Find the token
    const resetToken = await this.prisma.token.findFirst({
      where: {
        token,
        type: "PASSWORD_RESET",
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        user: true,
      },
    });

    if (!resetToken) {
      throw new BadRequestException("Invalid or expired reset token");
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and mark token as used
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash: hashedPassword },
      });

      await tx.token.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      });
    });

    return { message: "Password reset successfully" };
  }

  async verifyTwoFactorLogin(
    email: string,
    password: string,
    token: string,
  ): Promise<AuthResponse> {
    return this.loginWithTwoFactor({ email, password, token });
  }

  async verifyBackupCode(userId: string, backupCode: string): Promise<boolean> {
    return this.twoFactorService.verifyBackupCode(userId, backupCode);
  }

  async getCurrentUser(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        workspaces: {
          where: { isDefault: true },
          include: { workspace: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    const defaultWorkspace = user.workspaces[0];

    return {
      user: this.sanitizeUser(user),
      workspace: defaultWorkspace?.workspace || null,
    };
  }

  async logout(token: string): Promise<void> {
    // Blacklist the token for its remaining TTL
    // JWT tokens have exp claim, so we can decode to get the expiry
    try {
      const decoded = this.jwtService.decode(token) as JwtPayload;
      if (decoded && decoded.exp) {
        const now = Math.floor(Date.now() / 1000);
        const ttl = decoded.exp - now;
        if (ttl > 0) {
          await this.sessionService.blacklistToken(token, ttl);
        }
      }
    } catch (error) {
      // If we can't decode the token, blacklist it for 24 hours
      await this.sessionService.blacklistToken(token, 86400);
    }
  }
}
