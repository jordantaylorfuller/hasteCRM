import { Test, TestingModule } from "@nestjs/testing";
import { CustomLoggerService } from "./logger.service";
import * as winston from "./winston.config";

// Mock winston logger
jest.mock("./winston.config", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  },
}));

describe("CustomLoggerService", () => {
  let service: CustomLoggerService;
  let mockLogger: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomLoggerService],
    }).compile();

    service = module.get<CustomLoggerService>(CustomLoggerService);
    mockLogger = winston.logger;
    jest.clearAllMocks();
  });

  describe("log", () => {
    it("should call winston info with message and context", () => {
      service.log("Test message", "TestContext");
      expect(mockLogger.info).toHaveBeenCalledWith("Test message", {
        context: "TestContext",
      });
    });

    it("should handle log without context", () => {
      service.log("Test message");
      expect(mockLogger.info).toHaveBeenCalledWith("Test message", {
        context: undefined,
      });
    });
  });

  describe("error", () => {
    it("should call winston error with message, trace and context", () => {
      service.error("Error message", "stack trace", "TestContext");
      expect(mockLogger.error).toHaveBeenCalledWith("Error message", {
        trace: "stack trace",
        context: "TestContext",
      });
    });

    it("should handle error without trace and context", () => {
      service.error("Error message");
      expect(mockLogger.error).toHaveBeenCalledWith("Error message", {
        trace: undefined,
        context: undefined,
      });
    });
  });

  describe("warn", () => {
    it("should call winston warn with message and context", () => {
      service.warn("Warning message", "TestContext");
      expect(mockLogger.warn).toHaveBeenCalledWith("Warning message", {
        context: "TestContext",
      });
    });
  });

  describe("debug", () => {
    it("should call winston debug with message and context", () => {
      service.debug("Debug message", "TestContext");
      expect(mockLogger.debug).toHaveBeenCalledWith("Debug message", {
        context: "TestContext",
      });
    });
  });

  describe("verbose", () => {
    it("should call winston verbose with message and context", () => {
      service.verbose("Verbose message", "TestContext");
      expect(mockLogger.verbose).toHaveBeenCalledWith("Verbose message", {
        context: "TestContext",
      });
    });
  });

  describe("logRequest", () => {
    it("should log HTTP request on response finish", () => {
      const req = {
        method: "GET",
        url: "/test",
        ip: "127.0.0.1",
        headers: { "user-agent": "test-agent" },
        user: { id: "user123" },
        connection: { remoteAddress: "192.168.1.1" },
      };
      const res = {
        statusCode: 200,
        on: jest.fn((event, callback) => {
          if (event === "finish") {
            callback();
          }
        }),
      };
      const next = jest.fn();

      service.logRequest(req as any, res as any, next);

      expect(next).toHaveBeenCalled();
      expect(res.on).toHaveBeenCalledWith("finish", expect.any(Function));
      expect(mockLogger.info).toHaveBeenCalledWith("HTTP Request", {
        request: {
          method: "GET",
          url: "/test",
          ip: "127.0.0.1",
          userAgent: "test-agent",
          userId: "user123",
        },
        response: {
          statusCode: 200,
          duration: expect.any(Number),
        },
      });
    });

    it("should use connection.remoteAddress if ip is not available", () => {
      const req = {
        method: "POST",
        url: "/api/test",
        headers: {},
        connection: { remoteAddress: "10.0.0.1" },
      };
      const res = {
        statusCode: 201,
        on: jest.fn((event, callback) => {
          if (event === "finish") {
            callback();
          }
        }),
      };
      const next = jest.fn();

      service.logRequest(req as any, res as any, next);

      expect(mockLogger.info).toHaveBeenCalledWith("HTTP Request", {
        request: {
          method: "POST",
          url: "/api/test",
          ip: "10.0.0.1",
          userAgent: undefined,
          userId: undefined,
        },
        response: {
          statusCode: 201,
          duration: expect.any(Number),
        },
      });
    });
  });

  describe("logGraphQL", () => {
    it("should log successful GraphQL operation", () => {
      const context = { req: { user: { id: "user456" } } };
      service.logGraphQL("GetUser", "query", { id: "123" }, context, 150, null);

      expect(mockLogger.info).toHaveBeenCalledWith("GraphQL Operation", {
        graphql: {
          operationName: "GetUser",
          operationType: "query",
          variables: { id: "123" },
          userId: "user456",
          duration: 150,
        },
      });
    });

    it("should log GraphQL error", () => {
      const error = {
        message: "GraphQL error",
        extensions: { code: "FORBIDDEN" },
        stack: "error stack",
      };
      service.logGraphQL("UpdateUser", "mutation", {}, {}, 200, error);

      expect(mockLogger.error).toHaveBeenCalledWith("GraphQL Error", {
        graphql: {
          operationName: "UpdateUser",
          operationType: "mutation",
          variables: {},
          userId: undefined,
          duration: 200,
        },
        error: {
          message: "GraphQL error",
          extensions: { code: "FORBIDDEN" },
          stack: "error stack",
        },
      });
    });

    it("should sanitize sensitive variables", () => {
      const variables = {
        password: "secret123",
        token: "jwt-token",
        secret: "api-secret",
        apiKey: "key-123",
        normalField: "value",
      };
      service.logGraphQL("Login", "mutation", variables, {}, 100, null);

      expect(mockLogger.info).toHaveBeenCalledWith("GraphQL Operation", {
        graphql: {
          operationName: "Login",
          operationType: "mutation",
          variables: {
            password: "[REDACTED]",
            token: "[REDACTED]",
            secret: "[REDACTED]",
            apiKey: "[REDACTED]",
            normalField: "value",
          },
          userId: undefined,
          duration: 100,
        },
      });
    });
  });

  describe("logDatabaseQuery", () => {
    it("should log successful database query", () => {
      service.logDatabaseQuery("SELECT * FROM users", [], 50, null);

      expect(mockLogger.debug).toHaveBeenCalledWith("Database Query", {
        database: {
          query: "SELECT * FROM users",
          params: [],
          duration: 50,
        },
      });
    });

    it("should log slow database query as warning", () => {
      service.logDatabaseQuery(
        "SELECT * FROM large_table",
        ["param1"],
        1500,
        null,
      );

      expect(mockLogger.warn).toHaveBeenCalledWith("Slow Database Query", {
        database: {
          query: "SELECT * FROM large_table",
          params: ["param1"],
          duration: 1500,
        },
      });
    });

    it("should log database error", () => {
      const error = {
        message: "Connection timeout",
        code: "ETIMEDOUT",
        stack: "error stack",
      };
      service.logDatabaseQuery("INSERT INTO users", ["data"], 100, error);

      expect(mockLogger.error).toHaveBeenCalledWith("Database Error", {
        database: {
          query: "INSERT INTO users",
          params: ["data"],
          duration: 100,
        },
        error: {
          message: "Connection timeout",
          code: "ETIMEDOUT",
          stack: "error stack",
        },
      });
    });

    it("should sanitize password in query", () => {
      const query = "UPDATE users SET password='mypassword' WHERE id = 1";
      service.logDatabaseQuery(query, [], 100, null);

      expect(mockLogger.debug).toHaveBeenCalledWith("Database Query", {
        database: {
          query: "UPDATE users SET password='[REDACTED]' WHERE id = 1",
          params: [],
          duration: 100,
        },
      });
    });

    it("should truncate long params", () => {
      const longParam = "a".repeat(150);
      service.logDatabaseQuery(
        "INSERT INTO logs",
        [longParam, "short"],
        50,
        null,
      );

      expect(mockLogger.debug).toHaveBeenCalledWith("Database Query", {
        database: {
          query: "INSERT INTO logs",
          params: ["[TRUNCATED]", "short"],
          duration: 50,
        },
      });
    });
  });

  describe("logEmailEvent", () => {
    it("should log successful email event", () => {
      const email = {
        messageId: "msg123",
        threadId: "thread456",
        subject: "Test Email",
        from: "sender@example.com",
        to: ["recipient@example.com"],
      };
      service.logEmailEvent("sent", email, null);

      expect(mockLogger.info).toHaveBeenCalledWith("Email Event", {
        email: {
          event: "sent",
          messageId: "msg123",
          threadId: "thread456",
          subject: "Test Email",
          from: "sender@example.com",
          to: ["recipient@example.com"],
        },
      });
    });

    it("should log email error", () => {
      const email = { messageId: "msg789" };
      const error = {
        message: "SMTP connection failed",
        code: "ECONNREFUSED",
        stack: "error stack",
      };
      service.logEmailEvent("failed", email, error);

      expect(mockLogger.error).toHaveBeenCalledWith("Email Error", {
        email: {
          event: "failed",
          messageId: "msg789",
          threadId: undefined,
          subject: undefined,
          from: undefined,
          to: undefined,
        },
        error: {
          message: "SMTP connection failed",
          code: "ECONNREFUSED",
          stack: "error stack",
        },
      });
    });
  });

  describe("logAIOperation", () => {
    it("should log successful AI operation", () => {
      const input = { prompt: "Test prompt" };
      const output = { response: "Test response" };
      service.logAIOperation("completion", input, output, 500, null);

      expect(mockLogger.info).toHaveBeenCalledWith("AI Operation", {
        ai: {
          operation: "completion",
          inputLength: JSON.stringify(input).length,
          outputLength: JSON.stringify(output).length,
          duration: 500,
        },
      });
    });

    it("should log AI error", () => {
      const error = {
        message: "Rate limit exceeded",
        stack: "error stack",
      };
      service.logAIOperation(
        "summarize",
        { text: "long text" },
        null,
        100,
        error,
      );

      expect(mockLogger.error).toHaveBeenCalledWith("AI Error", {
        ai: {
          operation: "summarize",
          inputLength: JSON.stringify({ text: "long text" }).length,
          outputLength: 0,
          duration: 100,
        },
        error: {
          message: "Rate limit exceeded",
          stack: "error stack",
        },
      });
    });
  });

  describe("logSecurityEvent", () => {
    it("should log security event", () => {
      const details = {
        ip: "192.168.1.100",
        attempts: 5,
        action: "blocked",
      };
      service.logSecurityEvent("failed_login_attempts", "user123", details);

      expect(mockLogger.warn).toHaveBeenCalledWith("Security Event", {
        security: {
          event: "failed_login_attempts",
          userId: "user123",
          details,
          timestamp: expect.any(String),
        },
      });
    });
  });

  describe("private methods", () => {
    it("should handle null variables in sanitizeVariables", () => {
      service.logGraphQL("Test", "query", null, {}, 100, null);

      expect(mockLogger.info).toHaveBeenCalledWith("GraphQL Operation", {
        graphql: {
          operationName: "Test",
          operationType: "query",
          variables: {},
          userId: undefined,
          duration: 100,
        },
      });
    });
  });
});
