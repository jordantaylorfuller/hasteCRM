import { Test, TestingModule } from "@nestjs/testing";
import { MetricsController } from "./metrics.controller";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";

describe("MetricsController", () => {
  let controller: MetricsController;
  let _prismaService: PrismaService;
  let _redisService: RedisService;

  const mockPrismaService = {
    user: { count: jest.fn() },
    workspace: { count: jest.fn() },
    contact: { count: jest.fn() },
    email: { count: jest.fn() },
    $queryRaw: jest.fn(),
  };

  const mockRedisService = {
    getClient: jest.fn(() => ({
      dbsize: jest.fn().mockResolvedValue(100),
      info: jest.fn().mockResolvedValue("used_memory_human:1M"),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);
    _prismaService = module.get<PrismaService>(PrismaService);
    _redisService = module.get<RedisService>(RedisService);
  });

  describe("getMetrics", () => {
    it("should return system metrics", async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ count: BigInt(5) }]);

      const result = await controller.getMetrics();

      expect(result).toEqual({
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        memory: {
          heapUsed: expect.any(Number),
          heapTotal: expect.any(Number),
          rss: expect.any(Number),
          external: expect.any(Number),
        },
        cpu: {
          user: expect.any(Number),
          system: expect.any(Number),
        },
        database: {
          activeConnections: 5,
        },
        redis: {
          connectedClients: undefined,
          usedMemory: undefined,
        },
        requests: {
          total: 0,
          errors: 0,
          avgResponseTime: 0,
        },
      });
    });
  });

  describe("getPrometheusMetrics", () => {
    it("should return metrics in Prometheus format", async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ count: BigInt(5) }]);

      const result = await controller.getPrometheusMetrics();

      expect(result).toContain("# HELP app_uptime_seconds");
      expect(result).toContain("app_uptime_seconds");
      expect(result).toContain("app_memory_heap_used_bytes");
      expect(result).toContain("app_http_requests_total");
    });
  });

  describe("trackRequest", () => {
    it("should track request metrics", () => {
      controller.trackRequest(100, false);
      controller.trackRequest(200, true);

      const metricsPromise = controller.getMetrics();

      metricsPromise.then((metrics) => {
        expect(metrics.requests.total).toBe(2);
        expect(metrics.requests.errors).toBe(1);
        expect(metrics.requests.avgResponseTime).toBe(150);
      });
    });
  });
});
