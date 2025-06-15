import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { JwtService } from "@nestjs/jwt";
import { EmailService } from "../email/email.service";
import { TwoFactorService } from "./two-factor.service";
import { SessionService } from "./session.service";
import { UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcrypt";

// Mock bcrypt
jest.mock("bcrypt", () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe("AuthService - Additional Coverage", () => {
  let service: AuthService;
  let prismaService: PrismaService;
  let emailService: EmailService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
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
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn().mockResolvedValue("mock_token"),
    sign: jest.fn(),
    verify: jest.fn(),
    decode: jest.fn(),
  };

  const mockEmailService = {
    sendVerificationEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
  };

  const mockTwoFactorService = {
    verifyToken: jest.fn(),
  };

  const mockSessionService = {
    blacklistToken: jest.fn(),
  };

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
    emailService = module.get<EmailService>(EmailService);

    jest.clearAllMocks();
  });

  describe("register - edge cases", () => {
    it("should handle email sending failure gracefully", async () => {
      const registerDto = {
        email: "test@example.com",
        password: "password123",
        firstName: "Test",
        lastName: "User",
        workspaceName: "Test Workspace",
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue("hashed_password");

      // Mock transaction
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          workspace: {
            create: jest.fn().mockResolvedValue({
              id: "workspace-123",
              name: registerDto.workspaceName,
              slug: "test-workspace-123",
            }),
          },
          user: {
            create: jest.fn().mockResolvedValue({
              id: "user-123",
              email: registerDto.email,
              passwordHash: "hashed_password",
              firstName: registerDto.firstName,
              lastName: registerDto.lastName,
              status: "PENDING",
            }),
          },
          workspaceUser: {
            create: jest.fn().mockResolvedValue({
              workspaceId: "workspace-123",
              userId: "user-123",
              role: "ADMIN",
              isDefault: true,
              workspace: {
                id: "workspace-123",
                name: registerDto.workspaceName,
              },
              user: {
                id: "user-123",
                email: registerDto.email,
              },
            }),
          },
          token: {
            create: jest.fn().mockResolvedValue({
              id: "token-123",
              token: "verification_token",
              type: "EMAIL_VERIFICATION",
            }),
          },
        };
        return callback(mockTx);
      });

      // Mock email failure
      mockEmailService.sendVerificationEmail.mockRejectedValue(
        new Error("Email service down"),
      );

      // Should not throw - registration should complete even if email fails
      const result = await service.register(registerDto);

      expect(result).toMatchObject({
        user: expect.objectContaining({
          email: registerDto.email,
        }),
        workspace: expect.objectContaining({
          name: registerDto.workspaceName,
        }),
        accessToken: "mock_token",
        refreshToken: "mock_token",
      });

      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalled();
    });
  });

  describe("login - edge cases", () => {
    it("should handle user without passwordHash", async () => {
      const loginDto = {
        email: "oauth@example.com",
        password: "password123",
      };

      const userWithoutPassword = {
        id: "user-123",
        email: loginDto.email,
        passwordHash: null, // OAuth user without password
        workspaces: [
          {
            workspaceId: "workspace-123",
            workspace: { id: "workspace-123" },
            role: "ADMIN",
            isDefault: true,
          },
        ],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(userWithoutPassword);

      await expect(service.login(loginDto)).rejects.toThrow(
        new UnauthorizedException("Invalid credentials"),
      );
    });

    it("should skip email verification check in development", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const loginDto = {
        email: "unverified@example.com",
        password: "password123",
      };

      const unverifiedUser = {
        id: "user-123",
        email: loginDto.email,
        passwordHash: "hashed_password",
        status: "PENDING", // Not verified
        workspaces: [
          {
            workspaceId: "workspace-123",
            workspace: { id: "workspace-123", name: "Test" },
            role: "ADMIN",
            isDefault: true,
          },
        ],
        twoFactorAuth: null,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(unverifiedUser);
      mockPrismaService.user.update.mockResolvedValue({
        ...unverifiedUser,
        lastLoginAt: new Date(),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(loginDto);

      expect(result).toMatchObject({
        user: expect.objectContaining({
          email: loginDto.email,
        }),
        workspace: unverifiedUser.workspaces[0].workspace,
        accessToken: "mock_token",
        refreshToken: "mock_token",
      });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("loginWithTwoFactor - edge cases", () => {
    it("should handle user without passwordHash", async () => {
      const loginDto = {
        email: "oauth@example.com",
        password: "password123",
        token: "123456",
      };

      const userWithoutPassword = {
        id: "user-123",
        email: loginDto.email,
        passwordHash: null,
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

      mockPrismaService.user.findUnique.mockResolvedValue(userWithoutPassword);

      await expect(service.loginWithTwoFactor(loginDto)).rejects.toThrow(
        new UnauthorizedException("Invalid credentials"),
      );
    });

    it("should skip email verification in development for 2FA login", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const loginDto = {
        email: "2fa@example.com",
        password: "password123",
        token: "123456",
      };

      const user = {
        id: "user-123",
        email: loginDto.email,
        passwordHash: "hashed_password",
        status: "PENDING", // Unverified
        workspaces: [
          {
            workspaceId: "workspace-123",
            workspace: { id: "workspace-123", name: "Test" },
            role: "ADMIN",
            isDefault: true,
          },
        ],
        twoFactorAuth: { isEnabled: true },
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.user.update.mockResolvedValue({
        ...user,
        lastLoginAt: new Date(),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockTwoFactorService.verifyToken.mockResolvedValue(true);

      const result = await service.loginWithTwoFactor(loginDto);

      expect(result).toMatchObject({
        user: expect.objectContaining({
          email: loginDto.email,
        }),
        accessToken: "mock_token",
        refreshToken: "mock_token",
      });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("validateUser", () => {
    it("should return null for user without passwordHash", async () => {
      const email = "oauth@example.com";
      const password = "password123";

      const userWithoutPassword = {
        id: "user-123",
        email,
        passwordHash: null,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(userWithoutPassword);

      const result = await service.validateUser(email, password);

      expect(result).toBeNull();
    });

    it("should return null for incorrect password", async () => {
      const email = "test@example.com";
      const password = "wrong_password";

      const user = {
        id: "user-123",
        email,
        passwordHash: "hashed_password",
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser(email, password);

      expect(result).toBeNull();
      expect(bcrypt.compare).toHaveBeenCalledWith(password, user.passwordHash);
    });
  });

  describe("verifyEmail", () => {
    it("should verify email successfully", async () => {
      const token = "valid_token";
      const verificationToken = {
        id: "token-123",
        token,
        type: "EMAIL_VERIFICATION",
        userId: "user-123",
        usedAt: null,
        expiresAt: new Date(Date.now() + 86400000), // Future date
        user: {
          id: "user-123",
          email: "test@example.com",
        },
      };

      mockPrismaService.token.findFirst.mockResolvedValue(verificationToken);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          user: {
            update: jest.fn().mockResolvedValue({
              id: "user-123",
              status: "ACTIVE",
            }),
          },
          token: {
            update: jest.fn().mockResolvedValue({
              ...verificationToken,
              usedAt: new Date(),
            }),
          },
        };
        return callback(mockTx);
      });

      const result = await service.verifyEmail(token);

      expect(mockPrismaService.token.findFirst).toHaveBeenCalledWith({
        where: {
          token,
          type: "EMAIL_VERIFICATION",
          usedAt: null,
          expiresAt: {
            gt: expect.any(Date),
          },
        },
        include: {
          user: true,
        },
      });

      expect(result).toEqual({ message: "Email verified successfully" });
    });
  });

  describe("requestPasswordReset", () => {
    it("should not reveal if user doesn't exist", async () => {
      const email = "nonexistent@example.com";

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.requestPasswordReset(email);

      expect(result).toEqual({
        message: "If the email exists, a password reset link has been sent",
      });

      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe("resetPassword", () => {
    it("should reset password successfully", async () => {
      const token = "reset_token";
      const newPassword = "newPassword123";
      const resetToken = {
        id: "token-123",
        token,
        type: "PASSWORD_RESET",
        userId: "user-123",
        usedAt: null,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
        user: {
          id: "user-123",
          email: "test@example.com",
        },
      };

      mockPrismaService.token.findFirst.mockResolvedValue(resetToken);
      (bcrypt.hash as jest.Mock).mockResolvedValue("new_hashed_password");

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          user: {
            update: jest.fn().mockResolvedValue({
              id: "user-123",
              passwordHash: "new_hashed_password",
            }),
          },
          token: {
            update: jest.fn().mockResolvedValue({
              ...resetToken,
              usedAt: new Date(),
            }),
          },
        };
        return callback(mockTx);
      });

      const result = await service.resetPassword(token, newPassword);

      expect(mockPrismaService.token.findFirst).toHaveBeenCalledWith({
        where: {
          token,
          type: "PASSWORD_RESET",
          usedAt: null,
          expiresAt: {
            gt: expect.any(Date),
          },
        },
        include: {
          user: true,
        },
      });

      expect(bcrypt.hash).toHaveBeenCalledWith(newPassword, 10);
      expect(result).toEqual({ message: "Password reset successfully" });
    });
  });
});
