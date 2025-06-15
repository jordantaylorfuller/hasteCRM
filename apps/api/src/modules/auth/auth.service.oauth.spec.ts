import { Test, TestingModule } from "@nestjs/testing";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { JwtService } from "@nestjs/jwt";
import { EmailService } from "../email/email.service";
import { TwoFactorService } from "./two-factor.service";
import { SessionService } from "./session.service";
import * as bcrypt from "bcrypt"; // eslint-disable-line @typescript-eslint/no-unused-vars
import * as crypto from "crypto"; // eslint-disable-line @typescript-eslint/no-unused-vars

// Mock bcrypt
jest.mock("bcrypt", () => ({
  hash: jest.fn().mockResolvedValue("hashed_password"),
}));

// Create a local mock for crypto
const _mockCrypto = {
  randomBytes: jest.fn().mockReturnValue(Buffer.from("verification_token_123")),
};

describe("AuthService - OAuth", () => {
  let service: AuthService;
  let _prismaService: PrismaService;
  let _jwtService: JwtService;
  let _emailService: EmailService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    workspace: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    workspaceUser: {
      create: jest.fn(),
      findFirst: jest.fn(),
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
    signAsync: jest.fn(),
    sign: jest.fn(),
    verify: jest.fn(),
    decode: jest.fn(),
  };

  const mockEmailService = {
    sendWelcomeEmail: jest.fn(),
    sendVerificationEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
  };

  const mockTwoFactorService = {
    verifyToken: jest.fn(),
    verifyBackupCode: jest.fn(),
  };

  const mockSessionService = {
    createSession: jest.fn(),
    validateSession: jest.fn(),
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
    _prismaService = module.get<PrismaService>(PrismaService);
    _jwtService = module.get<JwtService>(JwtService);
    _emailService = module.get<EmailService>(EmailService);

    // Reset all mocks
    jest.clearAllMocks();

    // Default JWT mock
    mockJwtService.signAsync.mockResolvedValue("mock_token");
  });

  describe("validateOAuthUser", () => {
    const mockOAuthUser = {
      googleId: "google-123",
      email: "oauth@example.com",
      firstName: "OAuth",
      lastName: "User",
      avatar: "https://example.com/avatar.jpg",
    };

    it("should login existing user with OAuth", async () => {
      const existingUser = {
        id: "user-123",
        email: mockOAuthUser.email,
        googleId: mockOAuthUser.googleId,
        status: "ACTIVE",
        workspaces: [
          {
            workspaceId: "workspace-123",
            workspace: { id: "workspace-123", name: "Test Workspace" },
            role: "ADMIN",
            isDefault: true,
          },
        ],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);

      const result = await service.validateOAuthUser(mockOAuthUser);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: mockOAuthUser.email },
        include: {
          workspaces: {
            where: { isDefault: true },
            include: { workspace: true },
          },
        },
      });

      // User already has googleId, so no update should be called
      expect(mockPrismaService.user.update).not.toHaveBeenCalled();

      expect(result).toMatchObject({
        user: expect.objectContaining({
          id: existingUser.id,
          email: existingUser.email,
        }),
        workspace: existingUser.workspaces[0].workspace,
        accessToken: "mock_token",
        refreshToken: "mock_token",
      });
    });

    it("should create new user with OAuth", async () => {
      const newUser = {
        id: "new-user-123",
        email: mockOAuthUser.email,
        googleId: mockOAuthUser.googleId,
        firstName: mockOAuthUser.firstName,
        lastName: mockOAuthUser.lastName,
        avatar: mockOAuthUser.avatar,
        status: "ACTIVE",
        emailVerified: true,
      };

      const newWorkspace = {
        id: "new-workspace-123",
        name: `${mockOAuthUser.firstName}'s Workspace`,
        slug: "oauth-workspace-123",
      };

      const workspaceUser = {
        workspaceId: newWorkspace.id,
        userId: newUser.id,
        role: "ADMIN",
        isDefault: true,
        workspace: newWorkspace,
        user: newUser,
      };

      // Mock transaction for user creation
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          workspace: {
            create: jest.fn().mockResolvedValue(newWorkspace),
          },
          user: {
            create: jest.fn().mockResolvedValue(newUser),
          },
          workspaceUser: {
            create: jest.fn().mockResolvedValue(workspaceUser),
          },
        };
        return callback(mockTx);
      });

      // Mock the findUnique call after transaction
      const userWithWorkspaces = {
        ...newUser,
        workspaces: [
          {
            workspaceId: newWorkspace.id,
            userId: newUser.id,
            role: "ADMIN",
            isDefault: true,
            workspace: newWorkspace,
          },
        ],
      };
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null) // First call - user doesn't exist
        .mockResolvedValueOnce(userWithWorkspaces); // Second call - after creation

      const result = await service.validateOAuthUser(mockOAuthUser);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: mockOAuthUser.email },
        include: {
          workspaces: {
            where: { isDefault: true },
            include: { workspace: true },
          },
        },
      });

      expect(mockPrismaService.$transaction).toHaveBeenCalled();

      expect(result).toMatchObject({
        user: expect.objectContaining({
          email: mockOAuthUser.email,
          googleId: mockOAuthUser.googleId,
        }),
        workspace: newWorkspace,
        accessToken: "mock_token",
        refreshToken: "mock_token",
      });
    });

    it("should update existing user's Google ID if missing", async () => {
      const existingUser = {
        id: "user-123",
        email: mockOAuthUser.email,
        googleId: null, // No Google ID yet
        status: "ACTIVE",
        workspaces: [
          {
            workspaceId: "workspace-123",
            workspace: { id: "workspace-123", name: "Test Workspace" },
            role: "ADMIN",
            isDefault: true,
          },
        ],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaService.user.update.mockResolvedValue({
        ...existingUser,
        googleId: mockOAuthUser.googleId,
        lastLoginAt: new Date(),
      });

      const result = await service.validateOAuthUser(mockOAuthUser);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: existingUser.id },
        data: {
          googleId: mockOAuthUser.googleId,
          avatarUrl: existingUser.avatarUrl || mockOAuthUser.avatar,
          lastLoginAt: expect.any(Date),
        },
        include: {
          workspaces: {
            where: { isDefault: true },
            include: { workspace: true },
          },
        },
      });

      expect(result.user.googleId).toBe(mockOAuthUser.googleId);
    });

    it("should handle existing user without workspaces", async () => {
      const userWithoutWorkspace = {
        id: "user-123",
        email: mockOAuthUser.email,
        googleId: mockOAuthUser.googleId,
        status: "ACTIVE",
        workspaces: [], // No workspaces
      };

      mockPrismaService.user.findUnique.mockResolvedValue(userWithoutWorkspace);

      await expect(service.validateOAuthUser(mockOAuthUser)).rejects.toThrow(
        "Failed to authenticate with Google",
      );
    });

    it("should handle OAuth user creation with custom workspace name", async () => {
      const oauthUserWithoutLastName = {
        ...mockOAuthUser,
        lastName: "",
      };

      const newUser = {
        id: "new-user-123",
        email: oauthUserWithoutLastName.email,
        googleId: oauthUserWithoutLastName.googleId,
        firstName: oauthUserWithoutLastName.firstName,
        lastName: "",
        status: "ACTIVE",
      };

      const newWorkspace = {
        id: "new-workspace-123",
        name: `${oauthUserWithoutLastName.firstName}'s Workspace`,
        slug: "oauth-workspace-123",
      };

      // Mock the findUnique calls
      const userWithWorkspaces = {
        ...newUser,
        workspaces: [
          {
            workspaceId: newWorkspace.id,
            userId: newUser.id,
            role: "ADMIN",
            isDefault: true,
            workspace: newWorkspace,
          },
        ],
      };
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null) // First call - user doesn't exist
        .mockResolvedValueOnce(userWithWorkspaces); // Second call - after creation

      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          workspace: {
            create: jest.fn().mockResolvedValue(newWorkspace),
          },
          user: {
            create: jest.fn().mockResolvedValue(newUser),
          },
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
        };
        return callback(mockTx);
      });

      const result = await service.validateOAuthUser(oauthUserWithoutLastName);

      expect(result.workspace.name).toBe(
        `${oauthUserWithoutLastName.firstName}'s Workspace`,
      );
    });
  });

  describe("resendVerificationEmail", () => {
    it("should resend verification email for unverified user", async () => {
      const unverifiedUser = {
        id: "user-123",
        email: "unverified@example.com",
        status: "PENDING",
      };

      mockPrismaService.user.findUnique.mockResolvedValue(unverifiedUser);
      mockPrismaService.token.deleteMany.mockResolvedValue({ count: 1 });
      // The actual token will be a hex string
      const expectedToken = Buffer.from("verification_token_123").toString(
        "hex",
      );
      mockPrismaService.token.create.mockResolvedValue({
        id: "token-123",
        userId: unverifiedUser.id,
        token: expectedToken,
        type: "EMAIL_VERIFICATION",
        expiresAt: new Date(Date.now() + 86400000), // 24 hours
      });

      const result = await service.resendVerificationEmail(
        unverifiedUser.email,
      );

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: unverifiedUser.email },
      });

      expect(mockPrismaService.token.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: unverifiedUser.id,
          type: "EMAIL_VERIFICATION",
          usedAt: null,
        },
      });

      expect(mockPrismaService.token.create).toHaveBeenCalledWith({
        data: {
          userId: unverifiedUser.id,
          token: expect.any(String),
          type: "EMAIL_VERIFICATION",
          expiresAt: expect.any(Date),
        },
      });

      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledWith(
        unverifiedUser.email,
        expect.stringContaining("verify-email?token="),
      );

      expect(result).toEqual({ message: "Verification email sent" });

      // Restore mock
      jest.restoreAllMocks();
    });

    it("should throw error if user not found", async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.resendVerificationEmail("nonexistent@example.com"),
      ).rejects.toThrow("User not found");

      expect(mockEmailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it("should throw error if email already verified", async () => {
      const verifiedUser = {
        id: "user-123",
        email: "verified@example.com",
        status: "ACTIVE",
      };

      mockPrismaService.user.findUnique.mockResolvedValue(verifiedUser);

      await expect(
        service.resendVerificationEmail(verifiedUser.email),
      ).rejects.toThrow("Email already verified");

      expect(mockEmailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it("should handle email sending failure gracefully", async () => {
      const unverifiedUser = {
        id: "user-123",
        email: "unverified@example.com",
        status: "PENDING",
      };

      mockPrismaService.user.findUnique.mockResolvedValue(unverifiedUser);
      mockPrismaService.token.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.token.create.mockResolvedValue({
        id: "token-123",
        token: "verification_token",
        type: "EMAIL_VERIFICATION",
        expiresAt: new Date(),
      });

      mockEmailService.sendVerificationEmail.mockRejectedValue(
        new Error("Email service error"),
      );

      await expect(
        service.resendVerificationEmail(unverifiedUser.email),
      ).rejects.toThrow("Email service error");
    });
  });

  describe("verifyTwoFactorLogin", () => {
    it("should verify two-factor login", async () => {
      const email = "2fa@example.com";
      const password = "password123";
      const token = "123456";

      const expectedResult = {
        user: { id: "user-123", email },
        workspace: { id: "workspace-123" },
        accessToken: "access_token",
        refreshToken: "refresh_token",
      };

      // Mock the loginWithTwoFactor method
      jest
        .spyOn(service, "loginWithTwoFactor")
        .mockResolvedValue(expectedResult);

      const result = await service.verifyTwoFactorLogin(email, password, token);

      expect(service.loginWithTwoFactor).toHaveBeenCalledWith({
        email,
        password,
        token,
      });

      expect(result).toEqual(expectedResult);
    });
  });

  describe("verifyBackupCode", () => {
    it("should verify backup code", async () => {
      const userId = "user-123";
      const backupCode = "backup-code-123";

      mockTwoFactorService.verifyBackupCode.mockResolvedValue(true);

      const result = await service.verifyBackupCode(userId, backupCode);

      expect(mockTwoFactorService.verifyBackupCode).toHaveBeenCalledWith(
        userId,
        backupCode,
      );

      expect(result).toBe(true);
    });

    it("should return false for invalid backup code", async () => {
      const userId = "user-123";
      const backupCode = "invalid-code";

      mockTwoFactorService.verifyBackupCode.mockResolvedValue(false);

      const result = await service.verifyBackupCode(userId, backupCode);

      expect(mockTwoFactorService.verifyBackupCode).toHaveBeenCalledWith(
        userId,
        backupCode,
      );

      expect(result).toBe(false);
    });
  });

  describe("getCurrentUser", () => {
    it("should get current user with workspace", async () => {
      const userId = "user-123";
      const mockUser = {
        id: userId,
        email: "user@example.com",
        passwordHash: "hash",
        workspaces: [
          {
            workspaceId: "workspace-123",
            workspace: {
              id: "workspace-123",
              name: "Test Workspace",
            },
            isDefault: true,
          },
        ],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getCurrentUser(userId);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        include: {
          workspaces: {
            where: { isDefault: true },
            include: { workspace: true },
          },
        },
      });

      expect(result).toEqual({
        user: expect.not.objectContaining({ passwordHash: expect.anything() }),
        workspace: mockUser.workspaces[0].workspace,
      });
    });

    it("should handle user without workspace", async () => {
      const userId = "user-123";
      const mockUser = {
        id: userId,
        email: "user@example.com",
        passwordHash: "hash",
        workspaces: [],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getCurrentUser(userId);

      expect(result).toEqual({
        user: expect.not.objectContaining({ passwordHash: expect.anything() }),
        workspace: null,
      });
    });

    it("should throw error if user not found", async () => {
      const userId = "nonexistent-user";

      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getCurrentUser(userId)).rejects.toThrow(
        "User not found",
      );
    });
  });

  describe("logout", () => {
    it("should blacklist token with remaining TTL", async () => {
      const token = "valid-jwt-token";
      const decodedToken = {
        sub: "user-123",
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      };

      mockJwtService.decode.mockReturnValue(decodedToken);
      mockSessionService.blacklistToken.mockResolvedValue(undefined);

      await service.logout(token);

      expect(mockJwtService.decode).toHaveBeenCalledWith(token);
      expect(mockSessionService.blacklistToken).toHaveBeenCalledWith(
        token,
        expect.any(Number),
      );

      // Verify TTL calculation
      const [, ttl] = mockSessionService.blacklistToken.mock.calls[0];
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(3600);
    });

    it("should not blacklist expired token", async () => {
      const token = "expired-jwt-token";
      const decodedToken = {
        sub: "user-123",
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      };

      mockJwtService.decode.mockReturnValue(decodedToken);
      mockSessionService.blacklistToken.mockResolvedValue(undefined);

      await service.logout(token);

      // Should not blacklist expired tokens since TTL is negative
      expect(mockSessionService.blacklistToken).not.toHaveBeenCalled();
    });

    it("should handle decode errors by blacklisting for 24 hours", async () => {
      const token = "invalid-jwt-token";

      mockJwtService.decode.mockImplementation(() => {
        throw new Error("Invalid token");
      });
      mockSessionService.blacklistToken.mockResolvedValue(undefined);

      await service.logout(token);

      expect(mockSessionService.blacklistToken).toHaveBeenCalledWith(
        token,
        86400, // 24 hours
      );
    });

    it("should not blacklist tokens without exp claim", async () => {
      const token = "token-without-exp";
      const decodedToken = {
        sub: "user-123",
        // No exp claim
      };

      mockJwtService.decode.mockReturnValue(decodedToken);
      mockSessionService.blacklistToken.mockResolvedValue(undefined);

      await service.logout(token);

      // Token without exp claim should not be blacklisted
      expect(mockSessionService.blacklistToken).not.toHaveBeenCalled();
    });
  });
});
