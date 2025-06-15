import { Test, TestingModule } from "@nestjs/testing";
import { RedisService } from "./redis.service";
import { Logger } from "@nestjs/common";
import Redis from "ioredis";

jest.mock("ioredis");

describe("RedisService", () => {
  let service: RedisService;
  let mockRedisClient: any;
  let mockSessionClient: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockRedisClient = {
      on: jest.fn(),
      quit: jest.fn(),
      setex: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      expire: jest.fn(),
      keys: jest.fn(),
      multi: jest.fn(),
      incr: jest.fn(),
      hincrby: jest.fn(),
      hgetall: jest.fn(),
    };

    mockSessionClient = {
      on: jest.fn(),
      quit: jest.fn(),
      setex: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
      expire: jest.fn(),
      keys: jest.fn(),
    };

    // Mock Redis constructor to return different clients for different db values
    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(
      (config: any) => {
        return config.db === 1 ? mockSessionClient : mockRedisClient;
      },
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [RedisService],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  describe("initialization", () => {
    it("should create two Redis clients", () => {
      expect(Redis).toHaveBeenCalledTimes(2);

      // Main client (db 0)
      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          host: expect.any(String),
          port: expect.any(Number),
          db: 0,
        }),
      );

      // Session client (db 1)
      expect(Redis).toHaveBeenCalledWith(
        expect.objectContaining({
          host: expect.any(String),
          port: expect.any(Number),
          db: 1,
        }),
      );
    });

    it("should handle connection events", () => {
      expect(mockRedisClient.on).toHaveBeenCalledWith(
        "error",
        expect.any(Function),
      );
      expect(mockRedisClient.on).toHaveBeenCalledWith(
        "connect",
        expect.any(Function),
      );
      expect(mockSessionClient.on).toHaveBeenCalledWith(
        "error",
        expect.any(Function),
      );
      expect(mockSessionClient.on).toHaveBeenCalledWith(
        "connect",
        expect.any(Function),
      );
    });
  });

  describe("getClient", () => {
    it("should return the main Redis client", () => {
      const client = service.getClient();
      expect(client).toBe(mockRedisClient);
    });
  });

  describe("getSessionClient", () => {
    it("should return the session Redis client", () => {
      const client = service.getSessionClient();
      expect(client).toBe(mockSessionClient);
    });
  });

  describe("session management", () => {
    describe("setSession", () => {
      it("should set session data with TTL", async () => {
        mockSessionClient.setex.mockResolvedValue("OK");

        await service.setSession("session-123", { userId: "user-456" }, 7200);

        expect(mockSessionClient.setex).toHaveBeenCalledWith(
          "session:session-123",
          7200,
          JSON.stringify({ userId: "user-456" }),
        );
      });

      it("should use default TTL when not specified", async () => {
        mockSessionClient.setex.mockResolvedValue("OK");

        await service.setSession("session-123", { userId: "user-456" });

        expect(mockSessionClient.setex).toHaveBeenCalledWith(
          "session:session-123",
          3600,
          expect.any(String),
        );
      });
    });

    describe("getSession", () => {
      it("should retrieve session data", async () => {
        const sessionData = { userId: "user-456", email: "test@example.com" };
        mockSessionClient.get.mockResolvedValue(JSON.stringify(sessionData));

        const result = await service.getSession("session-123");

        expect(result).toEqual(sessionData);
        expect(mockSessionClient.get).toHaveBeenCalledWith(
          "session:session-123",
        );
      });

      it("should return null for non-existent session", async () => {
        mockSessionClient.get.mockResolvedValue(null);

        const result = await service.getSession("non-existent");

        expect(result).toBeNull();
      });
    });

    describe("deleteSession", () => {
      it("should delete session", async () => {
        mockSessionClient.del.mockResolvedValue(1);

        await service.deleteSession("session-123");

        expect(mockSessionClient.del).toHaveBeenCalledWith(
          "session:session-123",
        );
      });
    });

    describe("extendSession", () => {
      it("should extend session TTL", async () => {
        mockSessionClient.expire.mockResolvedValue(1);

        const result = await service.extendSession("session-123", 7200);

        expect(result).toBe(true);
        expect(mockSessionClient.expire).toHaveBeenCalledWith(
          "session:session-123",
          7200,
        );
      });

      it("should return false for non-existent session", async () => {
        mockSessionClient.expire.mockResolvedValue(0);

        const result = await service.extendSession("non-existent");

        expect(result).toBe(false);
      });
    });
  });

  describe("token blacklist management", () => {
    describe("blacklistToken", () => {
      it("should blacklist a token", async () => {
        mockRedisClient.setex.mockResolvedValue("OK");

        await service.blacklistToken("token-123", 3600);

        expect(mockRedisClient.setex).toHaveBeenCalledWith(
          "blacklist:token-123",
          3600,
          "1",
        );
      });
    });

    describe("isTokenBlacklisted", () => {
      it("should return true for blacklisted token", async () => {
        mockRedisClient.get.mockResolvedValue("1");

        const result = await service.isTokenBlacklisted("token-123");

        expect(result).toBe(true);
        expect(mockRedisClient.get).toHaveBeenCalledWith("blacklist:token-123");
      });

      it("should return false for non-blacklisted token", async () => {
        mockRedisClient.get.mockResolvedValue(null);

        const result = await service.isTokenBlacklisted("token-456");

        expect(result).toBe(false);
      });
    });
  });

  describe("rate limiting", () => {
    describe("incrementRateLimit", () => {
      it("should increment rate limit counter", async () => {
        const mockMulti = {
          incr: jest.fn().mockReturnThis(),
          expire: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([
            [null, 5],
            [null, 1],
          ]),
        };
        mockRedisClient.multi.mockReturnValue(mockMulti);

        const result = await service.incrementRateLimit("rate:user:123", 60);

        expect(result).toBe(5);
        expect(mockMulti.incr).toHaveBeenCalledWith("rate:user:123");
        expect(mockMulti.expire).toHaveBeenCalledWith("rate:user:123", 60);
      });
    });

    describe("getRateLimitCount", () => {
      it("should get rate limit count", async () => {
        mockRedisClient.get.mockResolvedValue("10");

        const result = await service.getRateLimitCount("rate:user:123");

        expect(result).toBe(10);
        expect(mockRedisClient.get).toHaveBeenCalledWith("rate:user:123");
      });

      it("should return 0 for non-existent key", async () => {
        mockRedisClient.get.mockResolvedValue(null);

        const result = await service.getRateLimitCount("rate:user:456");

        expect(result).toBe(0);
      });
    });
  });

  describe("user session tracking", () => {
    describe("getUserSessions", () => {
      it("should get all sessions for a user", async () => {
        mockSessionClient.keys.mockResolvedValue([
          "session:123",
          "session:456",
          "session:789",
        ]);
        mockSessionClient.get
          .mockResolvedValueOnce(JSON.stringify({ userId: "user-1" }))
          .mockResolvedValueOnce(JSON.stringify({ userId: "user-2" }))
          .mockResolvedValueOnce(JSON.stringify({ userId: "user-1" }));

        const result = await service.getUserSessions("user-1");

        expect(result).toEqual(["123", "789"]);
      });

      it("should handle invalid session data", async () => {
        mockSessionClient.keys.mockResolvedValue([
          "session:123",
          "session:456",
        ]);
        mockSessionClient.get
          .mockResolvedValueOnce("invalid-json")
          .mockResolvedValueOnce(JSON.stringify({ userId: "user-1" }));

        const result = await service.getUserSessions("user-1");

        expect(result).toEqual(["456"]);
      });
    });

    describe("invalidateUserSessions", () => {
      it("should delete all user sessions", async () => {
        jest
          .spyOn(service, "getUserSessions")
          .mockResolvedValue(["123", "456"]);
        jest.spyOn(service, "deleteSession").mockResolvedValue(undefined);

        await service.invalidateUserSessions("user-1");

        expect(service.deleteSession).toHaveBeenCalledWith("123");
        expect(service.deleteSession).toHaveBeenCalledWith("456");
      });
    });
  });

  describe("cache helpers", () => {
    describe("setCache", () => {
      it("should set cache with TTL", async () => {
        mockRedisClient.setex.mockResolvedValue("OK");

        await service.setCache("test-key", { data: "value" }, 300);

        expect(mockRedisClient.setex).toHaveBeenCalledWith(
          "cache:test-key",
          300,
          JSON.stringify({ data: "value" }),
        );
      });

      it("should set cache without TTL", async () => {
        mockRedisClient.set.mockResolvedValue("OK");

        await service.setCache("test-key", { data: "value" });

        expect(mockRedisClient.set).toHaveBeenCalledWith(
          "cache:test-key",
          JSON.stringify({ data: "value" }),
        );
      });
    });

    describe("getCache", () => {
      it("should get cached data", async () => {
        const cachedData = { data: "value" };
        mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedData));

        const result = await service.getCache("test-key");

        expect(result).toEqual(cachedData);
        expect(mockRedisClient.get).toHaveBeenCalledWith("cache:test-key");
      });

      it("should return null for cache miss", async () => {
        mockRedisClient.get.mockResolvedValue(null);

        const result = await service.getCache("non-existent");

        expect(result).toBeNull();
      });
    });

    describe("deleteCache", () => {
      it("should delete cached entry", async () => {
        mockRedisClient.del.mockResolvedValue(1);

        await service.deleteCache("test-key");

        expect(mockRedisClient.del).toHaveBeenCalledWith("cache:test-key");
      });
    });

    describe("clearCache", () => {
      it("should clear cache by pattern", async () => {
        mockRedisClient.keys.mockResolvedValue([
          "cache:user:1",
          "cache:user:2",
        ]);
        mockRedisClient.del.mockResolvedValue(2);

        await service.clearCache("user:*");

        expect(mockRedisClient.keys).toHaveBeenCalledWith("cache:user:*");
        expect(mockRedisClient.del).toHaveBeenCalledWith(
          "cache:user:1",
          "cache:user:2",
        );
      });

      it("should not call del when no matching keys", async () => {
        mockRedisClient.keys.mockResolvedValue([]);

        await service.clearCache("non-existent:*");

        expect(mockRedisClient.del).not.toHaveBeenCalled();
      });
    });
  });

  describe("proxy methods", () => {
    describe("get", () => {
      it("should proxy get to Redis client", async () => {
        mockRedisClient.get.mockResolvedValue("value");

        const result = await service.get("key");

        expect(result).toBe("value");
        expect(mockRedisClient.get).toHaveBeenCalledWith("key");
      });
    });

    describe("set", () => {
      it("should proxy set to Redis client", async () => {
        mockRedisClient.set.mockResolvedValue("OK");

        const result = await service.set("key", "value", "EX", 300);

        expect(result).toBe("OK");
        expect(mockRedisClient.set).toHaveBeenCalledWith(
          "key",
          "value",
          "EX",
          300,
        );
      });
    });

    describe("hincrby", () => {
      it("should increment hash field", async () => {
        mockRedisClient.hincrby.mockResolvedValue(10);

        const result = await service.hincrby("hash-key", "field", 5);

        expect(result).toBe(10);
        expect(mockRedisClient.hincrby).toHaveBeenCalledWith(
          "hash-key",
          "field",
          5,
        );
      });
    });

    describe("expire", () => {
      it("should set expiration", async () => {
        mockRedisClient.expire.mockResolvedValue(1);

        const result = await service.expire("key", 300);

        expect(result).toBe(1);
        expect(mockRedisClient.expire).toHaveBeenCalledWith("key", 300);
      });
    });

    describe("hgetall", () => {
      it("should get all hash fields", async () => {
        const hashData = { field1: "value1", field2: "value2" };
        mockRedisClient.hgetall.mockResolvedValue(hashData);

        const result = await service.hgetall("hash-key");

        expect(result).toEqual(hashData);
        expect(mockRedisClient.hgetall).toHaveBeenCalledWith("hash-key");
      });
    });
  });

  describe("onModuleDestroy", () => {
    it("should quit both Redis connections", async () => {
      mockRedisClient.quit.mockResolvedValue("OK");
      mockSessionClient.quit.mockResolvedValue("OK");

      await service.onModuleDestroy();

      expect(mockRedisClient.quit).toHaveBeenCalled();
      expect(mockSessionClient.quit).toHaveBeenCalled();
    });
  });
});
