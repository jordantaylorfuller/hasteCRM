import { Test } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { ErrorLoggingInterceptor } from './error-logging.interceptor';
import { GqlExecutionContext } from '@nestjs/graphql';

jest.mock('@nestjs/graphql', () => ({
  ...jest.requireActual('@nestjs/graphql'),
  GqlExecutionContext: {
    create: jest.fn(),
  },
}));

describe('ErrorLoggingInterceptor', () => {
  let interceptor: ErrorLoggingInterceptor;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ErrorLoggingInterceptor],
    }).compile();

    interceptor = module.get<ErrorLoggingInterceptor>(ErrorLoggingInterceptor);
    
    // Spy on logger
    loggerErrorSpy = jest.spyOn(interceptor['logger'], 'error').mockImplementation();

    // Mock CallHandler
    mockCallHandler = {
      handle: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('HTTP Context', () => {
    beforeEach(() => {
      const mockRequest = {
        method: 'POST',
        url: '/api/users',
        params: { id: '123' },
        query: { page: '1', limit: '10' },
        body: {
          email: 'test@example.com',
          password: 'secret123',
          name: 'Test User',
        },
        user: { id: 'user-456' },
        ip: '192.168.1.1',
        get: jest.fn((header) => {
          if (header === 'user-agent') return 'Mozilla/5.0';
          return undefined;
        }),
        id: 'req-789',
      };

      mockExecutionContext = {
        getType: jest.fn().mockReturnValue('http'),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as any;
    });

    it('should log HTTP errors with context', async () => {
      const error = new Error('HTTP request failed');
      error.stack = 'Error: HTTP request failed\n    at test.js:10';
      
      mockCallHandler.handle = jest.fn().mockReturnValue(throwError(() => error));

      const observable = interceptor.intercept(mockExecutionContext, mockCallHandler);

      await expect(observable.toPromise()).rejects.toThrow(error);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Error occurred after \d+ms/),
        expect.objectContaining({
          type: 'http',
          method: 'POST',
          url: '/api/users',
          params: { id: '123' },
          query: { page: '1', limit: '10' },
          body: { email: 'test@example.com', name: 'Test User' }, // password sanitized
          userId: 'user-456',
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          requestId: 'req-789',
          error: 'HTTP request failed',
          stack: expect.stringContaining('Error: HTTP request failed'),
          duration: expect.any(Number),
        }),
      );
    });

    it('should sanitize sensitive fields from body', async () => {
      const request = mockExecutionContext.switchToHttp().getRequest();
      request.body = {
        email: 'test@example.com',
        password: 'secret',
        refreshToken: 'refresh-token',
        accessToken: 'access-token',
        totpSecret: 'totp-secret',
        creditCard: '4111111111111111',
        name: 'Test User',
      };

      const error = new Error('Validation failed');
      mockCallHandler.handle = jest.fn().mockReturnValue(throwError(() => error));

      const observable = interceptor.intercept(mockExecutionContext, mockCallHandler);
      await expect(observable.toPromise()).rejects.toThrow();

      const loggedContext = loggerErrorSpy.mock.calls[0][1];
      expect(loggedContext.body).toEqual({
        email: 'test@example.com',
        name: 'Test User',
      });
      expect(loggedContext.body.password).toBeUndefined();
      expect(loggedContext.body.refreshToken).toBeUndefined();
      expect(loggedContext.body.accessToken).toBeUndefined();
      expect(loggedContext.body.totpSecret).toBeUndefined();
      expect(loggedContext.body.creditCard).toBeUndefined();
    });

    it('should handle requests without user', async () => {
      const request = mockExecutionContext.switchToHttp().getRequest();
      request.user = undefined;

      const error = new Error('Unauthorized');
      mockCallHandler.handle = jest.fn().mockReturnValue(throwError(() => error));

      const observable = interceptor.intercept(mockExecutionContext, mockCallHandler);
      await expect(observable.toPromise()).rejects.toThrow();

      const loggedContext = loggerErrorSpy.mock.calls[0][1];
      expect(loggedContext.userId).toBeUndefined();
    });

    it('should handle requests without body', async () => {
      const request = mockExecutionContext.switchToHttp().getRequest();
      request.body = undefined;

      const error = new Error('No body');
      mockCallHandler.handle = jest.fn().mockReturnValue(throwError(() => error));

      const observable = interceptor.intercept(mockExecutionContext, mockCallHandler);
      await expect(observable.toPromise()).rejects.toThrow();

      const loggedContext = loggerErrorSpy.mock.calls[0][1];
      expect(loggedContext.body).toBeUndefined();
    });
  });

  describe('GraphQL Context', () => {
    let mockGqlExecContext: any;

    beforeEach(() => {
      const mockGqlContext = {
        req: {
          user: { id: 'gql-user-123' },
          id: 'gql-req-456',
        },
      };

      const mockInfo = {
        fieldName: 'createUser',
        parentType: { name: 'Mutation' },
      };

      const mockArgs = {
        input: {
          email: 'test@example.com',
          password: 'secret',
          refreshToken: 'token',
        },
      };

      mockExecutionContext = {
        getType: jest.fn().mockReturnValue('graphql'),
      } as any;

      // Mock GqlExecutionContext
      mockGqlExecContext = {
        getInfo: jest.fn().mockReturnValue(mockInfo),
        getArgs: jest.fn().mockReturnValue(mockArgs),
        getContext: jest.fn().mockReturnValue(mockGqlContext),
      };
      
      (GqlExecutionContext.create as jest.Mock).mockReturnValue(mockGqlExecContext);
    });

    it('should log GraphQL errors with context', async () => {
      const error = new Error('GraphQL mutation failed');
      mockCallHandler.handle = jest.fn().mockReturnValue(throwError(() => error));

      const observable = interceptor.intercept(mockExecutionContext, mockCallHandler);
      await expect(observable.toPromise()).rejects.toThrow(error);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Error occurred after \d+ms/),
        expect.objectContaining({
          type: 'graphql',
          fieldName: 'createUser',
          parentType: 'Mutation',
          args: {
            input: { email: 'test@example.com' }, // password and refreshToken sanitized
          },
          userId: 'gql-user-123',
          requestId: 'gql-req-456',
          error: 'GraphQL mutation failed',
          duration: expect.any(Number),
        }),
      );
    });

    it('should sanitize sensitive fields from GraphQL args', async () => {
      mockGqlExecContext.getArgs.mockReturnValue({
        input: {
          email: 'test@example.com',
          password: 'secret',
          accessToken: 'token',
          totpSecret: 'totp',
        },
        where: { id: '123' },
      });

      const error = new Error('Failed');
      mockCallHandler.handle = jest.fn().mockReturnValue(throwError(() => error));

      const observable = interceptor.intercept(mockExecutionContext, mockCallHandler);
      await expect(observable.toPromise()).rejects.toThrow();

      const loggedContext = loggerErrorSpy.mock.calls[0][1];
      expect(loggedContext.args).toEqual({
        input: { email: 'test@example.com' },
        where: { id: '123' },
      });
    });

    it('should handle GraphQL context without user', async () => {
      mockGqlExecContext.getContext.mockReturnValue({
        req: { id: 'req-no-user' },
      });

      const error = new Error('No user');
      mockCallHandler.handle = jest.fn().mockReturnValue(throwError(() => error));

      const observable = interceptor.intercept(mockExecutionContext, mockCallHandler);
      await expect(observable.toPromise()).rejects.toThrow();

      const loggedContext = loggerErrorSpy.mock.calls[0][1];
      expect(loggedContext.userId).toBeUndefined();
    });
  });

  describe('Unknown Context Type', () => {
    it('should handle unknown context types', async () => {
      mockExecutionContext = {
        getType: jest.fn().mockReturnValue('websocket'),
      } as any;

      const error = new Error('WebSocket error');
      mockCallHandler.handle = jest.fn().mockReturnValue(throwError(() => error));

      const observable = interceptor.intercept(mockExecutionContext, mockCallHandler);
      await expect(observable.toPromise()).rejects.toThrow();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          type: 'websocket',
          error: 'WebSocket error',
        }),
      );
    });
  });

  describe('Error Propagation', () => {
    it('should propagate the original error', async () => {
      mockExecutionContext = {
        getType: jest.fn().mockReturnValue('http'),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            method: 'GET',
            url: '/test',
            get: jest.fn(),
          }),
        }),
      } as any;

      const originalError = new Error('Original error');
      mockCallHandler.handle = jest.fn().mockReturnValue(throwError(() => originalError));

      const observable = interceptor.intercept(mockExecutionContext, mockCallHandler);
      
      await expect(observable.toPromise()).rejects.toThrow('Original error');
    });

    it('should not interfere with successful requests', async () => {
      mockExecutionContext = {
        getType: jest.fn().mockReturnValue('http'),
      } as any;

      const successData = { result: 'success' };
      mockCallHandler.handle = jest.fn().mockReturnValue(of(successData));

      const observable = interceptor.intercept(mockExecutionContext, mockCallHandler);
      const result = await observable.toPromise();

      expect(result).toEqual(successData);
      expect(loggerErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('Performance Tracking', () => {
    it('should measure error duration accurately', async () => {
      mockExecutionContext = {
        getType: jest.fn().mockReturnValue('http'),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({ 
            method: 'GET', 
            url: '/test',
            get: jest.fn(),
          }),
        }),
      } as any;

      const error = new Error('Test error');
      mockCallHandler.handle = jest.fn().mockReturnValue(throwError(() => error));

      const observable = interceptor.intercept(mockExecutionContext, mockCallHandler);
      
      await expect(observable.toPromise()).rejects.toThrow();
      
      const loggedContext = loggerErrorSpy.mock.calls[0][1];
      expect(loggedContext.duration).toBeDefined();
      expect(typeof loggedContext.duration).toBe('number');
      expect(loggedContext.duration).toBeGreaterThanOrEqual(0);
    });
  });
});