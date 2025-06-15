import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { JwtService } from "@nestjs/jwt";
import { EmailService } from "../email/email.service";
import { TwoFactorService } from "./two-factor.service";
import { SessionService } from "./session.service";
import { UnauthorizedException, BadRequestException } from "@nestjs/common";
import * as bcrypt from "bcrypt";

// Mock bcrypt
jest.mock("bcrypt", () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe("AuthService - Missing Coverage", () => {
  let service: AuthService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    workspace: {},
    workspaceUser: {},
    token: {},
    $transaction: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn().mockResolvedValue("mock_token"),
  };

  const mockEmailService = {
    sendVerificationEmail: jest.fn(),
  };

  const mockTwoFactorService = {
    verifyToken: jest.fn(),
  };

  const mockSessionService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: TwoFactorService, useValue: mockTwoFactorService },
        { provide: SessionService, useValue: mockSessionService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe("login - missing coverage", () => {
    it("should throw error when password is invalid (line 151)", async () => {
      const loginDto = {
        email: "test@example.com",
        password: "wrong_password",
      };

      const user = {
        id: "user-123",
        email: loginDto.email,
        passwordHash: "hashed_password",
        status: "ACTIVE",
        workspaces: [
          {
            workspaceId: "workspace-123",
            workspace: { id: "workspace-123" },
            role: "ADMIN",
            isDefault: true,
          },
        ],
        twoFactorAuth: null,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException("Invalid credentials"),
      );

      expect(bcrypt.compare).toHaveBeenCalledWith(
        loginDto.password,
        user.passwordHash,
      );
    });

    it("should throw error when user has no workspace (line 162)", async () => {
      const loginDto = {
        email: "test@example.com",
        password: "password123",
      };

      const user = {
        id: "user-123",
        email: loginDto.email,
        passwordHash: "hashed_password",
        status: "ACTIVE",
        workspaces: [], // No workspaces
        twoFactorAuth: null,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException("User has no workspace"),
      );
    });
  });

  describe("loginWithTwoFactor - missing coverage", () => {
    it("should throw error when password is invalid (line 215)", async () => {
      const loginDto = {
        email: "test@example.com",
        password: "wrong_password",
        token: "123456",
      };

      const user = {
        id: "user-123",
        email: loginDto.email,
        passwordHash: "hashed_password",
        status: "ACTIVE",
        workspaces: [
          {
            workspaceId: "workspace-123",
            workspace: { id: "workspace-123" },
            role: "ADMIN",
            isDefault: true,
          },
        ],
        twoFactorAuth: { isEnabled: true },
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.loginWithTwoFactor(loginDto)).rejects.toThrow(
        new UnauthorizedException("Invalid credentials"),
      );
    });

    it("should throw error in production when email not verified (line 220)", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const loginDto = {
        email: "test@example.com",
        password: "password123",
        token: "123456",
      };

      const user = {
        id: "user-123",
        email: loginDto.email,
        passwordHash: "hashed_password",
        status: "PENDING", // Not verified
        workspaces: [
          {
            workspaceId: "workspace-123",
            workspace: { id: "workspace-123" },
            role: "ADMIN",
            isDefault: true,
          },
        ],
        twoFactorAuth: { isEnabled: true },
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.loginWithTwoFactor(loginDto)).rejects.toThrow(
        new UnauthorizedException("Please verify your email before logging in"),
      );

      process.env.NODE_ENV = originalEnv;
    });

    it("should throw error when user has no workspace (line 226)", async () => {
      const loginDto = {
        email: "test@example.com",
        password: "password123",
        token: "123456",
      };

      const user = {
        id: "user-123",
        email: loginDto.email,
        passwordHash: "hashed_password",
        status: "ACTIVE",
        workspaces: [], // No workspaces
        twoFactorAuth: { isEnabled: true },
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.loginWithTwoFactor(loginDto)).rejects.toThrow(
        new UnauthorizedException("User has no workspace"),
      );
    });

    it("should throw error when 2FA is not enabled (line 231)", async () => {
      const loginDto = {
        email: "test@example.com",
        password: "password123",
        token: "123456",
      };

      const user = {
        id: "user-123",
        email: loginDto.email,
        passwordHash: "hashed_password",
        status: "ACTIVE",
        workspaces: [
          {
            workspaceId: "workspace-123",
            workspace: { id: "workspace-123" },
            role: "ADMIN",
            isDefault: true,
          },
        ],
        twoFactorAuth: { isEnabled: false }, // 2FA not enabled
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.loginWithTwoFactor(loginDto)).rejects.toThrow(
        new BadRequestException("Two-factor authentication is not enabled"),
      );
    });
  });
});
