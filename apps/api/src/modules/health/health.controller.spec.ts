import { Test, TestingModule } from "@nestjs/testing";
import { HealthController } from "./health.controller";
import {
  HealthCheckService,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from "@nestjs/terminus";
import { PrismaHealthIndicator } from "./indicators/prisma.health";
import { RedisHealthIndicator } from "./indicators/redis.health";

describe("HealthController", () => {
  let controller: HealthController;
  let healthCheckService: HealthCheckService;
  let memoryHealthIndicator: MemoryHealthIndicator;
  let diskHealthIndicator: DiskHealthIndicator;
  let prismaHealthIndicator: PrismaHealthIndicator;
  let redisHealthIndicator: RedisHealthIndicator;

  const mockHealthCheckService = {
    check: jest.fn(),
  };

  const mockMemoryHealthIndicator = {
    checkHeap: jest.fn(),
    checkRSS: jest.fn(),
  };

  const mockDiskHealthIndicator = {
    checkStorage: jest.fn(),
  };

  const mockPrismaHealthIndicator = {
    isHealthy: jest.fn(),
    pingCheck: jest.fn(),
  };

  const mockRedisHealthIndicator = {
    isHealthy: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: mockHealthCheckService,
        },
        {
          provide: MemoryHealthIndicator,
          useValue: mockMemoryHealthIndicator,
        },
        {
          provide: DiskHealthIndicator,
          useValue: mockDiskHealthIndicator,
        },
        {
          provide: PrismaHealthIndicator,
          useValue: mockPrismaHealthIndicator,
        },
        {
          provide: RedisHealthIndicator,
          useValue: mockRedisHealthIndicator,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthCheckService = module.get<HealthCheckService>(HealthCheckService);
    memoryHealthIndicator = module.get<MemoryHealthIndicator>(
      MemoryHealthIndicator,
    );
    diskHealthIndicator = module.get<DiskHealthIndicator>(DiskHealthIndicator);
    prismaHealthIndicator = module.get<PrismaHealthIndicator>(
      PrismaHealthIndicator,
    );
    redisHealthIndicator =
      module.get<RedisHealthIndicator>(RedisHealthIndicator);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("check", () => {
    it("should perform comprehensive health check", async () => {
      const mockHealthResult = {
        status: "ok",
        info: {
          database: { status: "up" },
          redis: { status: "up" },
          memory_heap: { status: "up" },
          memory_rss: { status: "up" },
          storage: { status: "up" },
        },
        details: {},
      };

      mockHealthCheckService.check.mockResolvedValue(mockHealthResult);

      const result = await controller.check();

      expect(mockHealthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function), // database check
        expect.any(Function), // redis check
        expect.any(Function), // memory heap check
        expect.any(Function), // memory rss check
        expect.any(Function), // disk storage check
      ]);

      expect(result).toEqual(mockHealthResult);
    });

    it("should execute all health indicators", async () => {
      const checks = [];
      mockHealthCheckService.check.mockImplementation((checkFns) => {
        checks.push(...checkFns);
        // Execute each check function to verify they call the correct indicators
        checkFns.forEach((fn) => fn());
        return Promise.resolve({ status: "ok" });
      });

      await controller.check();

      expect(mockPrismaHealthIndicator.isHealthy).toHaveBeenCalledWith(
        "database",
      );
      expect(mockRedisHealthIndicator.isHealthy).toHaveBeenCalledWith("redis");
      expect(mockMemoryHealthIndicator.checkHeap).toHaveBeenCalledWith(
        "memory_heap",
        150 * 1024 * 1024,
      );
      expect(mockMemoryHealthIndicator.checkRSS).toHaveBeenCalledWith(
        "memory_rss",
        300 * 1024 * 1024,
      );
      expect(mockDiskHealthIndicator.checkStorage).toHaveBeenCalledWith(
        "storage",
        {
          path: "/",
          thresholdPercent: 0.9,
        },
      );
    });
  });

  describe("liveness", () => {
    it("should perform simple liveness check", async () => {
      const mockLivenessResult = {
        status: "ok",
        info: {},
        details: {},
      };

      mockHealthCheckService.check.mockResolvedValue(mockLivenessResult);

      const result = await controller.liveness();

      expect(mockHealthCheckService.check).toHaveBeenCalledWith([]);
      expect(result).toEqual(mockLivenessResult);
    });
  });

  describe("readiness", () => {
    it("should check critical services for readiness", async () => {
      const mockReadinessResult = {
        status: "ok",
        info: {
          database: { status: "up" },
          redis: { status: "up" },
        },
        details: {},
      };

      mockHealthCheckService.check.mockResolvedValue(mockReadinessResult);

      const result = await controller.readiness();

      expect(mockHealthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function), // database check
        expect.any(Function), // redis check
      ]);

      expect(result).toEqual(mockReadinessResult);
    });

    it("should execute readiness health indicators", async () => {
      mockHealthCheckService.check.mockImplementation((checkFns) => {
        checkFns.forEach((fn) => fn());
        return Promise.resolve({ status: "ok" });
      });

      await controller.readiness();

      expect(mockPrismaHealthIndicator.isHealthy).toHaveBeenCalledWith(
        "database",
      );
      expect(mockRedisHealthIndicator.isHealthy).toHaveBeenCalledWith("redis");
    });
  });

  describe("startup", () => {
    it("should perform lightweight startup check", async () => {
      const mockStartupResult = {
        status: "ok",
        info: {
          database: { status: "up" },
        },
        details: {},
      };

      mockHealthCheckService.check.mockResolvedValue(mockStartupResult);

      const result = await controller.startup();

      expect(mockHealthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function), // database ping check
      ]);

      expect(result).toEqual(mockStartupResult);
    });

    it("should execute startup health indicator", async () => {
      mockHealthCheckService.check.mockImplementation((checkFns) => {
        checkFns.forEach((fn) => fn());
        return Promise.resolve({ status: "ok" });
      });

      await controller.startup();

      expect(mockPrismaHealthIndicator.pingCheck).toHaveBeenCalledWith(
        "database",
      );
    });
  });

  describe("error handling", () => {
    it("should propagate errors from health check service", async () => {
      const error = new Error("Health check failed");
      mockHealthCheckService.check.mockRejectedValue(error);

      await expect(controller.check()).rejects.toThrow(error);
    });

    it("should handle indicator failures", async () => {
      const indicatorError = new Error("Database connection failed");

      // Set up the mock to throw error before the test
      mockPrismaHealthIndicator.isHealthy.mockRejectedValue(indicatorError);

      mockHealthCheckService.check.mockImplementation(async (checkFns) => {
        // Try to execute the checks and catch errors
        try {
          for (const checkFn of checkFns) {
            await checkFn();
          }
          return { status: "ok" };
        } catch (error) {
          return { status: "error", error: error.message };
        }
      });

      const result = await controller.check();
      expect(result.status).toBe("error");
      expect(result.error).toBe("Database connection failed");
    });
  });
});
