# Common Patterns and Standards

This document defines common patterns used across all features to ensure consistency and maintainability.

## Error Handling

### Standard Error Types

```typescript
// Base error class
export class AppError extends Error {
  constructor(
    public message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error types
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 'AUTHENTICATION_ERROR', 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 'AUTHORIZATION_ERROR', 403);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id 
      ? `${resource} with id ${id} not found`
      : `${resource} not found`;
    super(message, 'NOT_FOUND', 404);
  }
}

export class RateLimitError extends AppError {
  constructor(resetAt: Date) {
    super('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED', 429, { resetAt });
  }
}
```

### Standard Error Handling Pattern

```typescript
// API endpoint error handling
export async function handleRequest(
  req: Request,
  res: Response,
  handler: () => Promise<any>
): Promise<void> {
  try {
    const result = await handler();
    res.json({ data: result });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      });
    } else {
      // Log unexpected errors
      logger.error('Unexpected error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred'
        }
      });
    }
  }
}

// Service layer error handling
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    logger.error(`Error in ${context}:`, error);
    
    // Re-throw AppErrors as-is
    if (error instanceof AppError) {
      throw error;
    }
    
    // Wrap other errors
    throw new AppError(
      'Operation failed',
      'OPERATION_FAILED',
      500,
      { context, originalError: error.message }
    );
  }
}
```

## API Response Formats

### Success Response

```typescript
interface SuccessResponse<T> {
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    totalCount?: number;
    totalPages?: number;
  };
}

// Example usage
res.json({
  data: {
    id: 'contact_123',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe'
  }
} as SuccessResponse<Contact>);
```

### Error Response

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp?: string;
    requestId?: string;
  };
}

// Example usage
res.status(400).json({
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid email format',
    details: {
      field: 'email',
      value: 'invalid-email'
    },
    timestamp: new Date().toISOString(),
    requestId: req.id
  }
} as ErrorResponse);
```

### Paginated Response

```typescript
interface PaginatedResponse<T> extends SuccessResponse<T[]> {
  meta: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  links?: {
    first?: string;
    previous?: string;
    next?: string;
    last?: string;
  };
}
```

## Database Patterns

### Transaction Handling

```typescript
export async function withTransaction<T>(
  operation: (tx: PrismaTransaction) => Promise<T>
): Promise<T> {
  return await prisma.$transaction(async (tx) => {
    try {
      return await operation(tx);
    } catch (error) {
      logger.error('Transaction failed:', error);
      throw error;
    }
  }, {
    maxWait: 5000,
    timeout: 10000,
    isolationLevel: 'ReadCommitted'
  });
}

// Usage example
const result = await withTransaction(async (tx) => {
  const contact = await tx.contact.create({ data: contactData });
  await tx.activity.create({ 
    data: { 
      type: 'contact_created',
      entityId: contact.id 
    } 
  });
  return contact;
});
```

### Soft Delete Pattern

```typescript
// Model interface
interface SoftDeletable {
  deletedAt?: Date | null;
}

// Soft delete function
export async function softDelete<T extends SoftDeletable>(
  model: any,
  id: string
): Promise<T> {
  return await model.update({
    where: { id },
    data: { deletedAt: new Date() }
  });
}

// Query filter
export function excludeDeleted<T extends { deletedAt?: any }>(
  where: T
): T & { deletedAt: null } {
  return { ...where, deletedAt: null };
}
```

## Caching Patterns

### Cache Key Generation

```typescript
export class CacheKeyBuilder {
  private parts: string[] = [];
  
  constructor(private prefix: string) {
    this.parts.push(prefix);
  }
  
  add(part: string | number): this {
    this.parts.push(String(part));
    return this;
  }
  
  addHash(data: any): this {
    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex')
      .substring(0, 8);
    this.parts.push(hash);
    return this;
  }
  
  build(): string {
    return this.parts.join(':');
  }
}

// Usage
const key = new CacheKeyBuilder('contact')
  .add(workspaceId)
  .add(contactId)
  .add('profile')
  .build();
// Result: "contact:ws_123:contact_456:profile"
```

### Cache Wrapper

```typescript
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const { ttl = 300, forceRefresh = false } = options;
  
  // Check cache first
  if (!forceRefresh) {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
  }
  
  // Fetch fresh data
  const data = await fetcher();
  
  // Store in cache
  await redis.setex(key, ttl, JSON.stringify(data));
  
  return data;
}
```

## Validation Patterns

### Input Validation

```typescript
import { z } from 'zod';

