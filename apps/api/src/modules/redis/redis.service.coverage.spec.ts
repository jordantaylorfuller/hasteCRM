import { Test, TestingModule } from "@nestjs/testing";
import { RedisService } from "./redis.service";
import Redis from "ioredis";

// Mock ioredis
jest.mock("ioredis");

describe("RedisService - Coverage Improvements", () => {
  let service: RedisService;
  let mockRedisClient: any;
  let mockSessionClient: any;
  let consoleErrorSpy: jest.SpyInstance;
  let loggerLogSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Create event emitter functionality for mock Redis clients
    const createMockRedisClient = () => {
      const eventHandlers: { [key: string]: ((...args: any[]) => void)[] } = {};
      return {
        on: jest.fn((event: string, handler: (...args: any[]) => void) => {
          if (!eventHandlers[event]) {
            eventHandlers[event] = [];
          }
          eventHandlers[event].push(handler);
        }),
        emit: (event: string, ...args: any[]) => {
          if (eventHandlers[event]) {
            eventHandlers[event].forEach((handler) => handler(...args));
          }
        },
        disconnect: jest.fn(),
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        exists: jest.fn(),
        expire: jest.fn(),
        ttl: jest.fn(),
        setex: jest.fn(),
        keys: jest.fn(),
        mget: jest.fn(),
        flushdb: jest.fn(),
      };
    };

    mockRedisClient = createMockRedisClient();
    mockSessionClient = createMockRedisClient();

    // Keep track of constructor calls
    let constructorCallCount = 0;
    
    // Mock the Redis constructor
    (Redis as unknown as jest.Mock).mockImplementation(() => {
      // Return different clients based on the order of creation
      // First call is main client, second is session client
      constructorCallCount++;
      if (constructorCallCount === 2) {
        return mockSessionClient;
      }
      return mockRedisClient;
    });

    // Spy on console.error and logger
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [RedisService],
    }).compile();

    service = module.get<RedisService>(RedisService);
    
    // Spy on logger after service is created
    loggerLogSpy = jest.spyOn((service as any).logger, "log").mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    loggerLogSpy.mockRestore();
    jest.clearAllMocks();
  });

  describe("Redis event handlers", () => {
    it("should handle error event on main client", () => {
      const error = new Error("Redis connection failed");
      
      // Emit error event
      mockRedisClient.emit("error", error);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Redis Client Error:", error);
    });

    it("should handle error event on session client", () => {
      const error = new Error("Session Redis connection failed");
      
      // Emit error event
      mockSessionClient.emit("error", error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Redis Session Client Error:",
        error,
      );
    });

    it("should handle connect event on main client", () => {
      // Emit connect event
      mockRedisClient.emit("connect");

      expect(loggerLogSpy).toHaveBeenCalledWith("Redis Client Connected");
    });

    it("should handle connect event on session client", () => {
      // Emit connect event
      mockSessionClient.emit("connect");

      expect(loggerLogSpy).toHaveBeenCalledWith("Redis Session Client Connected");
    });
  });

  describe("Event handler registration", () => {
    it("should register all required event handlers", () => {
      // Verify that event handlers were registered
      expect(mockRedisClient.on).toHaveBeenCalledWith("error", expect.any(Function));
      expect(mockRedisClient.on).toHaveBeenCalledWith("connect", expect.any(Function));
      expect(mockSessionClient.on).toHaveBeenCalledWith("error", expect.any(Function));
      expect(mockSessionClient.on).toHaveBeenCalledWith("connect", expect.any(Function));
    });
  });
});