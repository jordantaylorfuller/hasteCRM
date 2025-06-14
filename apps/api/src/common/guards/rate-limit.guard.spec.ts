import { Test, TestingModule } from "@nestjs/testing";
import { RateLimitGuard } from "./rate-limit.guard";
import { RedisService } from "@/modules/redis/redis.service";
import { Reflector } from "@nestjs/core";
import { ExecutionContext, HttpException, HttpStatus } from "@nestjs/common";

describe("RateLimitGuard", () => {
  let guard: RateLimitGuard;
  let redisService: RedisService;
  let reflector: Reflector;
  const originalEnv = process.env.NODE_ENV;

  const createMockContext = (
    request: any,
    response?: any,
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response || { setHeader: jest.fn() },
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  };

  beforeEach(async () => {
    // Temporarily disable test environment check
    process.env.NODE_ENV = "development";
    process.env.DISABLE_RATE_LIMIT = "false";

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimitGuard,
        {
          provide: RedisService,
          useValue: {
            incrementRateLimit: jest.fn(),
            getClient: jest.fn().mockReturnValue({
              ttl: jest.fn(),
            }),
          },
        },
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RateLimitGuard>(RateLimitGuard);
    redisService = module.get<RedisService>(RedisService);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Restore original environment
    process.env.NODE_ENV = originalEnv;
  });

  describe("canActivate", () => {
    it("should allow request when under rate limit", async () => {
      const mockRequest = {
        ip: "127.0.0.1",
        headers: {},
        route: { path: "/api/auth/login" },
        url: "/api/auth/login",
      };
      const mockResponse = { setHeader: jest.fn() };
      const context = createMockContext(mockRequest, mockResponse);

      (reflector.get as jest.Mock).mockReturnValue({ points: 5, duration: 60 });
      (redisService.incrementRateLimit as jest.Mock).mockResolvedValue(1);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(redisService.incrementRateLimit).toHaveBeenCalledWith(
        "rate-limit:/api/auth/login:ip:127.0.0.1",
        60,
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        "X-RateLimit-Limit",
        5,
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        "X-RateLimit-Remaining",
        4,
      );
    });

    it("should allow requests when no rate limit configured", async () => {
      const context = createMockContext({ ip: "127.0.0.1", headers: {} });
      (reflector.get as jest.Mock).mockReturnValue(null);

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(redisService.incrementRateLimit).not.toHaveBeenCalled();
    });

    it("should block request when rate limit exceeded", async () => {
      const mockRequest = {
        ip: "127.0.0.1",
        headers: {},
        route: { path: "/api/auth/login" },
        url: "/api/auth/login",
      };
      const context = createMockContext(mockRequest);

      (reflector.get as jest.Mock).mockReturnValue({ points: 5, duration: 60 });
      (redisService.incrementRateLimit as jest.Mock).mockResolvedValue(6);
      (redisService.getClient().ttl as jest.Mock).mockResolvedValue(45);

      await expect(guard.canActivate(context)).rejects.toThrow(
        new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: "Too many requests",
            error: "Too Many Requests",
            retryAfter: 45,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        ),
      );
    });

    it("should handle different IP formats", async () => {
      const testCases = [
        {
          headers: { "x-forwarded-for": "192.168.1.1, 10.0.0.1" },
          expected: "192.168.1.1",
        },
        { headers: { "x-real-ip": "192.168.1.2" }, expected: "192.168.1.2" },
        {
          connection: { remoteAddress: "192.168.1.3" },
          expected: "192.168.1.3",
        },
      ];

      for (const testCase of testCases) {
        const mockRequest = {
          headers: {},
          ...testCase,
          route: { path: "/api/test" },
          url: "/api/test",
        };
        const context = createMockContext(mockRequest);

        (reflector.get as jest.Mock).mockReturnValue({
          points: 10,
          duration: 60,
        });
        (redisService.incrementRateLimit as jest.Mock).mockResolvedValue(1);

        await guard.canActivate(context);

        expect(redisService.incrementRateLimit).toHaveBeenCalledWith(
          `rate-limit:/api/test:ip:${testCase.expected}`,
          60,
        );
      }
    });

    it("should use user ID for authenticated requests", async () => {
      const mockRequest = {
        headers: {},
        user: { userId: "user-123" },
        route: { path: "/api/contacts" },
        url: "/api/contacts",
      };
      const context = createMockContext(mockRequest);

      (reflector.get as jest.Mock).mockReturnValue({
        points: 100,
        duration: 60,
      });
      (redisService.incrementRateLimit as jest.Mock).mockResolvedValue(1);

      await guard.canActivate(context);

      expect(redisService.incrementRateLimit).toHaveBeenCalledWith(
        "rate-limit:/api/contacts:user:user-123",
        60,
      );
    });

    it("should skip rate limiting in test environment", async () => {
      process.env.NODE_ENV = "test";

      const context = createMockContext({ ip: "127.0.0.1", headers: {} });
      (reflector.get as jest.Mock).mockReturnValue({ points: 5, duration: 60 });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(redisService.incrementRateLimit).not.toHaveBeenCalled();
    });

    it("should skip rate limiting when DISABLE_RATE_LIMIT is true", async () => {
      process.env.DISABLE_RATE_LIMIT = "true";

      const context = createMockContext({ ip: "127.0.0.1", headers: {} });
      (reflector.get as jest.Mock).mockReturnValue({ points: 5, duration: 60 });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(redisService.incrementRateLimit).not.toHaveBeenCalled();
    });

    it("should use custom key prefix", async () => {
      const mockRequest = {
        ip: "127.0.0.1",
        headers: {},
        route: { path: "/api/auth/login" },
        url: "/api/auth/login",
      };
      const context = createMockContext(mockRequest);

      (reflector.get as jest.Mock).mockReturnValue({
        points: 5,
        duration: 60,
        keyPrefix: "custom-prefix",
      });
      (redisService.incrementRateLimit as jest.Mock).mockResolvedValue(1);

      await guard.canActivate(context);

      expect(redisService.incrementRateLimit).toHaveBeenCalledWith(
        "custom-prefix:/api/auth/login:ip:127.0.0.1",
        60,
      );
    });

    it("should apply skipIf condition", async () => {
      const mockRequest = {
        ip: "127.0.0.1",
        headers: { "x-api-key": "secret" },
        route: { path: "/api/test" },
      };
      const context = createMockContext(mockRequest);

      (reflector.get as jest.Mock).mockReturnValue({
        points: 5,
        duration: 60,
        skipIf: (req: any) => req.headers["x-api-key"] === "secret",
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(redisService.incrementRateLimit).not.toHaveBeenCalled();
    });
  });

  describe("rate limit headers", () => {
    it("should set correct rate limit headers", async () => {
      const mockRequest = {
        ip: "127.0.0.1",
        headers: {},
        route: { path: "/api/test" },
        url: "/api/test",
      };
      const mockResponse = { setHeader: jest.fn() };
      const context = createMockContext(mockRequest, mockResponse);

      (reflector.get as jest.Mock).mockReturnValue({
        points: 10,
        duration: 60,
      });
      (redisService.incrementRateLimit as jest.Mock).mockResolvedValue(3);

      const now = Date.now();
      jest.spyOn(Date, "now").mockReturnValue(now);

      await guard.canActivate(context);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        "X-RateLimit-Limit",
        10,
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        "X-RateLimit-Remaining",
        7,
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        "X-RateLimit-Reset",
        new Date(now + 60000).toISOString(),
      );
    });

    it("should handle zero remaining requests", async () => {
      const mockRequest = {
        ip: "127.0.0.1",
        headers: {},
        route: { path: "/api/test" },
        url: "/api/test",
      };
      const mockResponse = { setHeader: jest.fn() };
      const context = createMockContext(mockRequest, mockResponse);

      (reflector.get as jest.Mock).mockReturnValue({ points: 5, duration: 60 });
      (redisService.incrementRateLimit as jest.Mock).mockResolvedValue(5);

      await guard.canActivate(context);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        "X-RateLimit-Remaining",
        0,
      );
    });
  });
});