// Define schemas
export const emailSchema = z.string().email().toLowerCase();
export const phoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/);
export const urlSchema = z.string().url();

// Create validators
export function createValidator<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): T => {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Validation failed', {
          errors: error.errors
        });
      }
      throw error;
    }
  };
}

// Usage
const validateContact = createValidator(
  z.object({
    email: emailSchema,
    firstName: z.string().min(1).max(50),
    lastName: z.string().min(1).max(50),
    phone: phoneSchema.optional(),
    company: z.string().optional()
  })
);
```

## Event Patterns

### Event Emitter

```typescript
export class TypedEventEmitter<T extends Record<string, any>> {
  private emitter = new EventEmitter();
  
  on<K extends keyof T>(
    event: K,
    listener: (data: T[K]) => void | Promise<void>
  ): void {
    this.emitter.on(String(event), listener);
  }
  
  emit<K extends keyof T>(event: K, data: T[K]): void {
    this.emitter.emit(String(event), data);
  }
  
  off<K extends keyof T>(
    event: K,
    listener: (data: T[K]) => void | Promise<void>
  ): void {
    this.emitter.off(String(event), listener);
  }
}

// Define events
interface AppEvents {
  'contact.created': { contact: Contact };
  'contact.updated': { contact: Contact; changes: Partial<Contact> };
  'email.sent': { email: Email };
  'email.bounced': { email: Email; reason: string };
}

// Usage
const events = new TypedEventEmitter<AppEvents>();

events.on('contact.created', async ({ contact }) => {
  await enrichmentService.enrich(contact);
});
```

## Testing Patterns

### Test Utilities

```typescript
// Database setup for tests
export async function setupTestDatabase(): Promise<void> {
  await prisma.$executeRaw`TRUNCATE TABLE contacts CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE emails CASCADE`;
}

// Factory functions
export function createMockContact(overrides?: Partial<Contact>): Contact {
  return {
    id: `contact_${Date.now()}`,
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    workspaceId: 'test_workspace',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

// Test helpers
export async function authenticatedRequest(
  app: Application,
  method: string,
  url: string,
  data?: any
): Promise<request.Response> {
  const token = generateTestToken();
  const req = request(app)[method](url)
    .set('Authorization', `Bearer ${token}`);
  
  if (data) {
    req.send(data);
  }
  
  return req;
}
```

## Performance Patterns

### Batch Processing

```typescript
export async function processBatch<T, R>(
  items: T[],
  processor: (batch: T[]) => Promise<R[]>,
  options: BatchOptions = {}
): Promise<R[]> {
  const { batchSize = 100, concurrency = 5 } = options;
  
  const batches = chunk(items, batchSize);
  const results: R[] = [];
  
  // Process batches with concurrency limit
  for (let i = 0; i < batches.length; i += concurrency) {
    const batchPromises = batches
      .slice(i, i + concurrency)
      .map(batch => processor(batch));
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.flat());
  }
  
  return results;
}
```

### Query Optimization

```typescript
// Use DataLoader to prevent N+1 queries
export function createDataLoader<K, V>(
  batchFn: (keys: K[]) => Promise<V[]>
): DataLoader<K, V> {
  return new DataLoader(batchFn, {
    cache: true,
    maxBatchSize: 100
  });
}

// Example usage
const contactLoader = createDataLoader(async (ids: string[]) => {
  const contacts = await prisma.contact.findMany({
    where: { id: { in: ids } }
  });
  
  // Ensure same order as requested
  const contactMap = new Map(contacts.map(c => [c.id, c]));
  return ids.map(id => contactMap.get(id) || null);
});
```

## Security Patterns

### Input Sanitization

```typescript
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['b', 'i', 'u', 'a', 'br', 'p', 'strong', 'em'],
    ALLOWED_ATTR: ['href', 'target']
  });
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .substring(0, 255);
}
```

### Rate Limiting

```typescript
export function createRateLimiter(options: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = options.keyGenerator(req);
    const limit = options.limit;
    const window = options.window;
    
    const current = await redis.incr(key);
    
    if (current === 1) {
      await redis.expire(key, window);
    }
    
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - current));
    
    if (current > limit) {
      throw new RateLimitError(new Date(Date.now() + window * 1000));
    }
    
    next();
  };
}
```

---

By following these common patterns, we ensure consistency across all features and make the codebase more maintainable and robust.