import { Test, TestingModule } from "@nestjs/testing";
import { MetricsController } from "./metrics.controller";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";

describe("MetricsController", () => {
  let controller: MetricsController;
  let prismaService: PrismaService;
  let redisService: RedisService;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
  };

  const mockRedisClient = {
    info: jest.fn(),
  };

  const mockRedisService = {
    getClient: jest.fn().mockReturnValue(mockRedisClient),
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
    prismaService = module.get<PrismaService>(PrismaService);
    redisService = module.get<RedisService>(RedisService);

    // Reset request tracking
    controller["requestCount"] = 0;
    controller["errorCount"] = 0;
    controller["totalResponseTime"] = 0;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getMetrics", () => {
    it("should return comprehensive application metrics", async () => {
      // Mock database metrics
      mockPrismaService.$queryRaw.mockResolvedValue([{ count: BigInt(5) }]);

      // Mock Redis metrics
      mockRedisClient.info
        .mockResolvedValueOnce("connected_clients:10")
        .mockResolvedValueOnce("used_memory:2097152");

      const result = await controller.getMetrics();

      expect(result).toMatchObject({
        timestamp: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
        ),
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
          connectedClients: 10,
          usedMemory: 2097152,
        },
        requests: {
          total: 0,
          errors: 0,
          avgResponseTime: 0,
        },
      });
    });

    it("should handle database metrics failure gracefully", async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(
        new Error("Database error"),
      );
      mockRedisClient.info.mockResolvedValue("connected_clients:10");

      const result = await controller.getMetrics();

      expect(result.database).toEqual({});
      expect(result.redis.connectedClients).toBe(10);
    });

    it("should handle Redis metrics failure gracefully", async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ count: BigInt(3) }]);
      mockRedisClient.info.mockRejectedValue(new Error("Redis error"));

      const result = await controller.getMetrics();

      expect(result.database.activeConnections).toBe(3);
      expect(result.redis).toEqual({});
    });

    it("should calculate request statistics correctly", async () => {
      // Track some requests
      controller.trackRequest(100, false);
      controller.trackRequest(200, false);
      controller.trackRequest(150, true);

      mockPrismaService.$queryRaw.mockResolvedValue([]);
      mockRedisClient.info.mockResolvedValue("");

      const result = await controller.getMetrics();

      expect(result.requests).toEqual({
        total: 3,
        errors: 1,
        avgResponseTime: 150, // (100 + 200 + 150) / 3
      });
    });

    it("should convert memory values to MB", async () => {
      // Mock process.memoryUsage to return specific values
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 52428800, // 50 MB
        heapTotal: 104857600, // 100 MB
        rss: 157286400, // 150 MB
        external: 10485760, // 10 MB
        arrayBuffers: 0,
      });

      mockPrismaService.$queryRaw.mockResolvedValue([]);
      mockRedisClient.info.mockResolvedValue("");

      const result = await controller.getMetrics();

      expect(result.memory).toEqual({
        heapUsed: 50,
        heapTotal: 100,
        rss: 150,
        external: 10,
      });

      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe("getPrometheusMetrics", () => {
    it("should return metrics in Prometheus format", async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ count: BigInt(5) }]);
      mockRedisClient.info
        .mockResolvedValueOnce("connected_clients:10")
        .mockResolvedValueOnce("used_memory:2097152");

      const result = await controller.getPrometheusMetrics();

      expect(result).toContain(
        "# HELP app_uptime_seconds Application uptime in seconds",
      );
      expect(result).toContain("# TYPE app_uptime_seconds gauge");
      expect(result).toMatch(/app_uptime_seconds \d+/);

      expect(result).toContain(
        "# HELP app_memory_heap_used_bytes Heap memory used in bytes",
      );
      expect(result).toContain("# TYPE app_memory_heap_used_bytes gauge");

      expect(result).toContain(
        "# HELP app_http_requests_total Total number of HTTP requests",
      );
      expect(result).toContain("app_http_requests_total 0");

      expect(result).toContain("app_database_connections 5");
      expect(result).toContain("app_redis_connected_clients 10");
    });

    it("should handle missing metrics in Prometheus format", async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(new Error("DB error"));
      mockRedisClient.info.mockRejectedValue(new Error("Redis error"));

      const result = await controller.getPrometheusMetrics();

      expect(result).toContain("app_database_connections 0");
      expect(result).toContain("app_redis_connected_clients 0");
    });

    it("should include request metrics in Prometheus format", async () => {
      // Track some requests
      controller.trackRequest(50, false);
      controller.trackRequest(100, true);

      mockPrismaService.$queryRaw.mockResolvedValue([]);
      mockRedisClient.info.mockResolvedValue("");

      const result = await controller.getPrometheusMetrics();

      expect(result).toContain("app_http_requests_total 2");
      expect(result).toContain("app_http_errors_total 1");
      expect(result).toContain("app_http_response_time_milliseconds 75");
    });

    it("should format all metric types correctly", async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ count: BigInt(3) }]);
      mockRedisClient.info.mockResolvedValue("");

      const result = await controller.getPrometheusMetrics();

      // Check for proper Prometheus format
      const lines = result.split("\n");
      const metricLines = lines.filter((line) => line && !line.startsWith("#"));

      metricLines.forEach((line) => {
        expect(line).toMatch(/^[a-z_]+ \d+(\.\d+)?$/);
      });

      // Verify all expected metrics are present
      const expectedMetrics = [
        "app_uptime_seconds",
        "app_memory_heap_used_bytes",
        "app_memory_heap_total_bytes",
        "app_memory_rss_bytes",
        "app_cpu_user_seconds",
        "app_cpu_system_seconds",
        "app_http_requests_total",
        "app_http_errors_total",
        "app_http_response_time_milliseconds",
        "app_database_connections",
        "app_redis_connected_clients",
      ];

      expectedMetrics.forEach((metric) => {
        expect(result).toContain(metric);
      });
    });
  });

  describe("trackRequest", () => {
    it("should track successful requests", () => {
      controller.trackRequest(100, false);
      controller.trackRequest(200, false);

      expect(controller["requestCount"]).toBe(2);
      expect(controller["errorCount"]).toBe(0);
      expect(controller["totalResponseTime"]).toBe(300);
    });

    it("should track error requests", () => {
      controller.trackRequest(150, true);
      controller.trackRequest(250, true);

      expect(controller["requestCount"]).toBe(2);
      expect(controller["errorCount"]).toBe(2);
      expect(controller["totalResponseTime"]).toBe(400);
    });

    it("should calculate average response time correctly", async () => {
      controller.trackRequest(100, false);
      controller.trackRequest(200, false);
      controller.trackRequest(300, true);

      mockPrismaService.$queryRaw.mockResolvedValue([]);
      mockRedisClient.info.mockResolvedValue("");

      const result = await controller.getMetrics();

      expect(result.requests.avgResponseTime).toBe(200); // (100 + 200 + 300) / 3
    });
  });

  describe("getDatabaseMetrics", () => {
    it("should query active database connections", async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ count: BigInt(8) }]);

      const result = await controller["getDatabaseMetrics"]();

      expect(mockPrismaService.$queryRaw).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.stringContaining("SELECT COUNT(*) as count"),
        ]),
      );
      expect(result).toEqual({ activeConnections: 8 });
    });

    it("should handle empty result", async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      const result = await controller["getDatabaseMetrics"]();

      expect(result).toEqual({ activeConnections: 0 });
    });

    it("should handle BigInt conversion", async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([
        { count: BigInt(9007199254740992) },
      ]);

      const result = await controller["getDatabaseMetrics"]();

      expect(result.activeConnections).toBe(9007199254740992);
      expect(typeof result.activeConnections).toBe("number");
    });
  });

  describe("getRedisMetrics", () => {
    it("should parse Redis info correctly", async () => {
      mockRedisClient.info.mockResolvedValueOnce(`# Clients
connected_clients:15
client_recent_max_input_buffer:8
client_recent_max_output_buffer:0`).mockResolvedValueOnce(`# Memory
used_memory:4194304
used_memory_human:4M
used_memory_rss:6291456`);

      const result = await controller["getRedisMetrics"]();

      expect(mockRedisClient.info).toHaveBeenCalledWith("clients");
      expect(mockRedisClient.info).toHaveBeenCalledWith("memory");
      expect(result).toEqual({
        connectedClients: 15,
        usedMemory: 4194304,
      });
    });

    it("should handle missing values in Redis info", async () => {
      mockRedisClient.info
        .mockResolvedValueOnce("# Clients\nsome_other_metric:123")
        .mockResolvedValueOnce("# Memory\nsome_other_metric:456");

      const result = await controller["getRedisMetrics"]();

      expect(result).toEqual({
        connectedClients: undefined,
        usedMemory: undefined,
      });
    });

    it("should handle Redis client not available", async () => {
      mockRedisService.getClient.mockReturnValue(null);

      const result = await controller["getRedisMetrics"]();

      expect(result).toEqual({});
    });
  });
});
