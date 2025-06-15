import { Test } from "@nestjs/testing";
import { ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";
import { AllExceptionsFilter } from "./all-exceptions.filter";
import { GraphQLError } from "graphql";
import { GqlArgumentsHost } from "@nestjs/graphql";

jest.mock("@nestjs/graphql", () => ({
  ...jest.requireActual("@nestjs/graphql"),
  GqlArgumentsHost: {
    create: jest.fn(),
  },
}));

describe("AllExceptionsFilter", () => {
  let filter: AllExceptionsFilter;
  let mockArgumentsHost: ArgumentsHost;
  let mockHttpArgumentsHost: any;
  let mockGqlArgumentsHost: any;
  let mockResponse: any;
  let mockRequest: any;
  let mockContext: any;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AllExceptionsFilter],
    }).compile();

    filter = module.get<AllExceptionsFilter>(AllExceptionsFilter);

    // Mock HTTP context
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockRequest = {
      url: "/api/test",
      method: "GET",
      ip: "127.0.0.1",
      id: "req-123",
      get: jest.fn((header) => {
        if (header === "user-agent") return "Mozilla/5.0";
        return undefined;
      }),
      user: { id: "user-123" },
    };

    mockHttpArgumentsHost = {
      getResponse: jest.fn().mockReturnValue(mockResponse),
      getRequest: jest.fn().mockReturnValue(mockRequest),
    };

    // Mock GraphQL context
    mockContext = {
      req: mockRequest,
    };

    mockGqlArgumentsHost = {
      getContext: jest.fn().mockReturnValue(mockContext),
      getInfo: jest.fn().mockReturnValue({
        path: { key: "testQuery" },
      }),
    };

    // Mock ArgumentsHost
    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue(mockHttpArgumentsHost),
      getType: jest.fn().mockReturnValue("http"),
    } as any;

    // Mock GqlArgumentsHost.create
    (GqlArgumentsHost.create as jest.Mock).mockReturnValue(
      mockGqlArgumentsHost,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("HTTP Exceptions", () => {
    it("should handle HttpException", () => {
      const exception = new HttpException("Forbidden", HttpStatus.FORBIDDEN);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.FORBIDDEN,
          message: "Forbidden",
          path: "/api/test",
          requestId: "req-123",
          timestamp: expect.any(String),
        }),
      );
    });

    it("should handle HttpException with custom response object", () => {
      const customResponse = {
        message: "Custom error message",
        error: "CustomError",
      };
      const exception = new HttpException(
        customResponse,
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          message: "Custom error message",
          error: "CustomError",
          path: "/api/test",
          requestId: "req-123",
        }),
      );
    });

    it("should handle generic Error", () => {
      const exception = new Error("Something went wrong");

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "Something went wrong",
          path: "/api/test",
          requestId: "req-123",
        }),
      );
    });

    it("should handle Prisma P2002 error (unique constraint)", () => {
      const exception: any = new Error("Unique constraint failed");
      exception.name = "PrismaClientKnownRequestError";
      exception.code = "P2002";

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.CONFLICT,
          message: "Unique constraint failed",
          error: "Unique constraint violation",
        }),
      );
    });

    it("should handle Prisma P2025 error (record not found)", () => {
      const exception: any = new Error("Record not found");
      exception.name = "PrismaClientKnownRequestError";
      exception.code = "P2025";

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.NOT_FOUND,
          message: "Record not found",
          error: "Record not found",
        }),
      );
    });

    it("should handle ValidationError", () => {
      const exception: any = new Error("Validation failed");
      exception.name = "ValidationError";

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          message: "Validation failed",
          error: "Validation Error",
        }),
      );
    });

    it("should include stack trace in development mode", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const exception = new Error("Test error");
      exception.stack = "Error: Test error\n    at TestFile.js:123";

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          stack: "Error: Test error\n    at TestFile.js:123",
        }),
      );

      process.env.NODE_ENV = originalEnv;
    });

    it("should not include stack trace in production mode", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const exception = new Error("Test error");
      exception.stack = "Error: Test error\n    at TestFile.js:123";

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.not.objectContaining({
          stack: expect.any(String),
        }),
      );

      process.env.NODE_ENV = originalEnv;
    });

    it("should handle non-Error exceptions", () => {
      const exception = "String error";

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: "An unexpected error occurred",
        }),
      );
    });
  });

  describe("GraphQL Exceptions", () => {
    beforeEach(() => {
      mockArgumentsHost.getType = jest.fn().mockReturnValue("graphql");
    });

    it("should handle GraphQL exceptions", () => {
      const exception = new HttpException(
        "GraphQL error",
        HttpStatus.BAD_REQUEST,
      );

      expect(() => filter.catch(exception, mockArgumentsHost)).toThrow(
        GraphQLError,
      );

      try {
        filter.catch(exception, mockArgumentsHost);
      } catch (error) {
        expect(error).toBeInstanceOf(GraphQLError);
        expect((error as GraphQLError).message).toBe("GraphQL error");
        expect((error as GraphQLError).extensions).toEqual(
          expect.objectContaining({
            code: "HttpException",
            statusCode: HttpStatus.BAD_REQUEST,
            timestamp: expect.any(String),
            requestId: "req-123",
          }),
        );
      }
    });

    it("should handle generic errors in GraphQL context", () => {
      const exception = new Error("GraphQL generic error");

      expect(() => filter.catch(exception, mockArgumentsHost)).toThrow(
        GraphQLError,
      );

      try {
        filter.catch(exception, mockArgumentsHost);
      } catch (error) {
        expect(error).toBeInstanceOf(GraphQLError);
        expect((error as GraphQLError).message).toBe("GraphQL generic error");
        expect((error as GraphQLError).extensions?.statusCode).toBe(
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    });
  });

  describe("Logging", () => {
    let loggerErrorSpy: jest.SpyInstance;
    let loggerWarnSpy: jest.SpyInstance;

    beforeEach(() => {
      loggerErrorSpy = jest
        .spyOn(filter["logger"], "error")
        .mockImplementation();
      loggerWarnSpy = jest.spyOn(filter["logger"], "warn").mockImplementation();
    });

    it("should log server errors", () => {
      const exception = new HttpException(
        "Server error",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

      filter.catch(exception, mockArgumentsHost);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        "Unhandled exception: Server error",
        expect.any(String),
        expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          path: "/api/test",
          requestId: "req-123",
          userId: "user-123",
          method: "GET",
          ip: "127.0.0.1",
          userAgent: "Mozilla/5.0",
        }),
      );
    });

    it("should log client errors as warnings", () => {
      const exception = new HttpException(
        "Client error",
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockArgumentsHost);

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        "Client error: Client error",
        expect.objectContaining({
          statusCode: HttpStatus.BAD_REQUEST,
          path: "/api/test",
          requestId: "req-123",
          userId: "user-123",
          method: "GET",
          ip: "127.0.0.1",
          userAgent: "Mozilla/5.0",
        }),
      );
    });

    it("should log errors with stack trace for Error instances", () => {
      const exception = new Error("Error with stack");
      exception.stack = "Error: Error with stack\n    at TestFile.js:123";

      filter.catch(exception, mockArgumentsHost);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        "Unhandled exception: Error with stack",
        "Error: Error with stack\n    at TestFile.js:123",
        expect.any(Object),
      );
    });
  });
});
