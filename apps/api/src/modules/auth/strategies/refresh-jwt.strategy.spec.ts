import { Test, TestingModule } from '@nestjs/testing';
import { RefreshJwtStrategy } from './refresh-jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

describe('RefreshJwtStrategy', () => {
  let strategy: RefreshJwtStrategy;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshJwtStrategy,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    strategy = module.get<RefreshJwtStrategy>(RefreshJwtStrategy);
    configService = module.get<ConfigService>(ConfigService);

    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret';
      return null;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(strategy).toBeDefined();
    });
  });

  describe('validate', () => {
    it('should return user payload for valid refresh token', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        workspaceId: 'workspace-123',
        type: 'refresh',
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        workspaceId: 'workspace-123',
      });
    });

    it('should throw UnauthorizedException for non-refresh token', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        workspaceId: 'workspace-123',
        type: 'access', // Wrong token type
      };

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for missing type', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        workspaceId: 'workspace-123',
        // Missing type field
      };

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for invalid payload', async () => {
      const invalidPayload = {
        // Missing required fields
        email: 'test@example.com',
        type: 'refresh',
      };

      await expect(strategy.validate(invalidPayload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for null payload', async () => {
      await expect(strategy.validate(null)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for payload without sub', async () => {
      const payload = {
        email: 'test@example.com',
        workspaceId: 'workspace-123',
        type: 'refresh',
      };

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for payload without workspaceId', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        type: 'refresh',
      };

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should handle expired token scenario', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        workspaceId: 'workspace-123',
        type: 'refresh',
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
      };

      // This should be handled by Passport JWT, but we can still validate
      const result = await strategy.validate(payload);

      expect(result).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        workspaceId: 'workspace-123',
      });
    });
  });
});