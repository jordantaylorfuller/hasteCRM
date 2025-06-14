import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { JwtService } from "@nestjs/jwt";
import { RedisService } from "../redis/redis.service";
import { EmailService } from "../email/email.service";
import { TwoFactorService } from "./two-factor.service";
import { SessionService } from "./session.service";
import { ConfigService } from "@nestjs/config";
import {
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import * as crypto from "crypto";

// Mock bcrypt
jest.mock("bcrypt", () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const bcrypt = require("bcrypt");

describe("AuthService", () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let redisService: RedisService;
  let emailService: EmailService;
  let configService: ConfigService;
  let twoFactorService: any;
  let sessionService: any;

  const mockUser = {
    id: "user-123",
    email: "test@example.com",
    passwordHash: "$2b$10$abcdefghijklmnopqrstuvwxyz123456", // bcrypt hash
    firstName: "Test",
    lastName: "User",
    status: "ACTIVE",
    twoFactorEnabled: false,
    twoFactorSecret: null,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    workspaces: [
      {
        workspaceId: "workspace-123",
        role: "ADMIN",
        isDefault: true,
        workspace: {
          id: "workspace-123",
          name: "Test Workspace",
          slug: "test-workspace",
          plan: "FREE",
        },
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            workspace: {
              create: jest.fn(),
            },
            workspaceUser: {
              create: jest.fn(),
            },
            token: {
              create: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              deleteMany: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            signAsync: jest.fn(),
            verify: jest.fn(),
            decode: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            set: jest.fn(),
            get: jest.fn(),
            del: jest.fn(),
            setex: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendVerificationEmail: jest.fn(),
            sendPasswordResetEmail: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: TwoFactorService,
          useValue: {
            verifyToken: jest.fn(),
            verifyBackupCode: jest.fn(),
          },
        },
        {
          provide: SessionService,
          useValue: {
            createSession: jest.fn(),
            blacklistToken: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    redisService = module.get<RedisService>(RedisService);
    emailService = module.get<EmailService>(EmailService);
    configService = module.get<ConfigService>(ConfigService);
    twoFactorService = module.get<TwoFactorService>(TwoFactorService);
    sessionService = module.get<SessionService>(SessionService);

    // Setup default config values
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      const config: Record<string, any> = {
        JWT_SECRET: "test-secret",
        JWT_REFRESH_SECRET: "test-refresh-secret",
        FRONTEND_URL: "http://localhost:3000",
      };
      return config[key];
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("validateUser", () => {
    it("should return user when credentials are valid", async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser(
        "test@example.com",
        "password123",
      );

      expect(result).toEqual(
        expect.objectContaining({
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
        }),
      );
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
      });
    });

    it("should return null when user not found", async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.validateUser(
        "nonexistent@example.com",
        "password",
      );

      expect(result).toBeNull();
    });

    it("should return null when password is invalid", async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser(
        "test@example.com",
        "wrongpassword",
      );

      expect(result).toBeNull();
    });
  });

  describe("login", () => {
    const loginDto = { email: "test@example.com", password: "password123" };

    it("should successfully login a user", async () => {
      const tokens = {
        accessToken: "access-token",
        refreshToken: "refresh-token",
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwtService.signAsync as jest.Mock)
        .mockResolvedValueOnce(tokens.accessToken)
        .mockResolvedValueOnce(tokens.refreshToken);
      (prismaService.user.update as jest.Mock).mockResolvedValue({});

      const result = await service.login(loginDto);

      expect(result).toEqual({
        user: expect.objectContaining({
          id: mockUser.id,
          email: mockUser.email,
          firstName: mockUser.firstName,
          lastName: mockUser.lastName,
        }),
        workspace: mockUser.workspaces[0].workspace,
        ...tokens,
      });
    });

    it("should throw UnauthorizedException for invalid credentials", async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("should throw UnauthorizedException for pending email verification in production", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const unverifiedUser = {
        ...mockUser,
        emailVerified: false,
        status: "PENDING",
      };
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(
        unverifiedUser,
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException("Please verify your email before logging in"),
      );

      process.env.NODE_ENV = originalEnv;
    });

    it("should return requiresTwoFactor when 2FA is enabled", async () => {
      const userWith2FA = {
        ...mockUser,
        twoFactorAuth: { isEnabled: true },
      };
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(
        userWith2FA,
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(loginDto);

      expect(result).toEqual({
        requiresTwoFactor: true,
        email: mockUser.email,
      });
    });
  });

  describe("register", () => {
    const registerDto = {
      email: "new@example.com",
      password: "Password123!",
      firstName: "New",
      lastName: "User",
      workspaceName: "New Workspace",
    };

    it("should successfully register a new user", async () => {
      const hashedPassword = "hashed-password";
      const newUser = { ...mockUser, id: "new-user-123", status: "PENDING" };
      const newWorkspace = {
        id: "new-workspace-123",
        name: "New Workspace",
        slug: "new-workspace",
        plan: "FREE",
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);
      (prismaService.$transaction as jest.Mock).mockImplementation(
        async (fn) => {
          const prismaTx = {
            user: { create: jest.fn().mockResolvedValue(newUser) },
            workspace: { create: jest.fn().mockResolvedValue(newWorkspace) },
            workspaceUser: {
              create: jest.fn().mockResolvedValue({
                workspaceId: newWorkspace.id,
                userId: newUser.id,
                role: "ADMIN",
                isDefault: true,
                workspace: newWorkspace,
                user: newUser,
              }),
            },
            token: { create: jest.fn() },
          };
          return fn(prismaTx);
        },
      );
      (jwtService.signAsync as jest.Mock)
        .mockResolvedValueOnce("token")
        .mockResolvedValueOnce("token");

      const result = await service.register(registerDto);

      expect(result).toEqual({
        user: expect.objectContaining({
          id: newUser.id,
          email: newUser.email,
        }),
        workspace: newWorkspace,
        accessToken: "token",
        refreshToken: "token",
      });
      expect(emailService.sendVerificationEmail).toHaveBeenCalled();
    });

    it("should throw ConflictException if email already exists", async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        new ConflictException("User with this email already exists"),
      );
    });
  });

  describe("refreshTokens", () => {
    it("should generate new tokens for valid user", async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (jwtService.signAsync as jest.Mock)
        .mockResolvedValueOnce("new-access-token")
        .mockResolvedValueOnce("new-refresh-token");

      const result = await service.refreshTokens(mockUser.id);

      expect(result).toEqual({
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
      });
    });

    it("should throw UnauthorizedException for user without workspace", async () => {
      const userWithoutWorkspace = { ...mockUser, workspaces: [] };
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(
        userWithoutWorkspace,
      );

      await expect(service.refreshTokens(mockUser.id)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe("verifyEmail", () => {
    it("should verify email with valid token", async () => {
      const token = "valid-token";
      const verificationToken = {
        id: "token-id",
        token,
        userId: mockUser.id,
        type: "EMAIL_VERIFICATION",
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
        user: mockUser,
      };

      (prismaService.token.findFirst as jest.Mock).mockResolvedValue(
        verificationToken,
      );
      (prismaService.$transaction as jest.Mock).mockImplementation(
        async (fn) => {
          const prismaTx = {
            user: { update: jest.fn() },
            token: { update: jest.fn() },
          };
          return fn(prismaTx);
        },
      );

      const result = await service.verifyEmail(token);

      expect(result).toEqual({ message: "Email verified successfully" });
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it("should throw BadRequestException for invalid token", async () => {
      (prismaService.token.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.verifyEmail("invalid-token")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("requestPasswordReset", () => {
    it("should send password reset email for existing user", async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.token.deleteMany as jest.Mock).mockResolvedValue({});
      (prismaService.token.create as jest.Mock).mockResolvedValue({});

      const result = await service.requestPasswordReset("test@example.com");

      expect(result).toEqual({
        message: "If the email exists, a password reset link has been sent",
      });
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        mockUser.email,
        expect.stringContaining("reset-password?token="),
      );
    });

    it("should return generic message for non-existent email", async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.requestPasswordReset(
        "nonexistent@example.com",
      );

      expect(result).toEqual({
        message: "If the email exists, a password reset link has been sent",
      });
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe("resetPassword", () => {
    const token = "reset-token";
    const newPassword = "NewPassword123!";

    it("should reset password with valid token", async () => {
      const resetToken = {
        id: "reset-token-id",
        token,
        userId: mockUser.id,
        type: "PASSWORD_RESET",
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
        user: mockUser,
      };

      (prismaService.token.findFirst as jest.Mock).mockResolvedValue(
        resetToken,
      );
      (bcrypt.hash as jest.Mock).mockResolvedValue("new-hash");
      (prismaService.$transaction as jest.Mock).mockImplementation(
        async (fn) => {
          const prismaTx = {
            user: { update: jest.fn() },
            token: { update: jest.fn() },
          };
          return fn(prismaTx);
        },
      );

      const result = await service.resetPassword(token, newPassword);

      expect(result).toEqual({ message: "Password reset successfully" });
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it("should throw BadRequestException for invalid token", async () => {
      (prismaService.token.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.resetPassword(token, newPassword)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("logout", () => {
    it("should blacklist token with valid JWT", async () => {
      const token = "valid-jwt-token";
      const decodedToken = {
        sub: mockUser.id,
        email: mockUser.email,
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      (jwtService.decode as jest.Mock).mockReturnValue(decodedToken);

      await service.logout(token);

      expect(sessionService.blacklistToken).toHaveBeenCalledWith(
        token,
        expect.any(Number),
      );
    });

    it("should blacklist token for 24 hours if decode fails", async () => {
      const token = "invalid-jwt-token";

      (jwtService.decode as jest.Mock).mockImplementation(() => {
        throw new Error("Invalid token");
      });

      await service.logout(token);

      expect(sessionService.blacklistToken).toHaveBeenCalledWith(token, 86400);
    });
  });

  describe("loginWithTwoFactor", () => {
    const loginDto = {
      email: "test@example.com",
      password: "password123",
      token: "123456",
    };

    it("should login user with valid 2FA token", async () => {
      const userWith2FA = {
        ...mockUser,
        twoFactorAuth: { isEnabled: true },
      };
      const tokens = {
        accessToken: "access-token",
        refreshToken: "refresh-token",
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(
        userWith2FA,
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (twoFactorService.verifyToken as jest.Mock).mockResolvedValue(true);
      (jwtService.signAsync as jest.Mock)
        .mockResolvedValueOnce(tokens.accessToken)
        .mockResolvedValueOnce(tokens.refreshToken);
      (prismaService.user.update as jest.Mock).mockResolvedValue({});

      const result = await service.loginWithTwoFactor(loginDto);

      expect(result).toEqual({
        user: expect.objectContaining({
          id: mockUser.id,
          email: mockUser.email,
        }),
        workspace: mockUser.workspaces[0].workspace,
        ...tokens,
      });
    });

    it("should throw UnauthorizedException for invalid 2FA token", async () => {
      const userWith2FA = {
        ...mockUser,
        twoFactorAuth: { isEnabled: true },
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(
        userWith2FA,
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (twoFactorService.verifyToken as jest.Mock).mockResolvedValue(false);

      await expect(service.loginWithTwoFactor(loginDto)).rejects.toThrow(
        new UnauthorizedException("Invalid verification code"),
      );
    });
  });
});
