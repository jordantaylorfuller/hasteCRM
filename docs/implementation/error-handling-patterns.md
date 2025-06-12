# Error Handling Patterns Guide

## Table of Contents
1. [Overview](#overview)
2. [Error Types and Hierarchy](#error-types-and-hierarchy)
3. [Global Error Handler](#global-error-handler)
4. [Service Layer Error Handling](#service-layer-error-handling)
5. [Database Error Handling](#database-error-handling)
6. [API Error Responses](#api-error-responses)
7. [Async Error Handling](#async-error-handling)
8. [Circuit Breaker Pattern](#circuit-breaker-pattern)
9. [Retry Strategies](#retry-strategies)
10. [Error Monitoring and Logging](#error-monitoring-and-logging)
11. [Testing Error Scenarios](#testing-error-scenarios)

## Overview

This guide provides comprehensive error handling patterns for hasteCRM, ensuring robust error recovery and graceful degradation.

## Error Types and Hierarchy

### Base Error Classes

```typescript
// packages/common/src/errors/base.errors.ts
export abstract class BaseError extends Error {
  public readonly id: string;
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;

  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly isOperational: boolean = true,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.id = this.generateErrorId();
    this.timestamp = new Date();
    this.context = context;
    Error.captureStackTrace(this, this.constructor);
  }

  private generateErrorId(): string {
    return `${this.code}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  toJSON() {
    return {
      id: this.id,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      context: this.context,
      stack: this.stack,
    };
  }
}

// Operational errors - expected errors that we can handle gracefully
export class OperationalError extends BaseError {
  constructor(
    code: string,
    message: string,
    statusCode: number = 500,
    context?: Record<string, any>
  ) {
    super(code, message, statusCode, true, context);
  }
}

// Programming errors - bugs that should crash the process
export class ProgrammingError extends BaseError {
  constructor(
    code: string,
    message: string,
    context?: Record<string, any>
  ) {
    super(code, message, 500, false, context);
  }
}
```

### Specific Error Types

```typescript
// packages/common/src/errors/app.errors.ts
export class ValidationError extends OperationalError {
  constructor(message: string, public readonly errors: any[] = []) {
    super('VALIDATION_ERROR', message, 400, { errors });
  }
}

export class AuthenticationError extends OperationalError {
  constructor(message: string = 'Authentication failed') {
    super('AUTHENTICATION_ERROR', message, 401);
  }
}

export class AuthorizationError extends OperationalError {
  constructor(message: string = 'Access denied') {
    super('AUTHORIZATION_ERROR', message, 403);
  }
}

export class NotFoundError extends OperationalError {
  constructor(resource: string, id?: string) {
    const message = id 
      ? `${resource} with id ${id} not found`
      : `${resource} not found`;
    super('NOT_FOUND', message, 404, { resource, id });
  }
}

export class ConflictError extends OperationalError {
  constructor(message: string, conflictingField?: string) {
    super('CONFLICT', message, 409, { conflictingField });
  }
}

export class RateLimitError extends OperationalError {
  constructor(
    public readonly retryAfter: number,
    public readonly limit: number,
    public readonly remaining: number
  ) {
    super(
      'RATE_LIMIT_EXCEEDED',
      'Too many requests',
      429,
      { retryAfter, limit, remaining }
    );
  }
}

export class ExternalServiceError extends OperationalError {
  constructor(
    service: string,
    originalError: Error,
    public readonly isRetryable: boolean = true
  ) {
    super(
      'EXTERNAL_SERVICE_ERROR',
      `External service error: ${service}`,
      503,
      { service, originalError: originalError.message, isRetryable }
    );
  }
}

export class DatabaseError extends OperationalError {
  constructor(
    operation: string,
    originalError: Error,
    public readonly isRetryable: boolean = false
  ) {
    super(
      'DATABASE_ERROR',
      `Database error during ${operation}`,
      500,
      { operation, originalError: originalError.message, isRetryable }
    );
  }
}

export class BusinessLogicError extends OperationalError {
  constructor(code: string, message: string, context?: Record<string, any>) {
    super(code, message, 422, context);
  }
}
```

## Global Error Handler

### Express Error Middleware

```typescript
// packages/api/src/middleware/error-handler.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { BaseError } from '@hastecrm/common';
import { Logger } from '@nestjs/common';
import { SentryService } from '../services/sentry.service';
import { MetricsService } from '../services/metrics.service';

export class GlobalErrorHandler {
  private readonly logger = new Logger(GlobalErrorHandler.name);

  constructor(
    private readonly sentryService: SentryService,
    private readonly metricsService: MetricsService
  ) {}

  handle() {
    return async (
      error: Error,
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      // Log error
      this.logger.error({
        message: error.message,
        stack: error.stack,
        request: {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: req.body,
          params: req.params,
          query: req.query,
          ip: req.ip,
          user: req.user?.id,
        },
      });

      // Track metrics
      this.metricsService.incrementErrorCounter(error);

      // Handle different error types
      if (error instanceof BaseError) {
        return this.handleOperationalError(error, req, res);
      }

      // Programming errors - report to Sentry and return generic error
      await this.handleProgrammingError(error, req, res);
    };
  }

  private handleOperationalError(
    error: BaseError,
    req: Request,
    res: Response
  ) {
    // Add request ID for tracing
    const requestId = req.headers['x-request-id'] || error.id;

    // Send structured error response
    res.status(error.statusCode).json({
      error: {
        id: error.id,
        code: error.code,
        message: error.message,
        timestamp: error.timestamp,
        path: req.url,
        requestId,
        ...(process.env.NODE_ENV === 'development' && {
          stack: error.stack,
          context: error.context,
        }),
      },
    });

    // Log operational errors at appropriate levels
    if (error.statusCode >= 500) {
      this.logger.error(error);
    } else if (error.statusCode >= 400) {
      this.logger.warn(error);
    }
  }

  private async handleProgrammingError(
    error: Error,
    req: Request,
    res: Response
  ) {
    // Report to Sentry
    const eventId = await this.sentryService.captureException(error, {
      user: req.user,
      request: req,
    });

    // Log critical error
    this.logger.error('Programming error occurred', {
      error: error.message,
      stack: error.stack,
      eventId,
    });

    // Send generic error response
    res.status(500).json({
      error: {
        id: eventId,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        timestamp: new Date(),
        path: req.url,
      },
    });

    // In production, consider graceful shutdown for programming errors
    if (process.env.NODE_ENV === 'production') {
      this.initiateGracefulShutdown(error);
    }
  }

  private initiateGracefulShutdown(error: Error) {
    this.logger.error('Initiating graceful shutdown due to programming error', error);
    
    // Give ongoing requests 30 seconds to complete
    setTimeout(() => {
      process.exit(1);
    }, 30000);

    // Stop accepting new requests
    process.emit('SIGTERM');
  }
}
```

### NestJS Exception Filter

```typescript
// packages/api/src/filters/all-exceptions.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BaseError } from '@hastecrm/common';
import { SentryService } from '../services/sentry.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly sentryService: SentryService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    let errorId: string;

    if (exception instanceof BaseError) {
      status = exception.statusCode;
      message = exception.message;
      code = exception.code;
      errorId = exception.id;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const errorResponse = exception.getResponse();
      message = errorResponse['message'] || exception.message;
      code = errorResponse['error'] || 'HTTP_EXCEPTION';
    } else if (exception instanceof Error) {
      // Unknown errors - report to Sentry
      errorId = this.sentryService.captureException(exception, {
        request,
        user: request.user,
      });
      this.logger.error(`Unhandled exception: ${exception.message}`, exception.stack);
    }

    response.status(status).json({
      error: {
        id: errorId || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        code,
        message,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
      },
    });
  }
}
```

## Service Layer Error Handling

### Service Error Wrapper

```typescript
// packages/api/src/decorators/error-handler.decorator.ts
import { BaseError } from '@hastecrm/common';
import { Logger } from '@nestjs/common';

export function HandleErrors(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  const logger = new Logger(`${target.constructor.name}.${propertyKey}`);

  descriptor.value = async function (...args: any[]) {
    try {
      return await originalMethod.apply(this, args);
    } catch (error) {
      logger.error(`Error in ${propertyKey}:`, error);

      // Re-throw operational errors
      if (error instanceof BaseError) {
        throw error;
      }

      // Wrap unknown errors
      throw new OperationalError(
        'SERVICE_ERROR',
        `Error in ${target.constructor.name}.${propertyKey}: ${error.message}`,
        500,
        { originalError: error.message }
      );
    }
  };

  return descriptor;
}
```

### Service Implementation with Error Handling

```typescript
// packages/api/src/services/contact.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { 
  NotFoundError, 
  ConflictError, 
  ValidationError,
  DatabaseError 
} from '@hastecrm/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService
  ) {}

  async create(data: CreateContactDto, userId: string) {
    try {
      // Check for duplicates
      const existing = await this.prisma.contact.findFirst({
        where: {
          email: data.email,
          workspaceId: data.workspaceId,
        },
      });

      if (existing) {
        throw new ConflictError(
          `Contact with email ${data.email} already exists`,
          'email'
        );
      }

      // Create contact with retry on transient failures
      const contact = await this.withRetry(
        async () => {
          return await this.prisma.contact.create({
            data: {
              ...data,
              createdById: userId,
            },
          });
        },
        3,
        [Prisma.PrismaClientKnownRequestError]
      );

      // Invalidate cache
      await this.cache.delete(`contacts:${data.workspaceId}:*`);

      return contact;
    } catch (error) {
      if (error instanceof BaseError) {
        throw error;
      }

      // Handle Prisma errors
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw this.handlePrismaError(error, 'create');
      }

      throw new DatabaseError('create', error);
    }
  }

  async findById(id: string, workspaceId: string) {
    const cacheKey = `contact:${id}`;
    
    try {
      // Try cache first
      const cached = await this.cache.get(cacheKey);
      if (cached) return cached;

      const contact = await this.prisma.contact.findFirst({
        where: { id, workspaceId },
        include: {
          company: true,
          activities: {
            take: 10,
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!contact) {
        throw new NotFoundError('Contact', id);
      }

      // Cache for 5 minutes
      await this.cache.set(cacheKey, contact, 300);

      return contact;
    } catch (error) {
      if (error instanceof BaseError) {
        throw error;
      }

      throw new DatabaseError('findById', error);
    }
  }

  async bulkImport(
    contacts: ImportContactDto[],
    workspaceId: string,
    userId: string
  ) {
    const errors: any[] = [];
    const imported: any[] = [];
    
    // Process in batches to avoid overwhelming the database
    const batchSize = 100;
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      
      try {
        const results = await this.prisma.$transaction(
          batch.map((contact) =>
            this.prisma.contact.upsert({
              where: {
                email_workspaceId: {
                  email: contact.email,
                  workspaceId,
                },
              },
              update: {
                ...contact,
                updatedAt: new Date(),
              },
              create: {
                ...contact,
                workspaceId,
                createdById: userId,
              },
            })
          ),
          {
            isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
            maxWait: 5000,
            timeout: 10000,
          }
        );
        
        imported.push(...results);
      } catch (error) {
        this.logger.error(`Batch import failed for batch ${i / batchSize}:`, error);
        
        // Track which contacts failed
        batch.forEach((contact, index) => {
          errors.push({
            row: i + index + 1,
            email: contact.email,
            error: error.message,
          });
        });
      }
    }

    if (errors.length > 0 && imported.length === 0) {
      throw new ValidationError('All contacts failed to import', errors);
    }

    return {
      imported: imported.length,
      failed: errors.length,
      errors: errors.slice(0, 100), // Limit error details
    };
  }

  private handlePrismaError(
    error: Prisma.PrismaClientKnownRequestError,
    operation: string
  ): BaseError {
    switch (error.code) {
      case 'P2002':
        const field = error.meta?.target?.[0] || 'field';
        return new ConflictError(`Duplicate value for ${field}`, field);
      
      case 'P2025':
        return new NotFoundError('Record');
      
      case 'P2003':
        return new ValidationError('Foreign key constraint violation');
      
      case 'P2024':
        return new DatabaseError(
          operation,
          new Error('Timed out fetching data from database'),
          true
        );
      
      default:
        return new DatabaseError(operation, error);
    }
  }

  private async withRetry<T>(
    fn: () => Promise<T>,
    retries: number,
    retryableErrors: any[] = []
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (
        retries > 0 &&
        retryableErrors.some((errorType) => error instanceof errorType)
      ) {
        this.logger.warn(`Retrying after error: ${error.message}. Retries left: ${retries}`);
        await this.delay(1000 * (4 - retries)); // Exponential backoff
        return this.withRetry(fn, retries - 1, retryableErrors);
      }
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

## Database Error Handling

### Transaction Error Handling

```typescript
// packages/api/src/utils/database.utils.ts
import { PrismaClient, Prisma } from '@prisma/client';
import { DatabaseError } from '@hastecrm/common';
import { Logger } from '@nestjs/common';

export class DatabaseUtils {
  private static readonly logger = new Logger(DatabaseUtils.name);

  static async executeTransaction<T>(
    prisma: PrismaClient,
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: {
      maxRetries?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
      timeout?: number;
    }
  ): Promise<T> {
    const { maxRetries = 3, isolationLevel, timeout = 5000 } = options || {};
    
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await prisma.$transaction(callback, {
          isolationLevel,
          maxWait: 2000,
          timeout,
        });
      } catch (error) {
        lastError = error;
        
        // Check if error is retryable
        if (!this.isRetryableError(error) || attempt === maxRetries) {
          throw this.wrapDatabaseError(error, 'transaction');
        }
        
        this.logger.warn(
          `Transaction failed on attempt ${attempt}/${maxRetries}: ${error.message}`
        );
        
        // Exponential backoff
        await this.delay(Math.pow(2, attempt) * 100);
      }
    }
    
    throw this.wrapDatabaseError(lastError, 'transaction');
  }

  static isRetryableError(error: any): boolean {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return [
        'P2034', // Transaction failed due to write conflict
        'P2024', // Timed out
      ].includes(error.code);
    }
    
    // Check for connection errors
    if (error.message?.includes('connect') || 
        error.message?.includes('ECONNREFUSED')) {
      return true;
    }
    
    return false;
  }

  static wrapDatabaseError(error: any, operation: string): DatabaseError {
    const isRetryable = this.isRetryableError(error);
    
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return new DatabaseError(
        operation,
        new Error(`Database error ${error.code}: ${error.message}`),
        isRetryable
      );
    }
    
    return new DatabaseError(operation, error, isRetryable);
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Database Connection Pool Error Handling

```typescript
// packages/api/src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { DatabaseError } from '@hastecrm/common';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private connectionRetries = 0;
  private readonly maxRetries = 5;

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
      errorFormat: 'pretty',
    });

    // Set up event listeners
    this.$on('query' as never, (e: any) => {
      if (e.duration > 1000) {
        this.logger.warn(`Slow query detected (${e.duration}ms): ${e.query}`);
      }
    });

    this.$on('error' as never, (e: any) => {
      this.logger.error('Prisma error:', e);
    });
  }

  async onModuleInit() {
    await this.connectWithRetry();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  private async connectWithRetry() {
    try {
      await this.$connect();
      this.logger.log('Database connected successfully');
      this.connectionRetries = 0;
    } catch (error) {
      this.connectionRetries++;
      
      if (this.connectionRetries >= this.maxRetries) {
        this.logger.error('Failed to connect to database after maximum retries');
        throw new DatabaseError(
          'connection',
          new Error('Database connection failed'),
          false
        );
      }
      
      const retryDelay = Math.min(1000 * Math.pow(2, this.connectionRetries), 30000);
      this.logger.warn(
        `Database connection failed, retrying in ${retryDelay}ms (attempt ${this.connectionRetries}/${this.maxRetries})`
      );
      
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      return this.connectWithRetry();
    }
  }

  // Override $transaction to add error handling
  async $transaction(fn: any, options?: any) {
    try {
      return await super.$transaction(fn, options);
    } catch (error) {
      this.logger.error('Transaction failed:', error);
      throw this.handlePrismaError(error);
    }
  }

  private handlePrismaError(error: any): Error {
    if (error.code === 'P2024') {
      return new DatabaseError(
        'query',
        new Error('Database operation timed out'),
        true
      );
    }
    
    if (error.code === 'P2010') {
      return new DatabaseError(
        'query',
        new Error('Database query failed'),
        false
      );
    }
    
    return error;
  }
}
```

## API Error Responses

### GraphQL Error Handling

```typescript
// packages/api/src/graphql/plugins/error-plugin.ts
import { Plugin } from '@nestjs/apollo';
import { GraphQLError, GraphQLFormattedError } from 'graphql';
import { BaseError } from '@hastecrm/common';
import { Logger } from '@nestjs/common';

@Plugin()
export class ErrorHandlingPlugin {
  private readonly logger = new Logger(ErrorHandlingPlugin.name);

  async requestDidStart() {
    return {
      willSendResponse: async (requestContext) => {
        const { response, errors } = requestContext;
        
        if (errors) {
          response.errors = errors.map(error => this.formatError(error));
        }
      },
    };
  }

  private formatError(error: GraphQLError): GraphQLFormattedError {
    const originalError = error.originalError;
    
    // Handle our custom errors
    if (originalError instanceof BaseError) {
      return {
        message: originalError.message,
        extensions: {
          code: originalError.code,
          statusCode: originalError.statusCode,
          timestamp: originalError.timestamp,
          id: originalError.id,
          ...(process.env.NODE_ENV === 'development' && {
            context: originalError.context,
            stacktrace: originalError.stack?.split('\n'),
          }),
        },
      };
    }
    
    // Log unexpected errors
    this.logger.error('Unexpected GraphQL error:', error);
    
    // Return sanitized error for production
    if (process.env.NODE_ENV === 'production') {
      return {
        message: 'Internal server error',
        extensions: {
          code: 'INTERNAL_ERROR',
          statusCode: 500,
          id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        },
      };
    }
    
    // In development, return full error
    return error;
  }
}
```

## Async Error Handling

### Promise Rejection Handler

```typescript
// packages/api/src/utils/async-error-handler.ts
import { Logger } from '@nestjs/common';
import { SentryService } from '../services/sentry.service';

export class AsyncErrorHandler {
  private static readonly logger = new Logger(AsyncErrorHandler.name);

  static initialize(sentryService: SentryService) {
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      this.logger.error('Unhandled Promise Rejection:', reason);
      
      sentryService.captureException(
        reason instanceof Error ? reason : new Error(String(reason)),
        {
          extra: {
            promise: promise.toString(),
            reason: reason,
          },
        }
      );
      
      // In production, exit after logging
      if (process.env.NODE_ENV === 'production') {
        setTimeout(() => {
          process.exit(1);
        }, 1000);
      }
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      this.logger.error('Uncaught Exception:', error);
      
      sentryService.captureException(error, {
        level: 'fatal',
      });
      
      // Exit immediately for uncaught exceptions
      process.exit(1);
    });
  }
}
```

### Async Middleware Wrapper

```typescript
// packages/api/src/utils/async-middleware.ts
import { Request, Response, NextFunction } from 'express';

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Usage
app.get('/api/contacts', asyncHandler(async (req, res) => {
  const contacts = await contactService.findAll();
  res.json(contacts);
}));
```

## Circuit Breaker Pattern

```typescript
// packages/common/src/utils/circuit-breaker.ts
export interface CircuitBreakerOptions {
  name: string;
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
  halfOpenLimit?: number;
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private nextAttempt?: number;
  private halfOpenRequests = 0;

  constructor(private readonly options: CircuitBreakerOptions) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker is OPEN for ${this.options.name}`);
      }
      this.state = CircuitState.HALF_OPEN;
      this.halfOpenRequests = 0;
    }

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenRequests >= (this.options.halfOpenLimit || 3)) {
        throw new Error(`Circuit breaker is HALF_OPEN for ${this.options.name}, limit reached`);
      }
      this.halfOpenRequests++;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    this.failures = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= (this.options.halfOpenLimit || 3)) {
        this.state = CircuitState.CLOSED;
        this.successes = 0;
      }
    }
  }

  private onFailure() {
    this.failures++;
    
    if (this.failures >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.options.resetTimeout;
      this.failures = 0;
      this.successes = 0;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      nextAttempt: this.nextAttempt,
    };
  }
}
```

## Retry Strategies

```typescript
// packages/common/src/utils/retry.ts
export interface RetryOptions {
  maxAttempts: number;
  delay: number;
  maxDelay?: number;
  factor?: number;
  jitter?: boolean;
  retryCondition?: (error: any) => boolean;
}

export class RetryStrategy {
  static async execute<T>(
    fn: () => Promise<T>,
    options: RetryOptions
  ): Promise<T> {
    const {
      maxAttempts,
      delay,
      maxDelay = 30000,
      factor = 2,
      jitter = true,
      retryCondition = () => true,
    } = options;

    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt === maxAttempts || !retryCondition(error)) {
          throw error;
        }

        const backoff = this.calculateBackoff(
          attempt,
          delay,
          maxDelay,
          factor,
          jitter
        );

        await this.delay(backoff);
      }
    }

    throw lastError;
  }

  private static calculateBackoff(
    attempt: number,
    baseDelay: number,
    maxDelay: number,
    factor: number,
    jitter: boolean
  ): number {
    let delay = baseDelay * Math.pow(factor, attempt - 1);
    
    if (jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return Math.min(delay, maxDelay);
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage example
const result = await RetryStrategy.execute(
  () => externalApi.call(),
  {
    maxAttempts: 3,
    delay: 1000,
    factor: 2,
    jitter: true,
    retryCondition: (error) => error.response?.status >= 500,
  }
);
```

## Error Monitoring and Logging

### Structured Error Logging

```typescript
// packages/api/src/services/error-logger.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { BaseError } from '@hastecrm/common';
import * as winston from 'winston';

@Injectable()
export class ErrorLoggerService {
  private readonly logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'hastecrm-api' },
      transports: [
        new winston.transports.File({ 
          filename: 'logs/error.log',
          level: 'error',
        }),
        new winston.transports.File({ 
          filename: 'logs/combined.log',
        }),
      ],
    });

    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
      }));
    }
  }

  logError(error: Error | BaseError, context?: any) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message: error.message,
      stack: error.stack,
      context,
    };

    if (error instanceof BaseError) {
      Object.assign(errorLog, {
        id: error.id,
        code: error.code,
        statusCode: error.statusCode,
        isOperational: error.isOperational,
        errorContext: error.context,
      });
    }

    this.logger.error(errorLog);
  }

  logWarning(message: string, context?: any) {
    this.logger.warn({
      timestamp: new Date().toISOString(),
      message,
      context,
    });
  }
}
```

## Testing Error Scenarios

### Unit Tests for Error Handling

```typescript
// packages/api/src/services/__tests__/contact.service.error.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ContactService } from '../contact.service';
import { PrismaService } from '../../prisma/prisma.service';
import { 
  NotFoundError, 
  ConflictError, 
  DatabaseError 
} from '@hastecrm/common';
import { Prisma } from '@prisma/client';

describe('ContactService Error Handling', () => {
  let service: ContactService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactService,
        {
          provide: PrismaService,
          useValue: {
            contact: {
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ContactService>(ContactService);
    prisma = module.get(PrismaService);
  });

  describe('create', () => {
    it('should throw ConflictError when email already exists', async () => {
      prisma.contact.findFirst.mockResolvedValue({ id: '123' } as any);

      await expect(
        service.create(
          { email: 'test@haste.nyc', workspaceId: 'ws1' } as any,
          'user1'
        )
      ).rejects.toThrow(ConflictError);
    });

    it('should handle Prisma unique constraint violation', async () => {
      prisma.contact.findFirst.mockResolvedValue(null);
      
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        {
          code: 'P2002',
          clientVersion: '4.0.0',
          meta: { target: ['email'] },
        }
      );
      
      prisma.contact.create.mockRejectedValue(prismaError);

      await expect(
        service.create(
          { email: 'test@haste.nyc', workspaceId: 'ws1' } as any,
          'user1'
        )
      ).rejects.toThrow(ConflictError);
    });

    it('should retry on transient database errors', async () => {
      prisma.contact.findFirst.mockResolvedValue(null);
      
      const transientError = new Prisma.PrismaClientKnownRequestError(
        'Timed out',
        {
          code: 'P2024',
          clientVersion: '4.0.0',
        }
      );
      
      prisma.contact.create
        .mockRejectedValueOnce(transientError)
        .mockRejectedValueOnce(transientError)
        .mockResolvedValue({ id: '123' } as any);

      const result = await service.create(
        { email: 'test@haste.nyc', workspaceId: 'ws1' } as any,
        'user1'
      );

      expect(result.id).toBe('123');
      expect(prisma.contact.create).toHaveBeenCalledTimes(3);
    });
  });

  describe('findById', () => {
    it('should throw NotFoundError when contact does not exist', async () => {
      prisma.contact.findFirst.mockResolvedValue(null);

      await expect(
        service.findById('123', 'ws1')
      ).rejects.toThrow(NotFoundError);
    });

    it('should wrap unknown database errors', async () => {
      prisma.contact.findFirst.mockRejectedValue(new Error('Connection lost'));

      await expect(
        service.findById('123', 'ws1')
      ).rejects.toThrow(DatabaseError);
    });
  });

  describe('bulkImport', () => {
    it('should handle partial failures', async () => {
      const contacts = [
        { email: 'test1@haste.nyc' },
        { email: 'test2@haste.nyc' },
      ];

      prisma.$transaction.mockImplementation(async (queries) => {
        // Simulate first contact succeeds, second fails
        return Promise.all([
          Promise.resolve({ id: '1' }),
          Promise.reject(new Error('Constraint violation')),
        ]);
      });

      const result = await service.bulkImport(
        contacts as any,
        'ws1',
        'user1'
      );

      expect(result.imported).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('should throw ValidationError when all imports fail', async () => {
      const contacts = [{ email: 'test@haste.nyc' }];

      prisma.$transaction.mockRejectedValue(new Error('Database error'));

      await expect(
        service.bulkImport(contacts as any, 'ws1', 'user1')
      ).rejects.toThrow(ValidationError);
    });
  });
});
```

### Integration Tests for Error Scenarios

```typescript
// packages/api/e2e/error-handling.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Error Handling (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('API Error Responses', () => {
    it('should return 404 for non-existent resource', () => {
      return request(app.getHttpServer())
        .get('/api/contacts/non-existent-id')
        .expect(404)
        .expect((res) => {
          expect(res.body.error).toMatchObject({
            code: 'NOT_FOUND',
            message: expect.stringContaining('not found'),
            statusCode: 404,
          });
        });
    });

    it('should return 400 for validation errors', () => {
      return request(app.getHttpServer())
        .post('/api/contacts')
        .send({ email: 'invalid-email' })
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toMatchObject({
            code: 'VALIDATION_ERROR',
            statusCode: 400,
          });
        });
    });

    it('should return 429 for rate limit exceeded', async () => {
      // Make multiple requests quickly
      const requests = Array(101).fill(null).map(() =>
        request(app.getHttpServer()).get('/api/contacts')
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.find(r => r.status === 429);

      expect(rateLimited).toBeDefined();
      expect(rateLimited.body.error).toMatchObject({
        code: 'RATE_LIMIT_EXCEEDED',
        statusCode: 429,
      });
    });

    it('should handle database connection errors gracefully', async () => {
      // Simulate database connection failure
      // This would require mocking the database connection
      // Implementation depends on your test setup
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit after repeated failures', async () => {
      // Make requests to an endpoint that uses circuit breaker
      // Simulate failures and verify circuit opens
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed requests with exponential backoff', async () => {
      // Test endpoint with retry logic
      // Verify retries happen with proper delays
    });
  });
});
```

This comprehensive error handling guide provides all the patterns and implementations needed for robust error management in hasteCRM.