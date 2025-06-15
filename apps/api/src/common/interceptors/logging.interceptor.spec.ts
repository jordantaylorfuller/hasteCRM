import { CallHandler, ExecutionContext } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { of, throwError, Observable } from "rxjs";
import { LoggingInterceptor } from "./logging.interceptor";
import { GqlExecutionContext } from "@nestjs/graphql";

describe("LoggingInterceptor", () => {
  let interceptor: LoggingInterceptor;
  let mockCallHandler: CallHandler;
  let mockExecutionContext: ExecutionContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LoggingInterceptor],
    }).compile();

    interceptor = module.get<LoggingInterceptor>(LoggingInterceptor);
    mockCallHandler = {
      handle: jest.fn().mockReturnValue(of({})),
    };
  });

  describe("HTTP Requests", () => {
    beforeEach(() => {
      mockExecutionContext = {
        getType: jest.fn().mockReturnValue("http"),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            method: "GET",
            url: "/api/test",
            ip: "127.0.0.1",
            get: jest.fn().mockReturnValue("Mozilla/5.0"),
          }),
          getResponse: jest.fn().mockReturnValue({
            statusCode: 200,
          }),
        }),
        getClass: jest.fn(),
        getHandler: jest.fn(),
        getArgs: jest.fn(),
        getArgByIndex: jest.fn(),
        switchToRpc: jest.fn(),
        switchToWs: jest.fn(),
      };
    });

    it("should log successful HTTP requests", (done) => {
      const logSpy = jest
        .spyOn(interceptor["logger"], "log")
        .mockImplementation();

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining("GET /api/test 200"),
          );
          expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining("Mozilla/5.0"),
          );
          expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining("127.0.0.1"),
          );
          done();
        },
      });
    });

    it("should log failed HTTP requests", (done) => {
      const error = { status: 500, message: "Internal Server Error" };
      mockCallHandler.handle = jest
        .fn()
        .mockReturnValue(throwError(() => error));

      const errorSpy = jest
        .spyOn(interceptor["logger"], "error")
        .mockImplementation();

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: () => {
          expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining("GET /api/test 500"),
          );
          done();
        },
      });
    });

    it("should handle requests without user agent", (done) => {
      const request = mockExecutionContext.switchToHttp().getRequest();
      request.get = jest.fn().mockReturnValue(undefined);

      const logSpy = jest
        .spyOn(interceptor["logger"], "log")
        .mockImplementation();

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining("GET /api/test 200"),
          );
          done();
        },
      });
    });
  });

  describe("GraphQL Requests", () => {
    beforeEach(() => {
      mockExecutionContext = {
        getType: jest.fn().mockReturnValue("graphql"),
        switchToHttp: jest.fn(),
        getClass: jest.fn(),
        getHandler: jest.fn(),
        getArgs: jest.fn(),
        getArgByIndex: jest.fn(),
        switchToRpc: jest.fn(),
        switchToWs: jest.fn(),
      };

      (GqlExecutionContext.create as jest.Mock) = jest.fn().mockReturnValue({
        getInfo: jest.fn().mockReturnValue({
          parentType: { name: "Query" },
          fieldName: "users",
        }),
        getContext: jest.fn().mockReturnValue({
          req: {
            ip: "192.168.1.1",
            get: jest.fn().mockReturnValue("GraphQL Client"),
          },
        }),
      });
    });

    it("should log successful GraphQL queries", (done) => {
      const logSpy = jest
        .spyOn(interceptor["logger"], "log")
        .mockImplementation();

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining("GraphQL Query.users 200"),
          );
          expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining("GraphQL Client"),
          );
          expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining("192.168.1.1"),
          );
          done();
        },
      });
    });

    it("should log failed GraphQL queries", (done) => {
      const error = { status: 400, message: "Bad Request" };
      mockCallHandler.handle = jest
        .fn()
        .mockReturnValue(throwError(() => error));

      const errorSpy = jest
        .spyOn(interceptor["logger"], "error")
        .mockImplementation();

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: () => {
          expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining("GraphQL Query.users 400"),
          );
          done();
        },
      });
    });

    it("should handle GraphQL requests without IP", (done) => {
      (GqlExecutionContext.create as jest.Mock) = jest.fn().mockReturnValue({
        getInfo: jest.fn().mockReturnValue({
          parentType: { name: "Mutation" },
          fieldName: "createUser",
        }),
        getContext: jest.fn().mockReturnValue({
          req: undefined,
        }),
      });

      const logSpy = jest
        .spyOn(interceptor["logger"], "log")
        .mockImplementation();

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining("unknown"),
          );
          done();
        },
      });
    });

    it("should handle errors without status code", (done) => {
      const error = { message: "Unknown error" };
      mockCallHandler.handle = jest
        .fn()
        .mockReturnValue(throwError(() => error));

      const errorSpy = jest
        .spyOn(interceptor["logger"], "error")
        .mockImplementation();

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: () => {
          expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("500"));
          done();
        },
      });
    });
  });

  describe("Duration Tracking", () => {
    it("should track request duration", (done) => {
      const delay = 100;

      // Create a delayed observable
      const delayedObservable = new Observable((subscriber) => {
        setTimeout(() => {
          subscriber.next({});
          subscriber.complete();
        }, delay);
      });

      mockCallHandler.handle = jest.fn().mockReturnValue(delayedObservable);

      const logSpy = jest
        .spyOn(interceptor["logger"], "log")
        .mockImplementation();

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: () => {
          const logCall = logSpy.mock.calls[0][0];
          const durationMatch = logCall.match(/(\d+)ms/);
          expect(durationMatch).toBeTruthy();

          const duration = parseInt(durationMatch[1], 10);
          expect(duration).toBeGreaterThanOrEqual(delay - 10);
          expect(duration).toBeLessThanOrEqual(delay + 50);
          done();
        },
      });
    });
  });
});
