import { Test } from "@nestjs/testing";
import { ArgumentsHost, BadRequestException } from "@nestjs/common";
import { ValidationExceptionFilter } from "./validation-exception.filter";
import { ValidationError } from "class-validator";
import { GqlArgumentsHost } from "@nestjs/graphql";

jest.mock("@nestjs/graphql", () => ({
  ...jest.requireActual("@nestjs/graphql"),
  GqlArgumentsHost: {
    create: jest.fn(),
  },
}));

describe("ValidationExceptionFilter", () => {
  let filter: ValidationExceptionFilter;
  let mockArgumentsHost: ArgumentsHost;
  let mockHttpArgumentsHost: any;
  let mockGqlArgumentsHost: any;
  let mockResponse: any;
  let mockRequest: any;
  let mockContext: any;
  let loggerWarnSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ValidationExceptionFilter],
    }).compile();

    filter = module.get<ValidationExceptionFilter>(ValidationExceptionFilter);

    // Mock HTTP context
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockRequest = {
      url: "/api/contacts",
      method: "POST",
      id: "req-validation-123",
    };

    mockHttpArgumentsHost = {
      getResponse: jest.fn().mockReturnValue(mockResponse),
      getRequest: jest.fn().mockReturnValue(mockRequest),
    };

    // Mock GraphQL context
    mockContext = {
      req: {
        id: "gql-validation-456",
      },
    };

    mockGqlArgumentsHost = {
      getContext: jest.fn().mockReturnValue(mockContext),
      getInfo: jest.fn().mockReturnValue({
        path: { key: "createContact" },
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

    // Spy on logger
    loggerWarnSpy = jest.spyOn(filter["logger"], "warn").mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("HTTP Context", () => {
    it("should handle validation errors with string messages", () => {
      const exception = new BadRequestException({
        message: ["Email is required", "Name must be at least 2 characters"],
      });

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 400,
        error: "Validation Failed",
        message: "The request contains invalid data",
        timestamp: expect.any(String),
        path: "/api/contacts",
        method: "POST",
        requestId: "req-validation-123",
        errors: {
          general: ["Email is required", "Name must be at least 2 characters"],
        },
      });
    });

    it("should handle ValidationError objects from class-validator", () => {
      const validationError1 = new ValidationError();
      validationError1.property = "email";
      validationError1.constraints = {
        isEmail: "email must be an email",
        isNotEmpty: "email should not be empty",
      };

      const validationError2 = new ValidationError();
      validationError2.property = "password";
      validationError2.constraints = {
        minLength: "password must be longer than or equal to 8 characters",
      };

      const exception = new BadRequestException({
        message: [validationError1, validationError2],
      });

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 400,
        error: "Validation Failed",
        message: "The request contains invalid data",
        timestamp: expect.any(String),
        path: "/api/contacts",
        method: "POST",
        requestId: "req-validation-123",
        errors: {
          email: ["email must be an email", "email should not be empty"],
          password: ["password must be longer than or equal to 8 characters"],
        },
      });
    });

    it("should handle mixed validation errors", () => {
      const validationError = new ValidationError();
      validationError.property = "age";
      validationError.constraints = {
        min: "age must not be less than 0",
      };

      const exception = new BadRequestException({
        message: ["General validation error", validationError],
      });

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: {
            general: ["General validation error"],
            age: ["age must not be less than 0"],
          },
        }),
      );
    });

    it("should pass through non-validation BadRequestExceptions", () => {
      const exception = new BadRequestException("Simple bad request");

      expect(() => filter.catch(exception, mockArgumentsHost)).toThrow(
        exception,
      );
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should pass through BadRequestExceptions with non-array messages", () => {
      const exception = new BadRequestException({
        message: "Not an array message",
        error: "BadRequest",
      });

      expect(() => filter.catch(exception, mockArgumentsHost)).toThrow(
        exception,
      );
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it("should log validation errors", () => {
      const exception = new BadRequestException({
        message: ["Test validation error"],
      });

      filter.catch(exception, mockArgumentsHost);

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Validation Error:"),
      );
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('"error":"Validation Failed"'),
      );
    });

    it("should handle empty validation errors array", () => {
      const exception = new BadRequestException({
        message: [],
      });

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: {},
        }),
      );
    });
  });

  describe("GraphQL Context", () => {
    beforeEach(() => {
      mockArgumentsHost.getType = jest.fn().mockReturnValue("graphql");
    });

    it("should handle GraphQL validation errors", () => {
      const exception = new BadRequestException({
        message: ["Email is invalid", "Name is required"],
      });

      expect(() => filter.catch(exception, mockArgumentsHost)).toThrow(
        BadRequestException,
      );

      try {
        filter.catch(exception, mockArgumentsHost);
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = (error as BadRequestException).getResponse() as any;
        expect(response.message).toBe("Validation failed");
        expect(response.errors).toEqual({
          general: ["Email is invalid", "Name is required"],
        });
      }
    });

    it("should handle GraphQL ValidationError objects", () => {
      const validationError = new ValidationError();
      validationError.property = "username";
      validationError.constraints = {
        length: "username must be between 3 and 20 characters",
        isAlphanumeric: "username must contain only letters and numbers",
      };

      const exception = new BadRequestException({
        message: [validationError],
      });

      try {
        filter.catch(exception, mockArgumentsHost);
      } catch (error) {
        const response = (error as BadRequestException).getResponse() as any;
        expect(response.errors).toEqual({
          username: [
            "username must be between 3 and 20 characters",
            "username must contain only letters and numbers",
          ],
        });
      }
    });

    it("should log GraphQL validation errors", () => {
      const exception = new BadRequestException({
        message: ["GraphQL validation test"],
      });

      try {
        filter.catch(exception, mockArgumentsHost);
      } catch (e) {
        // Expected to throw
      }

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("GraphQL Validation Error:"),
      );
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('"path":"createContact"'),
      );
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('"requestId":"gql-validation-456"'),
      );
    });

    it("should handle GraphQL context without request", () => {
      mockContext.req = undefined;
      const exception = new BadRequestException({
        message: ["No request context"],
      });

      try {
        filter.catch(exception, mockArgumentsHost);
      } catch (e) {
        // Expected to throw
      }

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("GraphQL Validation Error:"),
      );
      const logCall = loggerWarnSpy.mock.calls[0][0];
      expect(logCall).not.toContain('"requestId"');
    });
  });

  describe("Error Formatting", () => {
    it("should format nested ValidationError objects", () => {
      const parentError = new ValidationError();
      parentError.property = "address";

      const childError = new ValidationError();
      childError.property = "zipCode";
      childError.constraints = {
        matches: "zipCode must match the pattern",
      };

      parentError.children = [childError];
      parentError.constraints = {
        isDefined: "address should not be null or undefined",
      };

      const exception = new BadRequestException({
        message: [parentError],
      });

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: {
            address: ["address should not be null or undefined"],
          },
        }),
      );
    });

    it("should handle ValidationError without constraints", () => {
      const validationError = new ValidationError();
      validationError.property = "field";
      // No constraints set

      const exception = new BadRequestException({
        message: [validationError, "Other error"],
      });

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: {
            general: ["Other error"],
          },
        }),
      );
    });

    it("should handle multiple errors for the same field", () => {
      const error1 = new ValidationError();
      error1.property = "email";
      error1.constraints = {
        isEmail: "Invalid email format",
      };

      const error2 = new ValidationError();
      error2.property = "email";
      error2.constraints = {
        isNotEmpty: "Email is required",
      };

      const exception = new BadRequestException({
        message: [error1, error2],
      });

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: {
            email: ["Invalid email format", "Email is required"],
          },
        }),
      );
    });
  });

  describe("Request Context", () => {
    it("should include all request details in error response", () => {
      mockRequest.url = "/api/users/123/update";
      mockRequest.method = "PATCH";
      mockRequest.id = "unique-request-id";

      const exception = new BadRequestException({
        message: ["Validation error"],
      });

      filter.catch(exception, mockArgumentsHost);

      const response = mockResponse.json.mock.calls[0][0];
      expect(response.path).toBe("/api/users/123/update");
      expect(response.method).toBe("PATCH");
      expect(response.requestId).toBe("unique-request-id");
    });

    it("should handle missing request ID", () => {
      mockRequest.id = undefined;

      const exception = new BadRequestException({
        message: ["Error without request ID"],
      });

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: undefined,
        }),
      );
    });
  });
});
