import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckError } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma.health';
import { PrismaService } from '@/modules/prisma/prisma.service';

describe('PrismaHealthIndicator', () => {
  let indicator: PrismaHealthIndicator;
  let prismaService: PrismaService;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaHealthIndicator,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    indicator = module.get<PrismaHealthIndicator>(PrismaHealthIndicator);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isHealthy', () => {
    it('should return healthy status when database is accessible', async () => {
      const startTime = Date.now();
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([{ 1: 1 }]) // SELECT 1
        .mockResolvedValueOnce([{ version: 'PostgreSQL 14.5' }]) // version query
        .mockResolvedValueOnce([{ count: BigInt(5) }]) // connection count
        .mockResolvedValueOnce([{ size: '25 MB' }]); // database size

      const result = await indicator.isHealthy('database');

      expect(mockPrismaService.$queryRaw).toHaveBeenCalledWith`SELECT 1`;
      expect(result).toEqual({
        database: {
          status: 'up',
          responseTime: expect.stringMatching(/\d+ms/),
          version: '14.5',
          connections: 5,
          size: '25 MB',
        },
      });
    });

    it('should throw HealthCheckError when database is inaccessible', async () => {
      const error = new Error('Connection refused');
      mockPrismaService.$queryRaw.mockRejectedValue(error);

      await expect(indicator.isHealthy('database')).rejects.toThrow(HealthCheckError);
      
      try {
        await indicator.isHealthy('database');
      } catch (e) {
        expect(e).toBeInstanceOf(HealthCheckError);
        const causes = e.causes as any;
        expect(causes.database.status).toBe('down');
        expect(causes.database.message).toBe('Connection refused');
      }
    });

    it('should include error details in HealthCheckError', async () => {
      const dbError = new Error('Connection timeout');
      dbError['code'] = 'P1001';
      mockPrismaService.$queryRaw.mockRejectedValue(dbError);

      try {
        await indicator.isHealthy('database');
      } catch (e) {
        expect(e).toBeInstanceOf(HealthCheckError);
        expect(e.message).toBe('Database health check failed');
        const causes = e.causes as any;
        expect(causes.database.message).toBe('Connection timeout');
      }
    });

    it('should measure response time accurately', async () => {
      // Simulate a delay in database response
      let callCount = 0;
      mockPrismaService.$queryRaw.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First call (SELECT 1) with delay
          return new Promise((resolve) => {
            setTimeout(() => resolve([{ 1: 1 }]), 50);
          });
        } else if (callCount === 2) {
          return Promise.resolve([{ version: 'PostgreSQL 14.5' }]);
        } else if (callCount === 3) {
          return Promise.resolve([{ count: BigInt(5) }]);
        } else {
          return Promise.resolve([{ size: '25 MB' }]);
        }
      });

      const result = await indicator.isHealthy('database');

      expect(result.database.responseTime).toMatch(/\d+ms/);
      const responseTime = parseInt(result.database.responseTime);
      expect(responseTime).toBeGreaterThanOrEqual(50);
    });
  });

  describe('pingCheck', () => {
    it('should return healthy status on successful ping', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ 1: 1 }]);

      const result = await indicator.pingCheck('database');

      expect(mockPrismaService.$queryRaw).toHaveBeenCalledWith`SELECT 1`;
      expect(result).toEqual({
        database: {
          status: 'up',
        },
      });
    });

    it('should throw HealthCheckError on failed ping', async () => {
      const error = new Error('Database unavailable');
      mockPrismaService.$queryRaw.mockRejectedValue(error);

      await expect(indicator.pingCheck('database')).rejects.toThrow(HealthCheckError);
      
      try {
        await indicator.pingCheck('database');
      } catch (e) {
        expect(e).toBeInstanceOf(HealthCheckError);
        const causes = e.causes as any;
        expect(causes.database.status).toBe('down');
      }
    });

    it('should not include response time in ping check', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ 1: 1 }]);

      const result = await indicator.pingCheck('database');

      expect(result.database).not.toHaveProperty('responseTime');
      expect(result).toEqual({
        database: {
          status: 'up',
        },
      });
    });
  });

  describe('error scenarios', () => {
    it('should handle Prisma-specific errors', async () => {
      const prismaError = new Error('Invalid `prisma.$queryRaw()` invocation');
      prismaError['code'] = 'P2010';
      prismaError['meta'] = { cause: 'Database is in readonly mode' };
      mockPrismaService.$queryRaw.mockRejectedValue(prismaError);

      try {
        await indicator.isHealthy('database');
      } catch (e) {
        expect(e).toBeInstanceOf(HealthCheckError);
        const causes = e.causes as any;
        expect(causes.database.message).toContain('Invalid `prisma.$queryRaw()` invocation');
      }
    });

    it('should handle network errors', async () => {
      const networkError = new Error('ECONNREFUSED');
      networkError['code'] = 'ECONNREFUSED';
      mockPrismaService.$queryRaw.mockRejectedValue(networkError);

      try {
        await indicator.isHealthy('database');
      } catch (e) {
        expect(e).toBeInstanceOf(HealthCheckError);
        const causes = e.causes as any;
        expect(causes.database.message).toBe('ECONNREFUSED');
      }
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Query timeout');
      timeoutError['code'] = 'P1008';
      mockPrismaService.$queryRaw.mockRejectedValue(timeoutError);

      try {
        await indicator.isHealthy('database');
      } catch (e) {
        expect(e).toBeInstanceOf(HealthCheckError);
        const causes = e.causes as any;
        expect(causes.database.status).toBe('down');
        expect(causes.database.message).toBe('Query timeout');
      }
    });
  });
});