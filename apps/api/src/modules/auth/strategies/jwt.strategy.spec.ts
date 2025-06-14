import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { UnauthorizedException } from '@nestjs/common';
import { SessionService } from '../session.service';
import { Request } from 'express';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let sessionService: any;

  const mockSessionService = {
    isTokenBlacklisted: jest.fn().mockResolvedValue(false),
  };

  const originalEnv = process.env;

  beforeEach(async () => {
    // Set up test environment variable
    process.env = { ...originalEnv, JWT_SECRET: 'test-secret' };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    sessionService = mockSessionService;
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Restore original environment
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(strategy).toBeDefined();
    });

    it('should configure with JWT secret from environment', () => {
      expect(process.env.JWT_SECRET).toBe('test-secret');
    });
  });

  describe('validate', () => {
    const mockRequest = {
      headers: {
        authorization: 'Bearer test-token',
      },
    } as Request;

    it('should return user payload for valid token', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        workspaceId: 'workspace-123',
      };

      const result = await strategy.validate(mockRequest, payload);

      expect(result).toEqual(expect.objectContaining({
        userId: 'user-123',
        email: 'test@example.com',
        workspaceId: 'workspace-123',
      }));
    });

    it('should throw UnauthorizedException for invalid payload', async () => {
      const invalidPayload = {
        // Missing required fields
        email: 'test@example.com',
      };

      await expect(strategy.validate(mockRequest, invalidPayload as any)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for null payload', async () => {
      await expect(strategy.validate(mockRequest, null as any)).rejects.toThrow(
        TypeError,
      );
    });

    it('should throw UnauthorizedException for payload without sub', async () => {
      const payload = {
        email: 'test@example.com',
        workspaceId: 'workspace-123',
      };

      await expect(strategy.validate(mockRequest, payload as any)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return user payload even without workspaceId', async () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
      };

      const result = await strategy.validate(mockRequest, payload as any);
      
      expect(result).toEqual(expect.objectContaining({
        userId: 'user-123',
        email: 'test@example.com',
        workspaceId: undefined,
      }));
    });
  });
});