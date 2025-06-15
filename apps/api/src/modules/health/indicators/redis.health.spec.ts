import { Test, TestingModule } from "@nestjs/testing";
import { HealthCheckError } from "@nestjs/terminus";
import { RedisHealthIndicator } from "./redis.health";
import { RedisService } from "@/modules/redis/redis.service";

describe("RedisHealthIndicator", () => {
  let indicator: RedisHealthIndicator;
  let redisService: RedisService;

  const mockRedisClient = {
    ping: jest.fn(),
    info: jest.fn(),
  };

  const mockRedisService = {
    getClient: jest.fn().mockReturnValue(mockRedisClient),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisHealthIndicator,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    indicator = module.get<RedisHealthIndicator>(RedisHealthIndicator);
    redisService = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("isHealthy", () => {
    it("should return healthy status when Redis is accessible", async () => {
      mockRedisClient.ping.mockResolvedValue("PONG");
      mockRedisClient.info.mockResolvedValue(
        `# Server\r\nredis_version:7.2.4\r\nredis_mode:standalone\r\nuptime_in_days:1\r\n# Memory\r\nused_memory:1048576\r\nused_memory_human:1M\r\n# Clients\r\nconnected_clients:10\r\n# Stats\r\ntotal_connections_received:100\r\ntotal_commands_processed:1000`,
      );

      const result = await indicator.isHealthy("redis");

      expect(mockRedisClient.ping).toHaveBeenCalled();
      expect(mockRedisClient.info).toHaveBeenCalled();
      expect(result).toEqual({
        redis: {
          status: "up",
          responseTime: expect.stringMatching(/^\d+ms$/),
          version: "7.2.4",
          mode: "standalone",
          connected_clients: 10,
          used_memory_human: "1M",
          uptime_in_days: 1,
        },
      });
    });

    it("should throw HealthCheckError when Redis is inaccessible", async () => {
      const error = new Error("Connection refused");
      mockRedisClient.ping.mockRejectedValue(error);

      await expect(indicator.isHealthy("redis")).rejects.toThrow(
        HealthCheckError,
      );

      try {
        await indicator.isHealthy("redis");
      } catch (e) {
        expect(e).toBeInstanceOf(HealthCheckError);
        expect(e.causes).toEqual({
          redis: {
            status: "down",
            message: "Connection refused",
          },
        });
      }
    });

    it("should handle Redis info parsing errors gracefully", async () => {
      mockRedisClient.ping.mockResolvedValue("PONG");
      mockRedisClient.info.mockResolvedValue("invalid info format");

      const result = await indicator.isHealthy("redis");

      expect(result.redis.status).toBe("up");
      expect(result.redis.version).toBe("unknown");
      expect(result.redis.mode).toBe("standalone");
      expect(result.redis.connected_clients).toBe(0);
      expect(result.redis.used_memory_human).toBe("unknown");
      expect(result.redis.uptime_in_days).toBe(0);
    });

    it("should measure response time accurately", async () => {
      // Simulate a delay in Redis response
      mockRedisClient.ping.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve("PONG"), 30);
        });
      });
      mockRedisClient.info.mockResolvedValue("redis_version:7.2.4");

      const result = await indicator.isHealthy("redis");

      expect(result.redis.responseTime).toMatch(/^\d+ms$/);
      const responseTime = parseInt(
        result.redis.responseTime.replace("ms", ""),
      );
      expect(responseTime).toBeGreaterThanOrEqual(30);
      expect(responseTime).toBeLessThan(100);
    });

    it("should handle missing Redis info gracefully", async () => {
      mockRedisClient.ping.mockResolvedValue("PONG");
      mockRedisClient.info.mockResolvedValue("");

      const result = await indicator.isHealthy("redis");

      expect(result).toEqual({
        redis: {
          status: "up",
          responseTime: expect.stringMatching(/^\d+ms$/),
          version: "unknown",
          mode: "standalone",
          connected_clients: 0,
          used_memory_human: "unknown",
          uptime_in_days: 0,
        },
      });
    });

    it("should parse complex Redis info correctly", async () => {
      mockRedisClient.ping.mockResolvedValue("PONG");
      const redisInfo = [
        "# Server",
        "redis_version:7.2.4",
        "redis_mode:standalone",
        "uptime_in_days:1",
        "# Memory",
        "used_memory:2097152",
        "used_memory_human:2M",
        "# Clients",
        "connected_clients:25",
      ].join("\r\n");
      mockRedisClient.info.mockResolvedValue(redisInfo);

      const result = await indicator.isHealthy("redis");

      expect(result.redis).toMatchObject({
        status: "up",
        version: "7.2.4",
        mode: "standalone",
        connected_clients: 25,
        used_memory_human: "2M",
        uptime_in_days: 1,
      });
    });
  });

  describe("error scenarios", () => {
    it("should handle Redis authentication errors", async () => {
      const authError = new Error("NOAUTH Authentication required");
      mockRedisClient.ping.mockRejectedValue(authError);

      try {
        await indicator.isHealthy("redis");
      } catch (e) {
        expect(e).toBeInstanceOf(HealthCheckError);
        expect(e.causes.redis.message).toBe("NOAUTH Authentication required");
      }
    });

    it("should handle Redis connection timeout", async () => {
      const timeoutError = new Error("Connection timeout");
      timeoutError["code"] = "ETIMEDOUT";
      mockRedisClient.ping.mockRejectedValue(timeoutError);

      try {
        await indicator.isHealthy("redis");
      } catch (e) {
        expect(e).toBeInstanceOf(HealthCheckError);
        expect(e.causes.redis.message).toBe("Connection timeout");
      }
    });

    it("should handle Redis client not available", async () => {
      mockRedisService.getClient.mockReturnValue(null);

      try {
        await indicator.isHealthy("redis");
      } catch (e) {
        expect(e).toBeInstanceOf(HealthCheckError);
        expect(e.causes.redis.message).toBe(
          "Cannot read properties of null (reading 'ping')",
        );
      }
    });

    it("should handle info command failure but ping success", async () => {
      const mockClient = {
        ping: jest.fn().mockResolvedValue("PONG"),
        info: jest.fn().mockRejectedValue(new Error("INFO command disabled")),
      };
      mockRedisService.getClient.mockReturnValue(mockClient);

      const result = await indicator.isHealthy("redis");

      // Should still return healthy if ping works
      expect(result.redis.status).toBe("up");
      expect(result.redis.version).toBe("unknown");
      expect(result.redis.mode).toBe("standalone");
      expect(result.redis.connected_clients).toBe(0);
      expect(result.redis.used_memory_human).toBe("unknown");
      expect(result.redis.uptime_in_days).toBe(0);
    });
  });

  describe("info parsing", () => {
    it("should handle partial Redis info", async () => {
      const mockClient = {
        ping: jest.fn().mockResolvedValue("PONG"),
        info: jest
          .fn()
          .mockResolvedValue(
            `# Server\r\nredis_version:7.0.0\r\n# Clients\r\nconnected_clients:5`,
          ),
      };
      mockRedisService.getClient.mockReturnValue(mockClient);

      const result = await indicator.isHealthy("redis");

      expect(result.redis).toMatchObject({
        status: "up",
        version: "7.0.0",
        connected_clients: 5,
        mode: "standalone",
        used_memory_human: "unknown",
        uptime_in_days: 0,
      });
    });

    it("should handle Redis info with extra spaces", async () => {
      const mockClient = {
        ping: jest.fn().mockResolvedValue("PONG"),
        info: jest
          .fn()
          .mockResolvedValue(
            `# Server\r\nredis_version:6.2.7\r\nused_memory:1048576\r\nconnected_clients:10`,
          ),
      };
      mockRedisService.getClient.mockReturnValue(mockClient);

      const result = await indicator.isHealthy("redis");

      expect(result.redis.version).toBe("6.2.7");
      expect(result.redis.used_memory_human).toBe("unknown");
      expect(result.redis.connected_clients).toBe(10);
    });
  });
});
