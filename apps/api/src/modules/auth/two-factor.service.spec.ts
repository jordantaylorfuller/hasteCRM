import { Test, TestingModule } from "@nestjs/testing";
import { TwoFactorService } from "./two-factor.service";
import { PrismaService } from "../prisma/prisma.service";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import * as speakeasy from "speakeasy";
import * as qrcode from "qrcode";
import * as bcrypt from "bcrypt";

// Mock external libraries
jest.mock("speakeasy");
jest.mock("qrcode");
jest.mock("bcrypt");

describe("TwoFactorService", () => {
  let service: TwoFactorService;
  let prismaService: PrismaService;

  const mockUser = {
    id: "user-123",
    email: "test@example.com",
    firstName: "Test",
    lastName: "User",
    passwordHash: "hashed-password",
    twoFactorAuth: null,
  };

  const mockTwoFactorAuth = {
    id: "2fa-123",
    userId: "user-123",
    secret: "ABCDEFGHIJKLMNOP",
    tempSecret: null,
    isEnabled: false,
    backupCodes: [
      "hashed-code1",
      "hashed-code2",
      "hashed-code3",
      "hashed-code4",
      "hashed-code5",
    ],
    lastUsedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwoFactorService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
            twoFactorAuth: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<TwoFactorService>(TwoFactorService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("setupTwoFactor", () => {
    it("should setup 2FA for user with valid password", async () => {
      const secret = {
        ascii: "secret",
        hex: "123456",
        base32: "JBSWY3DPEHPK3PXP",
        otpauth_url:
          "otpauth://totp/hasteCRM:test@example.com?secret=JBSWY3DPEHPK3PXP",
      };
      const qrCodeUrl = "data:image/png;base64,qrcode";

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.twoFactorAuth.findUnique as jest.Mock).mockResolvedValue(
        null,
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (speakeasy.generateSecret as jest.Mock).mockReturnValue(secret);
      (qrcode.toDataURL as jest.Mock).mockResolvedValue(qrCodeUrl);
      (bcrypt.hash as jest.Mock).mockResolvedValue("hashed-backup-code");
      (prismaService.twoFactorAuth.create as jest.Mock).mockResolvedValue(
        mockTwoFactorAuth,
      );

      const result = await service.setupTwoFactor(mockUser.id, "password");

      expect(bcrypt.compare).toHaveBeenCalledWith(
        "password",
        mockUser.passwordHash,
      );
      expect(speakeasy.generateSecret).toHaveBeenCalledWith({
        name: "hasteCRM (test@example.com)",
        length: 32,
      });
      expect(qrcode.toDataURL).toHaveBeenCalledWith(secret.otpauth_url);
      expect(result).toHaveProperty("secret");
      expect(result).toHaveProperty("qrCode", qrCodeUrl);
      expect(result).toHaveProperty("backupCodes");
    });

    it("should throw error if password is invalid", async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.setupTwoFactor(mockUser.id, "wrong-password"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw error if user already has 2FA enabled", async () => {
      const userWith2FA = {
        ...mockUser,
        twoFactorAuth: { ...mockTwoFactorAuth, isEnabled: true },
      };
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(
        userWith2FA,
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.setupTwoFactor(mockUser.id, "password"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("verifyAndEnableTwoFactor", () => {
    it("should enable 2FA with valid token", async () => {
      (prismaService.twoFactorAuth.findUnique as jest.Mock).mockResolvedValue({
        ...mockTwoFactorAuth,
        isEnabled: false,
      });
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);
      (prismaService.twoFactorAuth.update as jest.Mock).mockResolvedValue({
        ...mockTwoFactorAuth,
        isEnabled: true,
      });

      await service.verifyAndEnableTwoFactor(mockUser.id, "123456");

      expect(speakeasy.totp.verify).toHaveBeenCalledWith({
        secret: mockTwoFactorAuth.secret,
        encoding: "base32",
        token: "123456",
        window: 2,
      });
      expect(prismaService.twoFactorAuth.update).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        data: {
          isEnabled: true,
          lastUsedAt: expect.any(Date),
        },
      });
    });

    it("should throw error if no temp secret is set", async () => {
      (prismaService.twoFactorAuth.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        service.verifyAndEnableTwoFactor(mockUser.id, "123456"),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw error if token is invalid", async () => {
      (prismaService.twoFactorAuth.findUnique as jest.Mock).mockResolvedValue({
        ...mockTwoFactorAuth,
        isEnabled: false,
      });
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(false);

      await expect(
        service.verifyAndEnableTwoFactor(mockUser.id, "123456"),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("disableTwoFactor", () => {
    it("should disable 2FA with valid password", async () => {
      const userWith2FA = {
        ...mockUser,
        twoFactorAuth: { ...mockTwoFactorAuth, isEnabled: true },
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(
        userWith2FA,
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);
      (prismaService.twoFactorAuth.findUnique as jest.Mock).mockResolvedValue({
        ...mockTwoFactorAuth,
        isEnabled: true,
      });
      (prismaService.twoFactorAuth.update as jest.Mock).mockResolvedValue({
        ...mockTwoFactorAuth,
        isEnabled: false,
      });

      await service.disableTwoFactor(mockUser.id, "password", "123456");

      expect(bcrypt.compare).toHaveBeenCalledWith(
        "password",
        mockUser.passwordHash,
      );
      expect(speakeasy.totp.verify).toHaveBeenCalledWith({
        secret: mockTwoFactorAuth.secret,
        encoding: "base32",
        token: "123456",
        window: 2,
      });
      expect(prismaService.twoFactorAuth.update).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        data: {
          isEnabled: false,
        },
      });
    });

    it("should throw error if password is invalid", async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.disableTwoFactor(mockUser.id, "wrong-password", "123456"),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("should throw error if 2FA is not enabled", async () => {
      const userWithout2FA = {
        ...mockUser,
        twoFactorAuth: { ...mockTwoFactorAuth, isEnabled: false },
      };
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(
        userWithout2FA,
      );
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.disableTwoFactor(mockUser.id, "password", "123456"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("verifyToken", () => {
    it("should verify valid token", async () => {
      (prismaService.twoFactorAuth.findUnique as jest.Mock).mockResolvedValue({
        ...mockTwoFactorAuth,
        isEnabled: true,
      });
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);

      const result = await service.verifyToken(mockUser.id, "123456");

      expect(result).toBe(true);
      expect(speakeasy.totp.verify).toHaveBeenCalledWith({
        secret: mockTwoFactorAuth.secret,
        encoding: "base32",
        token: "123456",
        window: 2,
      });
      expect(prismaService.twoFactorAuth.update).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        data: { lastUsedAt: expect.any(Date) },
      });
    });

    it("should return false for invalid token", async () => {
      (prismaService.twoFactorAuth.findUnique as jest.Mock).mockResolvedValue({
        ...mockTwoFactorAuth,
        isEnabled: true,
      });
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(false);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.verifyToken(mockUser.id, "123456");

      expect(result).toBe(false);
    });

    it("should return false if 2FA is not enabled", async () => {
      (prismaService.twoFactorAuth.findUnique as jest.Mock).mockResolvedValue({
        ...mockTwoFactorAuth,
        isEnabled: false,
      });

      const result = await service.verifyToken(mockUser.id, "123456");

      expect(result).toBe(false);
    });
  });

  describe("verifyTwoFactorLogin", () => {
    it("should verify valid token for login", async () => {
      const userWith2FA = {
        ...mockUser,
        twoFactorAuth: { ...mockTwoFactorAuth, isEnabled: true },
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(
        userWith2FA,
      );
      (prismaService.twoFactorAuth.findUnique as jest.Mock).mockResolvedValue({
        ...mockTwoFactorAuth,
        isEnabled: true,
      });
      (speakeasy.totp.verify as jest.Mock).mockReturnValue(true);

      const result = await service.verifyTwoFactorLogin(
        mockUser.email,
        "123456",
      );

      expect(result).toBe(true);
    });

    it("should throw error if user not found", async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.verifyTwoFactorLogin("nonexistent@example.com", "123456"),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("getTwoFactorStatus", () => {
    it("should return 2FA status", async () => {
      (prismaService.twoFactorAuth.findUnique as jest.Mock).mockResolvedValue({
        ...mockTwoFactorAuth,
        isEnabled: true,
      });

      const result = await service.getTwoFactorStatus(mockUser.id);

      expect(result).toEqual({
        enabled: true,
        method: undefined,
      });
    });

    it("should return disabled status if no 2FA", async () => {
      (prismaService.twoFactorAuth.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      const result = await service.getTwoFactorStatus(mockUser.id);

      expect(result).toEqual({
        enabled: false,
        method: undefined,
      });
    });
  });
});
