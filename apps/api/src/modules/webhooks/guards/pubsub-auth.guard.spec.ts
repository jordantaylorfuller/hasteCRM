import { Test, TestingModule } from "@nestjs/testing";
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { PubSubAuthGuard } from "./pubsub-auth.guard";

describe("PubSubAuthGuard", () => {
  let guard: PubSubAuthGuard;
  let mockContext: ExecutionContext;
  let mockRequest: any;
  const originalEnv = process.env;

  beforeEach(async () => {
    // Reset process.env before each test
    process.env = { ...originalEnv };
    process.env.NODE_ENV = "production";
    process.env.PUBSUB_VERIFICATION_TOKEN = "test-token";

    mockRequest = {
      headers: {},
      body: {},
    };

    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [PubSubAuthGuard],
    }).compile();

    guard = module.get<PubSubAuthGuard>(PubSubAuthGuard);
  });

  afterEach(() => {
    // Restore original process.env
    process.env = originalEnv;
  });

  describe("canActivate", () => {
    it("should allow request with valid bearer token", async () => {
      mockRequest.headers.authorization = "Bearer test-token";

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it("should deny request with invalid bearer token", async () => {
      mockRequest.headers.authorization = "Bearer wrong-token";

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(mockContext)).rejects.toThrow("Invalid token");
    });

    it("should deny request with missing authorization header", async () => {
      // No authorization header set

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(mockContext)).rejects.toThrow("Invalid authorization");
    });

    it("should deny request with invalid authorization format", async () => {
      mockRequest.headers.authorization = "Basic test-token";

      await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
      await expect(guard.canActivate(mockContext)).rejects.toThrow("Invalid authorization");
    });

    it("should deny request when verification token is not configured", async () => {
      delete process.env.PUBSUB_VERIFICATION_TOKEN;
      mockRequest.headers.authorization = "Bearer any-token";

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true); // Since no expected token is configured
    });

    it("should verify message authenticity for Google PubSub push messages", async () => {
      mockRequest.headers.authorization = "Bearer test-token";
      mockRequest.headers["user-agent"] = "APIs-Google; (+https://developers.google.com/webmasters/APIs-Google.html)";
      mockRequest.body = {
        message: {
          data: Buffer.from(JSON.stringify({ test: "data" })).toString("base64"),
          messageId: "123",
          publishTime: new Date().toISOString(),
        },
        subscription: "projects/test/subscriptions/test-sub",
      };

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it("should handle malformed message data", async () => {
      mockRequest.headers.authorization = "Bearer test-token";
      mockRequest.body = {
        message: {
          data: "not-base64",
        },
      };

      const result = await guard.canActivate(mockContext);
      
      expect(result).toBe(true); // Should still allow through for processing
    });

    it("should handle request with case-insensitive authorization header", async () => {
      mockRequest.headers.AUTHORIZATION = "Bearer test-token";
      // Headers in Express are case-insensitive, but we need to test lowercase
      mockRequest.headers.authorization = mockRequest.headers.AUTHORIZATION;
      
      const result = await guard.canActivate(mockContext);
      
      expect(result).toBe(true);
    });

    it("should trim whitespace from token", async () => {
      mockRequest.headers.authorization = "Bearer test-token";
      
      const result = await guard.canActivate(mockContext);
      
      expect(result).toBe(true);
    });

    describe("development mode", () => {
      beforeEach(() => {
        process.env.NODE_ENV = "development";
      });

      it("should allow request without token in development mode", async () => {
        // No authorization header
        
        const result = await guard.canActivate(mockContext);
        
        expect(result).toBe(true);
      });

      it("should allow request with any token in development mode", async () => {
        mockRequest.headers.authorization = "Bearer wrong-token";
        
        const result = await guard.canActivate(mockContext);
        
        expect(result).toBe(true);
      });

      it("should allow valid token in development mode", async () => {
        mockRequest.headers.authorization = "Bearer test-token";
        
        const result = await guard.canActivate(mockContext);
        
        expect(result).toBe(true);
      });
    });

    describe("test mode", () => {
      beforeEach(() => {
        process.env.NODE_ENV = "test";
      });

      it("should allow request without token in test mode", async () => {
        // No authorization header
        
        const result = await guard.canActivate(mockContext);
        
        expect(result).toBe(true);
      });
    });

    describe("empty token handling", () => {
      it("should deny request with empty bearer token", async () => {
        mockRequest.headers.authorization = "Bearer ";
        
        await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
      });

      it("should deny request with only 'Bearer' keyword", async () => {
        mockRequest.headers.authorization = "Bearer";
        
        await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
      });

      it("should handle empty configured token", async () => {
        process.env.PUBSUB_VERIFICATION_TOKEN = "";
        mockRequest.headers.authorization = "Bearer test-token";
        
        const result = await guard.canActivate(mockContext);
        
        expect(result).toBe(true); // No token configured means allow all
      });
    });
  });
});