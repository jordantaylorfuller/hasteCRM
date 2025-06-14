import { Test } from '@nestjs/testing';
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';
import { GqlArgumentsHost } from '@nestjs/graphql';

jest.mock('@nestjs/graphql', () => ({
  ...jest.requireActual('@nestjs/graphql'),
  GqlArgumentsHost: {
    create: jest.fn(),
  },
}));

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockArgumentsHost: ArgumentsHost;
  let mockHttpArgumentsHost: any;
  let mockGqlArgumentsHost: any;
  let mockResponse: any;
  let mockRequest: any;
  let mockContext: any;
  let loggerWarnSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [HttpExceptionFilter],
    }).compile();

    filter = module.get<HttpExceptionFilter>(HttpExceptionFilter);

    // Mock HTTP context
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockRequest = {
      url: '/api/users',
      method: 'POST',
      id: 'req-456',
    };

    mockHttpArgumentsHost = {
      getResponse: jest.fn().mockReturnValue(mockResponse),
      getRequest: jest.fn().mockReturnValue(mockRequest),
    };

    // Mock GraphQL context
    mockContext = {
      req: {
        id: 'gql-req-789',
      },
    };

    mockGqlArgumentsHost = {
      getContext: jest.fn().mockReturnValue(mockContext),
      getInfo: jest.fn().mockReturnValue({
        path: { key: 'getUser' },
      }),
    };

    // Mock ArgumentsHost
    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue(mockHttpArgumentsHost),
      getType: jest.fn().mockReturnValue('http'),
    } as any;

    // Mock GqlArgumentsHost.create
    (GqlArgumentsHost.create as jest.Mock).mockReturnValue(mockGqlArgumentsHost);

    // Spy on logger
    loggerWarnSpy = jest.spyOn(filter['logger'], 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('HTTP Context', () => {
    it('should handle HttpException with string message', () => {
      const exception = new HttpException('User not found', HttpStatus.NOT_FOUND);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.NOT_FOUND,
        timestamp: expect.any(String),
        path: '/api/users',
        method: 'POST',
        message: 'User not found',
        error: 'HttpException',
        requestId: 'req-456',
      });
    });

    it('should handle HttpException with object response', () => {
      const customResponse = {
        message: 'Validation failed',
        error: 'Bad Request',
        details: ['Email is required', 'Password is too short'],
      };
      const exception = new HttpException(customResponse, HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.BAD_REQUEST,
        timestamp: expect.any(String),
        path: '/api/users',
        method: 'POST',
        message: 'Validation failed',
        error: 'Bad Request',
        requestId: 'req-456',
      });
    });

    it('should handle HttpException with array message', () => {
      const customResponse = {
        message: ['Email is invalid', 'Password is required'],
        error: 'Validation Error',
      };
      const exception = new HttpException(customResponse, HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: HttpStatus.BAD_REQUEST,
        timestamp: expect.any(String),
        path: '/api/users',
        method: 'POST',
        message: ['Email is invalid', 'Password is required'],
        error: 'Validation Error',
        requestId: 'req-456',
      });
    });

    it('should fall back to exception message if response has no message', () => {
      const customResponse = { error: 'CustomError' };
      const exception = new HttpException(customResponse, HttpStatus.FORBIDDEN);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Http Exception',
          error: 'CustomError',
        }),
      );
    });

    it('should use exception name if response is string', () => {
      const exception = new HttpException('Unauthorized access', HttpStatus.UNAUTHORIZED);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Unauthorized access',
          error: 'HttpException',
        }),
      );
    });

    it('should log HTTP exceptions', () => {
      const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);

      filter.catch(exception, mockArgumentsHost);

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('HTTP Exception:'),
      );
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('"statusCode":400'),
      );
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Test error"'),
      );
    });

    it('should handle missing request ID gracefully', () => {
      mockRequest.id = undefined;
      const exception = new HttpException('Error', HttpStatus.INTERNAL_SERVER_ERROR);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: undefined,
        }),
      );
    });
  });

  describe('GraphQL Context', () => {
    beforeEach(() => {
      mockArgumentsHost.getType = jest.fn().mockReturnValue('graphql');
    });

    it('should handle GraphQL HttpException', () => {
      const exception = new HttpException('GraphQL error', HttpStatus.BAD_REQUEST);

      expect(() => filter.catch(exception, mockArgumentsHost)).toThrow(exception);
    });

    it('should log GraphQL exceptions', () => {
      const exception = new HttpException('GraphQL test error', HttpStatus.FORBIDDEN);

      try {
        filter.catch(exception, mockArgumentsHost);
      } catch (e) {
        // Expected to throw
      }

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('GraphQL Exception:'),
      );
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('"statusCode":403'),
      );
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('"message":"GraphQL test error"'),
      );
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('"path":"getUser"'),
      );
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('"requestId":"gql-req-789"'),
      );
    });

    it('should handle GraphQL context without request ID', () => {
      mockContext.req = undefined;
      const exception = new HttpException('No request context', HttpStatus.NOT_FOUND);

      try {
        filter.catch(exception, mockArgumentsHost);
      } catch (e) {
        // Expected to throw
      }

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('GraphQL Exception:'),
      );
    });

    it('should handle GraphQL exception with custom response', () => {
      const customResponse = {
        message: 'Custom GraphQL error',
        error: 'GraphQLError',
        code: 'GRAPHQL_VALIDATION_FAILED',
      };
      const exception = new HttpException(customResponse, HttpStatus.BAD_REQUEST);

      try {
        filter.catch(exception, mockArgumentsHost);
      } catch (e) {
        expect(e).toBe(exception);
      }

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Custom GraphQL error"'),
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle exception with no message', () => {
      const exception = new HttpException({}, HttpStatus.INTERNAL_SERVER_ERROR);

      filter.catch(exception, mockArgumentsHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Http Exception',
        }),
      );
    });

    it('should handle different HTTP methods', () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      
      methods.forEach((method) => {
        mockRequest.method = method;
        const exception = new HttpException('Method test', HttpStatus.OK);

        filter.catch(exception, mockArgumentsHost);

        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            method,
          }),
        );
      });
    });

    it('should generate ISO timestamp', () => {
      const exception = new HttpException('Time test', HttpStatus.OK);
      const beforeTime = new Date().toISOString();

      filter.catch(exception, mockArgumentsHost);

      const afterTime = new Date().toISOString();
      const response = mockResponse.json.mock.calls[0][0];
      
      expect(new Date(response.timestamp).getTime()).toBeGreaterThanOrEqual(new Date(beforeTime).getTime());
      expect(new Date(response.timestamp).getTime()).toBeLessThanOrEqual(new Date(afterTime).getTime());
    });
  });
});