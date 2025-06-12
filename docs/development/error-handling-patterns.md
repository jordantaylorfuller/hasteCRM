# Error Handling Patterns

## Overview

This document provides comprehensive error handling patterns and implementations for hasteCRM. Proper error handling ensures reliability, maintainability, and excellent user experience.

## Table of Contents

1. [Error Types and Classification](#error-types-and-classification)
2. [Backend Error Handling](#backend-error-handling)
3. [Frontend Error Handling](#frontend-error-handling)
4. [API Error Responses](#api-error-responses)
5. [Retry and Recovery Patterns](#retry-and-recovery-patterns)
6. [Circuit Breaker Pattern](#circuit-breaker-pattern)
7. [Error Monitoring and Logging](#error-monitoring-and-logging)
8. [User-Friendly Error Messages](#user-friendly-error-messages)

## Error Types and Classification

### Error Categories

```typescript
// packages/shared/src/errors/types.ts
export enum ErrorCategory {
  // Client errors (4xx)
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT = 'RATE_LIMIT',
  
  // Server errors (5xx)
  INTERNAL = 'INTERNAL',
  DATABASE = 'DATABASE',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE',
  TIMEOUT = 'TIMEOUT',
  
  // Business logic errors
  BUSINESS_RULE = 'BUSINESS_RULE',
  INSUFFICIENT_CREDITS = 'INSUFFICIENT_CREDITS',
  SUBSCRIPTION_REQUIRED = 'SUBSCRIPTION_REQUIRED',
}

export interface ErrorMetadata {
  category: ErrorCategory;
  code: string;
  statusCode: number;
  retryable: boolean;
  userMessage: string;
  technicalDetails?: any;
  helpUrl?: string;
}
```

## Backend Error Handling

### Custom Error Classes

```typescript
// packages/api/src/common/errors/base.error.ts
export abstract class BaseError extends Error {
  public readonly category: ErrorCategory;
  public readonly code: string;
  public readonly statusCode: number;
  public readonly retryable: boolean;
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    metadata: Partial<ErrorMetadata>,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.category = metadata.category || ErrorCategory.INTERNAL;
    this.code = metadata.code || 'UNKNOWN_ERROR';
    this.statusCode = metadata.statusCode || 500;
    this.retryable = metadata.retryable || false;
    this.timestamp = new Date();
    this.context = context;
    
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): ErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        category: this.category,
        timestamp: this.timestamp.toISOString(),
        ...(process.env.NODE_ENV !== 'production' && {
          stack: this.stack,
          context: this.context,
        }),
      },
    };
  }
}

// Specific error classes
export class ValidationError extends BaseError {
  constructor(message: string, errors?: Record<string, string[]>) {
    super(message, {
      category: ErrorCategory.VALIDATION,
      code: 'VALIDATION_ERROR',
      statusCode: 422,
      retryable: false,
    }, { errors });
  }
}

export class AuthenticationError extends BaseError {
  constructor(message = 'Authentication required') {
    super(message, {
      category: ErrorCategory.AUTHENTICATION,
      code: 'UNAUTHENTICATED',
      statusCode: 401,
      retryable: false,
    });
  }
}

export class AuthorizationError extends BaseError {
  constructor(message = 'Insufficient permissions') {
    super(message, {
      category: ErrorCategory.AUTHORIZATION,
      code: 'FORBIDDEN',
      statusCode: 403,
      retryable: false,
    });
  }
}

export class NotFoundError extends BaseError {
  constructor(resource: string, id?: string) {
    const message = id 
      ? `${resource} with id ${id} not found`
      : `${resource} not found`;
    
    super(message, {
      category: ErrorCategory.NOT_FOUND,
      code: 'RESOURCE_NOT_FOUND',
      statusCode: 404,
      retryable: false,
    }, { resource, id });
  }
}

export class ConflictError extends BaseError {
  constructor(message: string, conflictingField?: string) {
    super(message, {
      category: ErrorCategory.CONFLICT,
      code: 'RESOURCE_CONFLICT',
      statusCode: 409,
      retryable: false,
    }, { conflictingField });
  }
}

export class RateLimitError extends BaseError {
  constructor(limit: number, window: string, retryAfter?: number) {
    super(`Rate limit exceeded: ${limit} requests per ${window}`, {
      category: ErrorCategory.RATE_LIMIT,
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
      retryable: true,
    }, { limit, window, retryAfter });
  }
}

export class ExternalServiceError extends BaseError {
  constructor(service: string, originalError?: Error) {
    super(`External service error: ${service}`, {
      category: ErrorCategory.EXTERNAL_SERVICE,
      code: 'EXTERNAL_SERVICE_ERROR',
      statusCode: 503,
      retryable: true,
    }, { service, originalError: originalError?.message });
  }
}
```

### NestJS Exception Filters

```typescript
// packages/api/src/common/filters/all-exceptions.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BaseError } from '../errors/base.error';
import { ErrorResponse } from '../interfaces/error-response.interface';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let errorResponse: ErrorResponse;

    if (exception instanceof BaseError) {
      status = exception.statusCode;
      errorResponse = exception.toJSON();
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      errorResponse = {
        error: {
          code: this.getErrorCode(status),
          message: typeof exceptionResponse === 'string' 
            ? exceptionResponse 
            : (exceptionResponse as any).message || exception.message,
          timestamp: new Date().toISOString(),
        },
      };
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorResponse = {
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
          timestamp: new Date().toISOString(),
          ...(process.env.NODE_ENV !== 'production' && {
            details: exception.message,
            stack: exception.stack,
          }),
        },
      };
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorResponse = {
        error: {
          code: 'UNKNOWN_ERROR',
          message: 'An unknown error occurred',
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Log error
    this.logError(exception, request, status);

    // Add request ID for tracing
    errorResponse.error.requestId = request.id;

    // Send response
    response.status(status).json(errorResponse);
  }

  private getErrorCode(status: number): string {
    const errorCodes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHENTICATED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'VALIDATION_ERROR',
      429: 'RATE_LIMIT_EXCEEDED',
      500: 'INTERNAL_SERVER_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
      504: 'GATEWAY_TIMEOUT',
    };

    return errorCodes[status] || 'UNKNOWN_ERROR';
  }

  private logError(exception: unknown, request: Request, status: number) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      requestId: request.id,
      method: request.method,
      url: request.url,
      ip: request.ip,
      userId: (request as any).user?.id,
      status,
      error: exception instanceof Error ? {
        name: exception.name,
        message: exception.message,
        stack: exception.stack,
      } : exception,
    };

    if (status >= 500) {
      this.logger.error(errorLog);
    } else if (status >= 400) {
      this.logger.warn(errorLog);
    }
  }
}
```

### Service Layer Error Handling

```typescript
// packages/api/src/contacts/contacts.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { ValidationError, NotFoundError, ConflictError } from '../common/errors';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime';

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(private prisma: PrismaService) {}

  async create(data: CreateContactDto, userId: string) {
    try {
      // Validate email uniqueness within workspace
      if (data.email) {
        const existing = await this.prisma.contact.findFirst({
          where: {
            email: data.email,
            workspace: { users: { some: { userId } } },
          },
        });

        if (existing) {
          throw new ConflictError(
            'Contact with this email already exists',
            'email'
          );
        }
      }

      // Create contact
      const contact = await this.prisma.contact.create({
        data: {
          ...data,
          createdBy: { connect: { id: userId } },
          workspace: { connect: { id: workspaceId } },
        },
        include: {
          company: true,
          tags: true,
        },
      });

      return contact;
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async findOne(id: string, userId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: {
        id,
        workspace: { users: { some: { userId } } },
      },
      include: {
        company: true,
        tags: true,
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!contact) {
      throw new NotFoundError('Contact', id);
    }

    return contact;
  }

  private handlePrismaError(error: unknown): never {
    if (error instanceof PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2002':
          throw new ConflictError(
            'Unique constraint violation',
            error.meta?.target as string
          );
        case 'P2025':
          throw new NotFoundError('Record');
        case 'P2003':
          throw new ValidationError('Foreign key constraint violation');
        default:
          this.logger.error('Prisma error:', error);
          throw new Error('Database operation failed');
      }
    }

    throw error;
  }
}
```

### GraphQL Error Handling

```typescript
// packages/api/src/common/graphql/error.formatter.ts
import { GraphQLError, GraphQLFormattedError } from 'graphql';
import { BaseError } from '../errors/base.error';
import { Logger } from '@nestjs/common';

const logger = new Logger('GraphQLErrorFormatter');

export const formatError = (
  error: GraphQLError
): GraphQLFormattedError => {
  const originalError = error.originalError;

  // Handle our custom errors
  if (originalError instanceof BaseError) {
    return {
      message: originalError.message,
      extensions: {
        code: originalError.code,
        category: originalError.category,
        statusCode: originalError.statusCode,
        timestamp: originalError.timestamp,
        ...(originalError.context && { details: originalError.context }),
      },
      path: error.path,
      locations: error.locations,
    };
  }

  // Handle validation errors from class-validator
  if (originalError?.name === 'ValidationError') {
    return {
      message: 'Validation failed',
      extensions: {
        code: 'VALIDATION_ERROR',
        category: ErrorCategory.VALIDATION,
        statusCode: 422,
        errors: (originalError as any).errors,
      },
      path: error.path,
      locations: error.locations,
    };
  }

  // Log unexpected errors
  logger.error('Unhandled GraphQL error:', error);

  // Generic error response
  return {
    message: process.env.NODE_ENV === 'production' 
      ? 'An error occurred' 
      : error.message,
    extensions: {
      code: 'INTERNAL_SERVER_ERROR',
      category: ErrorCategory.INTERNAL,
      statusCode: 500,
      ...(process.env.NODE_ENV !== 'production' && {
        stacktrace: error.stack,
      }),
    },
    path: error.path,
    locations: error.locations,
  };
};
```

## Frontend Error Handling

### Error Boundary Implementation

```typescript
// packages/web/src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to error reporting service
    const errorId = Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });

    this.setState({ errorInfo, errorId });

    // Call custom error handler
    this.props.onError?.(error, errorInfo);
  }

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: undefined,
    });
  };

  public render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      // Default error UI
      return (
        <div className="min-h-[400px] flex items-center justify-center p-4">
          <Alert variant="destructive" className="max-w-lg">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription className="mt-2 space-y-2">
              <p>{this.state.error.message || 'An unexpected error occurred'}</p>
              {this.state.errorId && (
                <p className="text-xs text-muted-foreground">
                  Error ID: {this.state.errorId}
                </p>
              )}
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm">
                    Error details
                  </summary>
                  <pre className="mt-2 text-xs overflow-auto">
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </AlertDescription>
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleReset}
                className="gap-2"
              >
                <RefreshCw className="h-3 w-3" />
                Try again
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = '/'}
              >
                Go home
              </Button>
            </div>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for error handling
export function useErrorHandler() {
  return (error: Error, errorInfo?: { componentStack?: string }) => {
    console.error('Error caught by error handler:', error);
    
    // Report to Sentry
    Sentry.captureException(error, {
      extra: errorInfo,
    });
    
    // You can also trigger UI notifications here
    // toast.error(error.message);
  };
}
```

### API Error Interceptor

```typescript
// packages/web/src/lib/api/error-interceptor.ts
import axios, { AxiosError, AxiosInstance } from 'axios';
import { toast } from '@/components/ui/use-toast';
import { getErrorMessage, isRetryableError } from './error-utils';
import { authStore } from '@/stores/auth-store';

export function setupErrorInterceptor(apiClient: AxiosInstance) {
  apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<ErrorResponse>) => {
      const { config, response } = error;
      const originalRequest = config as any;

      // Handle network errors
      if (!response) {
        toast({
          title: 'Network Error',
          description: 'Please check your internet connection',
          variant: 'destructive',
        });
        return Promise.reject(error);
      }

      // Handle authentication errors
      if (response.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          await authStore.getState().refreshToken();
          return apiClient(originalRequest);
        } catch (refreshError) {
          authStore.getState().logout();
          window.location.href = '/login';
          return Promise.reject(refreshError);
        }
      }

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers['retry-after'];
        const message = retryAfter
          ? `Rate limited. Try again in ${retryAfter} seconds.`
          : 'Too many requests. Please slow down.';

        toast({
          title: 'Rate Limited',
          description: message,
          variant: 'warning',
        });

        if (retryAfter && originalRequest._retryCount < 3) {
          originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
          
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve(apiClient(originalRequest));
            }, parseInt(retryAfter) * 1000);
          });
        }
      }

      // Handle validation errors
      if (response.status === 422) {
        const errors = response.data?.error?.details?.errors;
        if (errors) {
          Object.entries(errors).forEach(([field, messages]) => {
            toast({
              title: `Validation Error: ${field}`,
              description: (messages as string[]).join(', '),
              variant: 'destructive',
            });
          });
        }
        return Promise.reject(error);
      }

      // Handle other errors
      const errorMessage = getErrorMessage(error);
      const shouldShowToast = !originalRequest._silent;

      if (shouldShowToast) {
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }

      // Retry logic for retryable errors
      if (
        isRetryableError(response.status) &&
        (!originalRequest._retryCount || originalRequest._retryCount < 3)
      ) {
        originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
        
        const delay = Math.min(1000 * Math.pow(2, originalRequest._retryCount), 10000);
        
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(apiClient(originalRequest));
          }, delay);
        });
      }

      return Promise.reject(error);
    }
  );
}
```

### React Query Error Handling

```typescript
// packages/web/src/lib/react-query/error-handler.ts
import { QueryCache, MutationCache } from '@tanstack/react-query';
import { toast } from '@/components/ui/use-toast';
import { AxiosError } from 'axios';
import { getErrorMessage } from '../api/error-utils';

export const queryCache = new QueryCache({
  onError: (error, query) => {
    // Only show error toast for user-initiated queries
    if (query.meta?.showErrorToast !== false) {
      handleQueryError(error);
    }
  },
});

export const mutationCache = new MutationCache({
  onError: (error, variables, context, mutation) => {
    // Always show error toast for mutations unless explicitly disabled
    if (mutation.meta?.showErrorToast !== false) {
      handleMutationError(error);
    }
  },
});

function handleQueryError(error: unknown) {
  const message = getErrorMessage(error);
  
  if (error instanceof AxiosError && error.response?.status === 401) {
    // Authentication errors are handled by the interceptor
    return;
  }

  toast({
    title: 'Failed to load data',
    description: message,
    variant: 'destructive',
  });
}

function handleMutationError(error: unknown) {
  const message = getErrorMessage(error);
  
  toast({
    title: 'Operation failed',
    description: message,
    variant: 'destructive',
  });
}

// Custom hooks with error handling
export function useContactsQuery(options?: UseQueryOptions) {
  return useQuery({
    queryKey: ['contacts'],
    queryFn: fetchContacts,
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors
      if (error instanceof AxiosError && error.response?.status && error.response.status < 500) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    ...options,
  });
}
```

## API Error Responses

### Standard Error Response Format

```typescript
// packages/shared/src/interfaces/error-response.interface.ts
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    category?: ErrorCategory;
    timestamp: string;
    requestId?: string;
    details?: any;
    helpUrl?: string;
  };
}

// Example responses
const validationErrorResponse: ErrorResponse = {
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Validation failed',
    category: ErrorCategory.VALIDATION,
    timestamp: '2024-01-15T10:30:00Z',
    requestId: 'req_123456',
    details: {
      errors: {
        email: ['Email is required', 'Email must be valid'],
        phone: ['Phone number is invalid'],
      },
    },
  },
};

const rateLimitErrorResponse: ErrorResponse = {
  error: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests',
    category: ErrorCategory.RATE_LIMIT,
    timestamp: '2024-01-15T10:30:00Z',
    requestId: 'req_123456',
    details: {
      limit: 100,
      window: '1 hour',
      retryAfter: 3600,
    },
  },
};
```

## Retry and Recovery Patterns

### Exponential Backoff Implementation

```typescript
// packages/shared/src/utils/retry.ts
export interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  factor: number;
  shouldRetry?: (error: any, attempt: number) => boolean;
  onRetry?: (error: any, attempt: number) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    factor = 2,
    shouldRetry = defaultShouldRetry,
    onRetry,
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !shouldRetry(error, attempt)) {
        throw error;
      }

      const delay = Math.min(
        initialDelay * Math.pow(factor, attempt),
        maxDelay
      );

      onRetry?.(error, attempt);

      await sleep(delay + jitter(delay));
    }
  }

  throw lastError;
}

function defaultShouldRetry(error: any, attempt: number): boolean {
  // Retry on network errors
  if (!error.response) {
    return true;
  }

  // Retry on 5xx errors
  if (error.response?.status >= 500) {
    return true;
  }

  // Retry on specific 4xx errors
  const retryableStatuses = [408, 429, 503, 504];
  return retryableStatuses.includes(error.response?.status);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(delay: number): number {
  // Add ±25% jitter
  return delay * (0.75 + Math.random() * 0.5);
}
```

### Retry Queue Implementation

```typescript
// packages/api/src/common/services/retry-queue.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import { RedisService } from './redis.service';

export interface RetryableJob {
  id: string;
  type: string;
  data: any;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: Date;
  lastError?: string;
}

@Injectable()
export class RetryQueueService {
  private readonly logger = new Logger(RetryQueueService.name);
  private queue: Queue;
  private worker: Worker;

  constructor(private redis: RedisService) {
    this.queue = new Queue('retry-queue', {
      connection: this.redis.getConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });

    this.setupWorker();
  }

  async addJob(job: Omit<RetryableJob, 'attempts' | 'nextRetryAt'>) {
    return this.queue.add(job.type, job, {
      jobId: job.id,
      attempts: job.maxAttempts,
    });
  }

  private setupWorker() {
    this.worker = new Worker(
      'retry-queue',
      async (job: Job<RetryableJob>) => {
        try {
          await this.processJob(job);
        } catch (error) {
          this.logger.error(
            `Job ${job.id} failed on attempt ${job.attemptsMade}:`,
            error
          );
          throw error;
        }
      },
      {
        connection: this.redis.getConnection(),
        concurrency: 10,
      }
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(`Job ${job?.id} failed permanently:`, error);
      this.handlePermanentFailure(job);
    });
  }

  private async processJob(job: Job<RetryableJob>) {
    const { type, data } = job.data;

    switch (type) {
      case 'email-sync':
        return this.processEmailSync(data);
      case 'webhook-delivery':
        return this.processWebhookDelivery(data);
      case 'ai-enrichment':
        return this.processAIEnrichment(data);
      default:
        throw new Error(`Unknown job type: ${type}`);
    }
  }

  private async processEmailSync(data: any) {
    // Implementation
  }

  private async processWebhookDelivery(data: any) {
    // Implementation
  }

  private async processAIEnrichment(data: any) {
    // Implementation
  }

  private async handlePermanentFailure(job: Job<RetryableJob> | undefined) {
    if (!job) return;

    // Send notification
    await this.notificationService.sendFailureNotification({
      jobId: job.id,
      jobType: job.data.type,
      error: job.failedReason,
      attempts: job.attemptsMade,
    });

    // Store in dead letter queue
    await this.redis.zadd(
      'dead-letter-queue',
      Date.now(),
      JSON.stringify({
        job: job.data,
        failedAt: new Date(),
        reason: job.failedReason,
      })
    );
  }
}
```

## Circuit Breaker Pattern

### Circuit Breaker Implementation

```typescript
// packages/shared/src/utils/circuit-breaker.ts
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
  halfOpenRequests: number;
  onStateChange?: (oldState: CircuitState, newState: CircuitState) => void;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime?: number;
  private halfOpenRequests: number = 0;

  constructor(
    private name: string,
    private options: CircuitBreakerOptions
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
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
      if (this.successes >= this.options.halfOpenRequests) {
        this.transitionTo(CircuitState.CLOSED);
      }
    }
  }

  private onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.OPEN);
    } else if (
      this.failures >= this.options.failureThreshold &&
      this.state === CircuitState.CLOSED
    ) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  private shouldAttemptReset(): boolean {
    return (
      this.lastFailureTime !== undefined &&
      Date.now() - this.lastFailureTime >= this.options.resetTimeout
    );
  }

  private transitionTo(newState: CircuitState) {
    const oldState = this.state;
    this.state = newState;

    if (newState === CircuitState.HALF_OPEN) {
      this.halfOpenRequests = 0;
      this.successes = 0;
    }

    this.options.onStateChange?.(oldState, newState);
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

// Usage example
const gmailBreaker = new CircuitBreaker('gmail-api', {
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  monitoringPeriod: 120000, // 2 minutes
  halfOpenRequests: 3,
  onStateChange: (oldState, newState) => {
    logger.warn(`Gmail circuit breaker: ${oldState} -> ${newState}`);
  },
});

export async function syncGmailWithCircuitBreaker(accountId: string) {
  return gmailBreaker.execute(async () => {
    return gmailService.syncEmails(accountId);
  });
}
```

## Error Monitoring and Logging

### Structured Logging

```typescript
// packages/api/src/common/services/logger.service.ts
import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';

@Injectable()
export class CustomLogger implements LoggerService {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: {
        service: 'hastecrm-api',
        environment: process.env.NODE_ENV,
      },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
        }),
      ],
    });

    // Add Elasticsearch transport in production
    if (process.env.NODE_ENV === 'production') {
      this.logger.add(
        new ElasticsearchTransport({
          level: 'error',
          clientOpts: {
            node: process.env.ELASTICSEARCH_URL,
          },
          index: 'hastecrm-errors',
        })
      );
    }
  }

  log(message: string, context?: string) {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { trace, context });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context });
  }

  // Custom error logging with additional metadata
  logError(error: Error, metadata?: Record<string, any>) {
    this.logger.error({
      message: error.message,
      stack: error.stack,
      name: error.name,
      ...metadata,
      timestamp: new Date().toISOString(),
    });
  }
}
```

### Sentry Integration

```typescript
// packages/web/src/lib/monitoring/sentry.ts
import * as Sentry from '@sentry/nextjs';
import { CaptureContext } from '@sentry/types';

export function initSentry() {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    integrations: [
      new Sentry.BrowserTracing(),
      new Sentry.Replay({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    beforeSend(event, hint) {
      // Filter out known non-errors
      if (event.exception?.values?.[0]?.value?.includes('ResizeObserver')) {
        return null;
      }

      // Add user context
      const user = authStore.getState().user;
      if (user) {
        event.user = {
          id: user.id,
          email: user.email,
        };
      }

      return event;
    },
  });
}

export function captureError(
  error: Error,
  context?: CaptureContext,
  metadata?: Record<string, any>
) {
  Sentry.withScope((scope) => {
    if (metadata) {
      scope.setContext('metadata', metadata);
    }
    Sentry.captureException(error, context);
  });
}
```

## User-Friendly Error Messages

### Error Message Mapping

```typescript
// packages/web/src/lib/errors/user-messages.ts
const errorMessages: Record<string, string> = {
  // Authentication
  UNAUTHENTICATED: 'Please log in to continue',
  INVALID_CREDENTIALS: 'Invalid email or password',
  ACCOUNT_LOCKED: 'Your account has been locked. Please contact support.',
  SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  
  // Authorization
  FORBIDDEN: 'You don\'t have permission to perform this action',
  SUBSCRIPTION_REQUIRED: 'This feature requires a premium subscription',
  
  // Validation
  VALIDATION_ERROR: 'Please check your input and try again',
  EMAIL_ALREADY_EXISTS: 'An account with this email already exists',
  INVALID_EMAIL_FORMAT: 'Please enter a valid email address',
  PASSWORD_TOO_WEAK: 'Password must be at least 8 characters with a mix of letters and numbers',
  
  // Resources
  RESOURCE_NOT_FOUND: 'The requested item could not be found',
  CONTACT_NOT_FOUND: 'Contact not found. It may have been deleted.',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please slow down and try again.',
  
  // External services
  GMAIL_SYNC_FAILED: 'Failed to sync Gmail. Please check your connection and try again.',
  AI_SERVICE_UNAVAILABLE: 'AI features are temporarily unavailable. Please try again later.',
  
  // Generic
  INTERNAL_SERVER_ERROR: 'Something went wrong. Please try again later.',
  NETWORK_ERROR: 'Connection error. Please check your internet and try again.',
};

export function getUserFriendlyMessage(errorCode: string): string {
  return errorMessages[errorCode] || 'An unexpected error occurred';
}

// Component for displaying errors
export function ErrorMessage({ error }: { error: Error | AxiosError }) {
  const message = React.useMemo(() => {
    if (axios.isAxiosError(error)) {
      const errorCode = error.response?.data?.error?.code;
      if (errorCode) {
        return getUserFriendlyMessage(errorCode);
      }
    }
    
    return error.message || 'An unexpected error occurred';
  }, [error]);

  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
```

This completes the comprehensive error handling patterns documentation with implementation examples for all aspects of error handling in hasteCRM.