import { Test, TestingModule } from '@nestjs/testing';
import { TwoFactorController } from './two-factor.controller';
import { TwoFactorService } from './two-factor.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';
import { UnauthorizedException } from '@nestjs/common';

describe('TwoFactorController', () => {
  let controller: TwoFactorController;
  let twoFactorService: TwoFactorService;

  const mockTwoFactorService = {
    setupTwoFactor: jest.fn(),
    verifyAndEnableTwoFactor: jest.fn(),
    disableTwoFactor: jest.fn(),
    verifyTwoFactorLogin: jest.fn(),
    verifyBackupCode: jest.fn(),
  };

  const mockRequest = {
    user: {
      sub: 'user-123',
      userId: 'user-123',
      email: 'test@example.com',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TwoFactorController],
      providers: [
        {
          provide: TwoFactorService,
          useValue: mockTwoFactorService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<TwoFactorController>(TwoFactorController);
    twoFactorService = module.get<TwoFactorService>(TwoFactorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('setupTwoFactor', () => {
    it('should setup two-factor authentication', async () => {
      const mockSetupResult = {
        secret: 'secret-key',
        qrCode: 'data:image/png;base64,...',
        backupCodes: ['code1', 'code2', 'code3'],
      };

      mockTwoFactorService.setupTwoFactor.mockResolvedValue(mockSetupResult);

      const result = await controller.setupTwoFactor(mockRequest, 'password123');

      expect(twoFactorService.setupTwoFactor).toHaveBeenCalledWith(
        'user-123',
        'password123',
      );
      expect(result).toEqual(mockSetupResult);
    });

    it('should handle invalid password', async () => {
      mockTwoFactorService.setupTwoFactor.mockRejectedValue(
        new UnauthorizedException('Invalid password'),
      );

      await expect(
        controller.setupTwoFactor(mockRequest, 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('enableTwoFactor', () => {
    it('should enable two-factor authentication', async () => {
      mockTwoFactorService.verifyAndEnableTwoFactor.mockResolvedValue(undefined);

      const result = await controller.enableTwoFactor(mockRequest, '123456');

      expect(twoFactorService.verifyAndEnableTwoFactor).toHaveBeenCalledWith(
        'user-123',
        '123456',
      );
      expect(result).toEqual({
        message: 'Two-factor authentication enabled successfully',
      });
    });

    it('should handle invalid token', async () => {
      mockTwoFactorService.verifyAndEnableTwoFactor.mockRejectedValue(
        new UnauthorizedException('Invalid token'),
      );

      await expect(
        controller.enableTwoFactor(mockRequest, '000000'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('disableTwoFactor', () => {
    it('should disable two-factor authentication with token', async () => {
      mockTwoFactorService.disableTwoFactor.mockResolvedValue(undefined);

      const result = await controller.disableTwoFactor(
        mockRequest,
        'password123',
        '123456',
      );

      expect(twoFactorService.disableTwoFactor).toHaveBeenCalledWith(
        'user-123',
        'password123',
        '123456',
      );
      expect(result).toEqual({
        message: 'Two-factor authentication disabled successfully',
      });
    });

    it('should disable two-factor authentication without token', async () => {
      mockTwoFactorService.disableTwoFactor.mockResolvedValue(undefined);

      const result = await controller.disableTwoFactor(
        mockRequest,
        'password123',
        undefined,
      );

      expect(twoFactorService.disableTwoFactor).toHaveBeenCalledWith(
        'user-123',
        'password123',
        '',
      );
      expect(result).toEqual({
        message: 'Two-factor authentication disabled successfully',
      });
    });

    it('should handle invalid credentials', async () => {
      mockTwoFactorService.disableTwoFactor.mockRejectedValue(
        new UnauthorizedException('Invalid password or token'),
      );

      await expect(
        controller.disableTwoFactor(mockRequest, 'wrongpassword', '000000'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verifyTwoFactor', () => {
    it('should verify two-factor login', async () => {
      const mockVerifyResult = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: { id: 'user-123', email: 'test@example.com' },
      };

      mockTwoFactorService.verifyTwoFactorLogin.mockResolvedValue(mockVerifyResult);

      const result = await controller.verifyTwoFactor('test@example.com', '123456');

      expect(twoFactorService.verifyTwoFactorLogin).toHaveBeenCalledWith(
        'test@example.com',
        '123456',
      );
      expect(result).toEqual(mockVerifyResult);
    });

    it('should handle invalid token', async () => {
      mockTwoFactorService.verifyTwoFactorLogin.mockRejectedValue(
        new UnauthorizedException('Invalid token'),
      );

      await expect(
        controller.verifyTwoFactor('test@example.com', '000000'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('recoverWithBackupCode', () => {
    it('should recover with valid backup code', async () => {
      mockTwoFactorService.verifyBackupCode.mockResolvedValue(true);

      const result = await controller.recoverWithBackupCode(
        mockRequest,
        'password123',
        'backup-code-123',
      );

      expect(twoFactorService.verifyBackupCode).toHaveBeenCalledWith(
        'test@example.com',
        'backup-code-123',
      );
      expect(result).toEqual({ message: 'Backup code verified successfully' });
    });

    it('should throw error for invalid backup code', async () => {
      mockTwoFactorService.verifyBackupCode.mockResolvedValue(false);

      await expect(
        controller.recoverWithBackupCode(mockRequest, 'password123', 'invalid-code'),
      ).rejects.toThrow(UnauthorizedException);
      
      expect(twoFactorService.verifyBackupCode).toHaveBeenCalledWith(
        'test@example.com',
        'invalid-code',
      );
    });

    it('should handle service errors', async () => {
      mockTwoFactorService.verifyBackupCode.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        controller.recoverWithBackupCode(mockRequest, 'password123', 'backup-code'),
      ).rejects.toThrow(Error);
    });
  });
});