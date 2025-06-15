import { Test } from "@nestjs/testing";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe, BadRequestException, Logger } from "@nestjs/common";
import { bootstrap } from "./main";
import { AppModule } from "./app.module";
import * as dotenv from "dotenv";
import compression from "compression";
import helmet from "helmet";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ValidationExceptionFilter } from "./common/filters/validation-exception.filter";
import { ErrorLoggingInterceptor } from "./common/interceptors/error-logging.interceptor";

// Mock all external dependencies
jest.mock("@nestjs/core");
jest.mock("dotenv");
jest.mock("compression");
jest.mock("helmet");
jest.mock("./app.module");
jest.mock("./common/filters/all-exceptions.filter");
jest.mock("./common/filters/http-exception.filter");
jest.mock("./common/filters/validation-exception.filter");
jest.mock("./common/interceptors/error-logging.interceptor");

// Prevent automatic bootstrap on import
const originalBootstrap = process.env.NODE_ENV;
process.env.NODE_ENV = "test";

describe("Main Bootstrap", () => {
  let mockApp: any;
  let mockLogger: jest.SpyInstance;
  let originalEnv: NodeJS.ProcessEnv;
  let consoleErrorSpy: jest.SpyInstance;
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    // Save original environment
    originalEnv = process.env;
    process.env = { ...originalEnv };

    // Mock app instance
    mockApp = {
      use: jest.fn(),
      enableCors: jest.fn(),
      useGlobalFilters: jest.fn(),
      useGlobalInterceptors: jest.fn(),
      useGlobalPipes: jest.fn(),
      enableShutdownHooks: jest.fn(),
      listen: jest.fn().mockResolvedValue(undefined),
    };

    // Mock NestFactory
    (NestFactory.create as jest.Mock).mockResolvedValue(mockApp);

    // Mock Logger
    mockLogger = jest.spyOn(Logger.prototype, "log").mockImplementation();

    // Mock process.exit
    processExitSpy = jest
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as any);

    // Mock console.error
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    // Mock compression and helmet
    (compression as jest.Mock).mockReturnValue("compression-middleware");
    (helmet as jest.Mock).mockReturnValue("helmet-middleware");
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.env = originalEnv;
    mockLogger.mockRestore();
    processExitSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("bootstrap", () => {
    it("should create app with correct configuration", async () => {
      await bootstrap();

      expect(NestFactory.create).toHaveBeenCalledWith(AppModule, {
        logger: ["error", "warn", "log", "debug", "verbose"],
      });
    });

    it("should apply security middleware", async () => {
      process.env.NODE_ENV = "development";
      await bootstrap();

      expect(helmet).toHaveBeenCalledWith({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
      });
      expect(compression).toHaveBeenCalled();
      expect(mockApp.use).toHaveBeenCalledWith("helmet-middleware");
      expect(mockApp.use).toHaveBeenCalledWith("compression-middleware");
    });

    it("should use default CSP in production", async () => {
      process.env.NODE_ENV = "production";
      await bootstrap();

      expect(helmet).toHaveBeenCalledWith({
        contentSecurityPolicy: undefined,
        crossOriginEmbedderPolicy: false,
      });
    });

    it("should enable CORS with custom origins", async () => {
      process.env.CORS_ORIGINS = "http://localhost:3000,http://example.com";
      await bootstrap();

      expect(mockApp.enableCors).toHaveBeenCalledWith({
        origin: ["http://localhost:3000", "http://example.com"],
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
      });
    });

    it("should enable CORS with default origins", async () => {
      delete process.env.CORS_ORIGINS;
      await bootstrap();

      expect(mockApp.enableCors).toHaveBeenCalledWith({
        origin: true,
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
      });
    });

    it("should add request ID middleware", async () => {
      await bootstrap();

      // Get the middleware function
      const middlewareCall = mockApp.use.mock.calls.find(
        (call) => typeof call[0] === "function" && call[0].length === 3,
      );
      expect(middlewareCall).toBeDefined();

      // Test the middleware
      const middleware = middlewareCall[0];
      const mockReq: any = { headers: {} };
      const mockRes: any = { setHeader: jest.fn() };
      const mockNext = jest.fn();

      middleware(mockReq, mockRes, mockNext);

      expect(mockReq.id).toBeDefined();
      expect(mockReq.id).toMatch(/^req-\d+-[a-z0-9]+$/);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "X-Request-ID",
        mockReq.id,
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it("should use existing request ID if provided", async () => {
      await bootstrap();

      const middleware = mockApp.use.mock.calls.find(
        (call) => typeof call[0] === "function" && call[0].length === 3,
      )[0];

      const mockReq: any = { headers: { "x-request-id": "existing-id" } };
      const mockRes: any = { setHeader: jest.fn() };
      const mockNext = jest.fn();

      middleware(mockReq, mockRes, mockNext);

      expect(mockReq.id).toBe("existing-id");
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "X-Request-ID",
        "existing-id",
      );
    });

    it("should set up global exception filters in correct order", async () => {
      await bootstrap();

      expect(mockApp.useGlobalFilters).toHaveBeenCalledWith(
        expect.any(ValidationExceptionFilter),
        expect.any(HttpExceptionFilter),
        expect.any(AllExceptionsFilter),
      );
    });

    it("should set up global interceptors", async () => {
      await bootstrap();

      expect(mockApp.useGlobalInterceptors).toHaveBeenCalledWith(
        expect.any(ErrorLoggingInterceptor),
      );
    });

    it("should set up global validation pipe", async () => {
      await bootstrap();

      expect(mockApp.useGlobalPipes).toHaveBeenCalledTimes(1);
      const pipeCall = mockApp.useGlobalPipes.mock.calls[0][0];
      expect(pipeCall).toBeInstanceOf(ValidationPipe);
    });

    it("should create BadRequestException for validation errors", async () => {
      await bootstrap();

      const pipeCall = mockApp.useGlobalPipes.mock.calls[0][0];
      const errors = [
        { property: "test", constraints: { required: "test is required" } },
      ];

      // Access the exceptionFactory from the pipe options
      const exception = pipeCall.exceptionFactory(errors);

      expect(exception).toBeInstanceOf(BadRequestException);
    });

    it("should enable shutdown hooks", async () => {
      await bootstrap();

      expect(mockApp.enableShutdownHooks).toHaveBeenCalled();
    });

    it("should listen on default port", async () => {
      delete process.env.PORT;
      await bootstrap();

      expect(mockApp.listen).toHaveBeenCalledWith(4000);
    });

    it("should listen on custom port", async () => {
      process.env.PORT = "5000";
      await bootstrap();

      expect(mockApp.listen).toHaveBeenCalledWith("5000");
    });

    it("should log startup messages", async () => {
      process.env.PORT = "4000";
      process.env.NODE_ENV = "production";
      await bootstrap();

      expect(mockLogger).toHaveBeenCalledWith(
        "🚀 API running on http://localhost:4000",
      );
      expect(mockLogger).toHaveBeenCalledWith(
        "📝 GraphQL playground: http://localhost:4000/graphql",
      );
      expect(mockLogger).toHaveBeenCalledWith("🌍 Environment: production");
    });

    it("should use development as default environment", async () => {
      delete process.env.NODE_ENV;
      await bootstrap();

      expect(mockLogger).toHaveBeenCalledWith("🌍 Environment: development");
    });
  });

  describe("BigInt serialization", () => {
    it("should add toJSON method to BigInt prototype", () => {
      const bigIntValue = BigInt(123456789);
      expect((bigIntValue as any).toJSON()).toBe("123456789");
    });
  });

  describe("Process error handlers", () => {
    let originalUncaughtException: any;
    let originalUnhandledRejection: any;

    beforeEach(() => {
      // Store original handlers
      originalUncaughtException = process.listeners("uncaughtException");
      originalUnhandledRejection = process.listeners("unhandledRejection");

      // Remove all listeners
      process.removeAllListeners("uncaughtException");
      process.removeAllListeners("unhandledRejection");
    });

    afterEach(() => {
      // Restore original handlers
      process.removeAllListeners("uncaughtException");
      process.removeAllListeners("unhandledRejection");
      originalUncaughtException.forEach((handler: any) => {
        process.on("uncaughtException", handler);
      });
      originalUnhandledRejection.forEach((handler: any) => {
        process.on("unhandledRejection", handler);
      });
    });

    it("should handle uncaught exceptions", () => {
      // Re-require to register handlers
      jest.isolateModules(() => {
        require("./main");
      });

      const error = new Error("Test uncaught exception");
      process.emit("uncaughtException", error);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Uncaught Exception:",
        error,
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it("should handle unhandled rejections", () => {
      // Re-require to register handlers
      jest.isolateModules(() => {
        require("./main");
      });

      const reason = "Test rejection reason";
      const promise = Promise.reject(reason).catch(() => {}); // Catch to prevent actual unhandled rejection
      process.emit("unhandledRejection", reason, promise);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Unhandled Rejection at:",
        promise,
        "reason:",
        reason,
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("dotenv configuration", () => {
    it("should load environment variables from correct path", () => {
      // Since dotenv.config is called at module level, we need to re-import
      jest.resetModules();
      jest.doMock("dotenv", () => ({
        config: jest.fn(),
      }));

      // Import the module fresh
      require("./main");

      const dotenvMock = require("dotenv");
      expect(dotenvMock.config).toHaveBeenCalledWith({
        path: expect.stringContaining(".env"),
      });
    });
  });

  describe("bootstrap on module run", () => {
    it("should verify that bootstrap is called conditionally", () => {
      // Since we can't mock require.main, we verify the condition exists
      // The actual bootstrap call when run as main is tested by running the file directly

      // Verify the bootstrap function is exported and callable
      const { bootstrap } = require("./main");
      expect(bootstrap).toBeDefined();
      expect(typeof bootstrap).toBe("function");

      // The conditional execution (line 104) is tested implicitly
      // by the fact that bootstrap() is not called during test imports
      expect(NestFactory.create).not.toHaveBeenCalled();
    });
  });
});
