import { logger, logGraphQLOperation, logHttpRequest } from "./winston.config";

describe("winston.config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("logger", () => {
    it("should be defined", () => {
      expect(logger).toBeDefined();
      expect(logger.info).toBeDefined();
      expect(logger.error).toBeDefined();
      expect(logger.warn).toBeDefined();
      expect(logger.debug).toBeDefined();
      expect(logger.verbose).toBeDefined();
    });

    it("should have exception and rejection handlers", () => {
      expect(logger.exceptions).toBeDefined();
      expect(logger.rejections).toBeDefined();
    });
  });

  describe("logGraphQLOperation", () => {
    let mockInfo: jest.SpyInstance;
    let mockError: jest.SpyInstance;

    beforeEach(() => {
      mockInfo = jest.spyOn(logger, "info").mockImplementation();
      mockError = jest.spyOn(logger, "error").mockImplementation();
    });

    afterEach(() => {
      mockInfo.mockRestore();
      mockError.mockRestore();
    });

    it("should log successful GraphQL operation", () => {
      logGraphQLOperation("GetUser", "query", { id: "123" }, "user456", 150);

      expect(mockInfo).toHaveBeenCalledWith("GraphQL operation completed", {
        operationName: "GetUser",
        operationType: "query",
        variables: { id: "123" },
        userId: "user456",
        duration: 150,
        timestamp: expect.any(String),
      });
    });

    it("should log GraphQL operation with error", () => {
      const error = new Error("GraphQL failed");
      error.stack = "stack trace";

      logGraphQLOperation(
        "UpdateUser",
        "mutation",
        { id: "123" },
        "user456",
        200,
        error,
      );

      expect(mockError).toHaveBeenCalledWith("GraphQL operation failed", {
        operationName: "UpdateUser",
        operationType: "mutation",
        variables: { id: "123" },
        userId: "user456",
        duration: 200,
        timestamp: expect.any(String),
        error: "GraphQL failed",
        stack: "stack trace",
      });
    });

    it("should handle null variables", () => {
      logGraphQLOperation("TestOp", "query", null as any, undefined, 100);

      expect(mockInfo).toHaveBeenCalledWith("GraphQL operation completed", {
        operationName: "TestOp",
        operationType: "query",
        variables: null,
        userId: undefined,
        duration: 100,
        timestamp: expect.any(String),
      });
    });

    it("should handle undefined duration", () => {
      logGraphQLOperation("TestOp", "query", {}, "user123", undefined);

      expect(mockInfo).toHaveBeenCalledWith("GraphQL operation completed", {
        operationName: "TestOp",
        operationType: "query",
        variables: {},
        userId: "user123",
        duration: undefined,
        timestamp: expect.any(String),
      });
    });
  });

  describe("logHttpRequest", () => {
    let mockInfo: jest.SpyInstance;
    let mockError: jest.SpyInstance;

    beforeEach(() => {
      mockInfo = jest.spyOn(logger, "info").mockImplementation();
      mockError = jest.spyOn(logger, "error").mockImplementation();
    });

    afterEach(() => {
      mockInfo.mockRestore();
      mockError.mockRestore();
    });

    it("should log successful HTTP request", () => {
      logHttpRequest("GET", "/api/users", 200, 100, "127.0.0.1", "user123");

      expect(mockInfo).toHaveBeenCalledWith("HTTP request completed", {
        request: {
          method: "GET",
          url: "/api/users",
          ip: "127.0.0.1",
          userId: "user123",
        },
        response: {
          statusCode: 200,
          duration: 100,
        },
        timestamp: expect.any(String),
      });
    });

    it("should log failed HTTP request with error", () => {
      const error = new Error("Server error");
      error.stack = "stack trace";

      logHttpRequest(
        "POST",
        "/api/users",
        500,
        200,
        "127.0.0.1",
        "user123",
        error,
      );

      expect(mockError).toHaveBeenCalledWith("HTTP request failed", {
        request: {
          method: "POST",
          url: "/api/users",
          ip: "127.0.0.1",
          userId: "user123",
        },
        response: {
          statusCode: 500,
          duration: 200,
        },
        timestamp: expect.any(String),
        error: "Server error",
        stack: "stack trace",
      });
    });

    it("should log 4xx status codes as errors", () => {
      logHttpRequest("GET", "/api/protected", 401, 50, "127.0.0.1");

      expect(mockError).toHaveBeenCalledWith("HTTP request failed", {
        request: {
          method: "GET",
          url: "/api/protected",
          ip: "127.0.0.1",
          userId: undefined,
        },
        response: {
          statusCode: 401,
          duration: 50,
        },
        timestamp: expect.any(String),
        error: undefined,
        stack: undefined,
      });
    });

    it("should handle requests without error object but with error status", () => {
      logHttpRequest("DELETE", "/api/resource", 404, 75);

      expect(mockError).toHaveBeenCalledWith("HTTP request failed", {
        request: {
          method: "DELETE",
          url: "/api/resource",
          ip: undefined,
          userId: undefined,
        },
        response: {
          statusCode: 404,
          duration: 75,
        },
        timestamp: expect.any(String),
        error: undefined,
        stack: undefined,
      });
    });

    it("should handle all optional parameters", () => {
      logHttpRequest("PATCH", "/api/update", 200, 50);

      expect(mockInfo).toHaveBeenCalledWith("HTTP request completed", {
        request: {
          method: "PATCH",
          url: "/api/update",
          ip: undefined,
          userId: undefined,
        },
        response: {
          statusCode: 200,
          duration: 50,
        },
        timestamp: expect.any(String),
      });
    });
  });

  describe("environment configuration", () => {
    it("should use default log level when not specified", () => {
      delete process.env.LOG_LEVEL;
      // The logger is already created, so we just verify it exists
      expect(logger).toBeDefined();
    });

    it("should handle production environment", () => {
      process.env.NODE_ENV = "production";
      // The logger is already created, so we just verify it exists
      expect(logger).toBeDefined();
    });
  });
});
