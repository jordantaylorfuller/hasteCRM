import { HttpStatus } from '@nestjs/common';
import {
  BusinessException,
  BusinessExceptions,
  BusinessErrorCode,
} from './business.exception';

describe('BusinessException', () => {
  describe('constructor', () => {
    it('should create a business exception with default status', () => {
      const exception = new BusinessException({
        code: BusinessErrorCode.INVALID_CREDENTIALS,
        message: 'Invalid credentials',
      });

      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(exception.getErrorCode()).toBe(BusinessErrorCode.INVALID_CREDENTIALS);
      expect(exception.getErrorDetails()).toEqual({
        code: BusinessErrorCode.INVALID_CREDENTIALS,
        message: 'Invalid credentials',
      });
    });

    it('should create a business exception with custom status', () => {
      const exception = new BusinessException(
        {
          code: BusinessErrorCode.SESSION_EXPIRED,
          message: 'Session expired',
        },
        HttpStatus.UNAUTHORIZED,
      );

      expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('should include user message and details', () => {
      const exception = new BusinessException({
        code: BusinessErrorCode.RESOURCE_NOT_FOUND,
        message: 'User not found',
        userMessage: 'The requested user could not be found.',
        details: { userId: '123' },
      });

      const response = exception.getResponse() as any;
      expect(response.userMessage).toBe('The requested user could not be found.');
      expect(response.details).toEqual({ userId: '123' });
    });

    it('should use message as userMessage if userMessage not provided', () => {
      const exception = new BusinessException({
        code: BusinessErrorCode.INVALID_INPUT,
        message: 'Invalid input provided',
      });

      const response = exception.getResponse() as any;
      expect(response.userMessage).toBe('Invalid input provided');
    });

    it('should include timestamp in response', () => {
      const exception = new BusinessException({
        code: BusinessErrorCode.SERVICE_UNAVAILABLE,
        message: 'Service unavailable',
      });

      const response = exception.getResponse() as any;
      expect(response.timestamp).toBeDefined();
      expect(new Date(response.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('BusinessExceptions factory methods', () => {
    describe('invalidCredentials', () => {
      it('should create invalid credentials exception', () => {
        const exception = BusinessExceptions.invalidCredentials();
        
        expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
        expect(exception.getErrorCode()).toBe(BusinessErrorCode.INVALID_CREDENTIALS);
        
        const response = exception.getResponse() as any;
        expect(response.message).toBe('Invalid email or password');
        expect(response.userMessage).toBe('The email or password you entered is incorrect.');
      });
    });

    describe('sessionExpired', () => {
      it('should create session expired exception', () => {
        const exception = BusinessExceptions.sessionExpired();
        
        expect(exception.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
        expect(exception.getErrorCode()).toBe(BusinessErrorCode.SESSION_EXPIRED);
        
        const response = exception.getResponse() as any;
        expect(response.message).toBe('Session has expired');
        expect(response.userMessage).toBe('Your session has expired. Please log in again.');
      });
    });

    describe('insufficientPermissions', () => {
      it('should create insufficient permissions exception', () => {
        const exception = BusinessExceptions.insufficientPermissions();
        
        expect(exception.getStatus()).toBe(HttpStatus.FORBIDDEN);
        expect(exception.getErrorCode()).toBe(BusinessErrorCode.INSUFFICIENT_PERMISSIONS);
        
        const response = exception.getResponse() as any;
        expect(response.message).toBe('Insufficient permissions');
        expect(response.userMessage).toBe('You do not have permission to perform this action.');
      });
    });

    describe('resourceNotFound', () => {
      it('should create resource not found exception', () => {
        const exception = BusinessExceptions.resourceNotFound('User', '123');
        
        expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
        expect(exception.getErrorCode()).toBe(BusinessErrorCode.RESOURCE_NOT_FOUND);
        
        const response = exception.getResponse() as any;
        expect(response.message).toBe('User not found');
        expect(response.userMessage).toBe('The requested user could not be found.');
        expect(response.details).toEqual({ resource: 'User', id: '123' });
      });

      it('should handle resource without id', () => {
        const exception = BusinessExceptions.resourceNotFound('Configuration');
        
        const response = exception.getResponse() as any;
        expect(response.details).toEqual({ resource: 'Configuration', id: undefined });
      });
    });

    describe('duplicateResource', () => {
      it('should create duplicate resource exception', () => {
        const exception = BusinessExceptions.duplicateResource('Contact', 'email');
        
        expect(exception.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(exception.getErrorCode()).toBe(BusinessErrorCode.RESOURCE_ALREADY_EXISTS);
        
        const response = exception.getResponse() as any;
        expect(response.message).toBe('Contact already exists');
        expect(response.userMessage).toBe('A contact with this email already exists.');
        expect(response.details).toEqual({ resource: 'Contact', field: 'email' });
      });

      it('should handle duplicate without field', () => {
        const exception = BusinessExceptions.duplicateResource('Workspace');
        
        const response = exception.getResponse() as any;
        expect(response.userMessage).toBe('A workspace with this information already exists.');
      });
    });

    describe('rateLimitExceeded', () => {
      it('should create rate limit exceeded exception', () => {
        const exception = BusinessExceptions.rateLimitExceeded(100, '5 minutes');
        
        expect(exception.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(exception.getErrorCode()).toBe(BusinessErrorCode.RATE_LIMIT_EXCEEDED);
        
        const response = exception.getResponse() as any;
        expect(response.message).toBe('Rate limit exceeded');
        expect(response.userMessage).toBe("You've made too many requests. Please wait 5 minutes before trying again.");
        expect(response.details).toEqual({ limit: 100, window: '5 minutes' });
      });
    });

    describe('serviceUnavailable', () => {
      it('should create service unavailable exception', () => {
        const exception = BusinessExceptions.serviceUnavailable('Email');
        
        expect(exception.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        expect(exception.getErrorCode()).toBe(BusinessErrorCode.SERVICE_UNAVAILABLE);
        
        const response = exception.getResponse() as any;
        expect(response.message).toBe('Email service is unavailable');
        expect(response.userMessage).toBe('The service is temporarily unavailable. Please try again later.');
        expect(response.details).toEqual({ service: 'Email' });
      });
    });
  });

  describe('BusinessErrorCode enum', () => {
    it('should have all expected error codes', () => {
      expect(BusinessErrorCode.INVALID_CREDENTIALS).toBe('INVALID_CREDENTIALS');
      expect(BusinessErrorCode.WORKSPACE_NOT_FOUND).toBe('WORKSPACE_NOT_FOUND');
      expect(BusinessErrorCode.CONTACT_NOT_FOUND).toBe('CONTACT_NOT_FOUND');
      expect(BusinessErrorCode.PIPELINE_NOT_FOUND).toBe('PIPELINE_NOT_FOUND');
      expect(BusinessErrorCode.GMAIL_NOT_CONNECTED).toBe('GMAIL_NOT_CONNECTED');
      expect(BusinessErrorCode.AI_SERVICE_UNAVAILABLE).toBe('AI_SERVICE_UNAVAILABLE');
    });
  });
});