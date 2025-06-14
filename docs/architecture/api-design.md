# API Design Principles

## Table of Contents
1. [Overview](#overview)
2. [API Architecture](#api-architecture)
3. [GraphQL Design Patterns](#graphql-design-patterns)
4. [REST API Design](#rest-api-design)
5. [Authentication & Authorization](#authentication--authorization)
6. [Error Handling](#error-handling)
7. [Performance Considerations](#performance-considerations)
8. [Real-time Features](#real-time-features)
9. [Versioning Strategy](#versioning-strategy)
10. [Security Best Practices](#security-best-practices)
11. [Testing Strategies](#testing-strategies)
12. [API Documentation](#api-documentation)

## Overview

The hasteCRM uses a hybrid API architecture combining GraphQL for flexible queries and REST for specific operations. This design provides optimal performance, developer experience, and maintainability while supporting our AI-first approach.

### Core Principles
- **GraphQL First**: Primary API interface for all client interactions
- **REST for Specifics**: File uploads, webhooks, OAuth callbacks
- **Type Safety**: Full TypeScript coverage with generated types
- **Performance**: Optimized queries with DataLoader and caching
- **Real-time**: WebSocket subscriptions for live updates
- **Security**: JWT authentication with fine-grained permissions

## API Architecture

### API Gateway Pattern
```
                                                     
   Client        �   API Gateway       �  Services   
  (Next.js)           (NestJS)           (Microsvcs) 
                                                     
                                                  
                            �                      
                                                
                  �   Auth Layer                
                      (JWT + OAuth)  
                                     
```

### Service Communication
```typescript
// Internal service communication
interface ServiceCommunication {
  protocol: 'gRPC' | 'REST' | 'MessageQueue';
  authentication: 'mTLS' | 'ServiceToken';
  format: 'protobuf' | 'JSON';
}

// Service registry
const services = {
  auth: { url: 'auth-service:50051', protocol: 'gRPC' },
  contact: { url: 'contact-service:3001', protocol: 'REST' },
  email: { url: 'email-service:3002', protocol: 'REST' },
  ai: { url: 'ai-service:50052', protocol: 'gRPC' },
  pipeline: { url: 'pipeline-service:3003', protocol: 'REST' }
};
```

## GraphQL Design Patterns

### Schema Organization
```graphql
# Root schema
type Query {
  # User queries
  me: User!
  user(id: ID!): User
  users(filter: UserFilter, pagination: PaginationInput): UserConnection!
  
  # Contact queries
  contact(id: ID!): Contact
  contacts(filter: ContactFilter, pagination: PaginationInput): ContactConnection!
  searchContacts(query: String!, limit: Int = 10): [Contact!]!
  
  # Pipeline queries
  pipeline(id: ID!): Pipeline
  pipelines(type: PipelineType): [Pipeline!]!
  deals(filter: DealFilter, pagination: PaginationInput): DealConnection!
  
  # Email queries
  email(id: ID!): Email
  emails(filter: EmailFilter, pagination: PaginationInput): EmailConnection!
  emailThreads(contactId: ID!): [EmailThread!]!
  
  # Analytics queries
  analytics(type: AnalyticsType!, dateRange: DateRangeInput!): Analytics!
  dashboardMetrics: DashboardMetrics!
}

type Mutation {
  # Authentication
  login(email: String!, password: String!): AuthPayload!
  logout: Boolean!
  refreshToken(token: String!): AuthPayload!
  
  # Contact mutations
  createContact(input: CreateContactInput!): Contact!
  updateContact(id: ID!, input: UpdateContactInput!): Contact!
  deleteContact(id: ID!): Boolean!
  bulkUpdateContacts(ids: [ID!]!, input: BulkUpdateInput!): BulkUpdateResult!
  
  # Pipeline mutations
  createDeal(input: CreateDealInput!): Deal!
  updateDeal(id: ID!, input: UpdateDealInput!): Deal!
  moveDealToStage(dealId: ID!, stageId: ID!): Deal!
  
  # Email mutations
  sendEmail(input: SendEmailInput!): Email!
  createEmailCampaign(input: CreateCampaignInput!): EmailCampaign!
  
  # AI mutations
  generateEmailContent(context: EmailContextInput!): GeneratedContent!
  analyzeEmail(emailId: ID!): EmailAnalysis!
}

type Subscription {
  # Real-time updates
  dealUpdated(pipelineId: ID!): Deal!
  emailReceived(workspaceId: ID!): Email!
  contactActivity(contactId: ID!): Activity!
  notificationReceived: Notification!
}
```

### Connection Pattern for Pagination
```graphql
# Relay-style cursor pagination
type ContactConnection {
  edges: [ContactEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type ContactEdge {
  node: Contact!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

# Usage
query GetContacts($first: Int!, $after: String) {
  contacts(first: $first, after: $after, filter: { status: ACTIVE }) {
    edges {
      node {
        id
        name
        email
        company
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
```

### DataLoader Pattern
```typescript
// Prevent N+1 queries
export class ContactLoader {
  private batchLoadFn = async (ids: string[]) => {
    const contacts = await this.prisma.contact.findMany({
      where: { id: { in: ids } }
    });
    
    // Map to preserve order
    const contactMap = new Map(contacts.map(c => [c.id, c]));
    return ids.map(id => contactMap.get(id));
  };
  
  loader = new DataLoader(this.batchLoadFn);
}

// In resolvers
@ResolveField()
async contact(@Parent() activity: Activity, @Context() ctx: Context) {
  return ctx.loaders.contact.load(activity.contactId);
}
```

### Input Validation
```graphql
input CreateContactInput {
  firstName: String! @constraint(minLength: 1, maxLength: 50)
  lastName: String! @constraint(minLength: 1, maxLength: 50)
  email: String! @constraint(format: "email")
  phone: String @constraint(pattern: "^\\+?[1-9]\\d{1,14}$")
  company: String @constraint(maxLength: 100)
  position: String @constraint(maxLength: 100)
  customFields: JSON @constraint(maxSize: 1000)
}

# Enum validations
enum ContactStatus {
  ACTIVE
  INACTIVE
  ARCHIVED
}

enum PipelineType {
  SALES
  RECRUITMENT
  INVESTOR
  VENDOR
  CUSTOM
}
```

### Field-Level Permissions
```graphql
type Contact @auth(requires: USER) {
  id: ID!
  email: String! @auth(requires: USER)
  phone: String @auth(requires: [USER, CONTACT_PHONE_VIEW])
  revenue: Float @auth(requires: [ADMIN, SALES_MANAGER])
  internalNotes: String @auth(requires: ADMIN)
}

# Directive implementation
@Directive('@auth')
export class AuthDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field: GraphQLFieldDef) {
    const { requires } = this.args;
    const { resolve = defaultFieldResolver } = field;
    
    field.resolve = async function(...args) {
      const context = args[2];
      
      if (!hasPermission(context.user, requires)) {
        throw new ForbiddenError('Insufficient permissions');
      }
      
      return resolve.apply(this, args);
    };
  }
}
```

## REST API Design

### RESTful Endpoints
```typescript
// File upload endpoint
POST /api/v1/files/upload
Content-Type: multipart/form-data
Authorization: Bearer {token}

{
  file: binary,
  type: "avatar" | "attachment" | "import",
  metadata: {
    contactId?: string,
    emailId?: string
  }
}

// Response
{
  id: "file_123",
  url: "https://cdn.example.com/files/file_123",
  size: 1024000,
  mimeType: "image/jpeg",
  metadata: { ... }
}

// Webhook registration
POST /api/v1/webhooks
{
  url: "https://example.com/webhook",
  events: ["contact.created", "deal.won", "email.received"],
  secret: "webhook_secret_key"
}

// OAuth callback
GET /api/v1/auth/google/callback?code={code}&state={state}

// Export endpoints
GET /api/v1/exports/contacts?format=csv&filter[status]=active
GET /api/v1/exports/deals/{exportId}/download
```

### Resource Naming
```typescript
// Consistent resource patterns
const apiRoutes = {
  // Collections
  'GET /contacts': 'List contacts',
  'POST /contacts': 'Create contact',
  
  // Individual resources
  'GET /contacts/:id': 'Get contact',
  'PUT /contacts/:id': 'Update contact',
  'PATCH /contacts/:id': 'Partial update',
  'DELETE /contacts/:id': 'Delete contact',
  
  // Sub-resources
  'GET /contacts/:id/activities': 'Get contact activities',
  'POST /contacts/:id/activities': 'Create activity',
  
  // Actions
  'POST /contacts/:id/archive': 'Archive contact',
  'POST /contacts/bulk/update': 'Bulk update',
  'POST /emails/send': 'Send email'
};
```

### Query Parameters
```typescript
// Filtering
GET /api/v1/contacts?filter[status]=active&filter[createdAfter]=2024-01-01

// Sorting
GET /api/v1/contacts?sort=-createdAt,lastName

// Pagination
GET /api/v1/contacts?page[limit]=20&page[offset]=40

// Field selection
GET /api/v1/contacts?fields=id,name,email,company

// Including relations
GET /api/v1/contacts?include=company,deals,activities

// Full example
GET /api/v1/contacts?
  filter[status]=active&
  filter[tag]=vip&
  sort=-lastContactedAt&
  page[limit]=10&
  include=company,recentActivities
```

## Authentication & Authorization

### JWT Token Structure
```typescript
interface JWTPayload {
  // User identification
  sub: string; // userId
  email: string;
  workspaceId: string;
  
  // Permissions
  roles: Role[];
  permissions: Permission[];
  
  // Token metadata
  iat: number; // Issued at
  exp: number; // Expiration
  jti: string; // JWT ID for revocation
  
  // Session info
  sessionId: string;
  deviceId?: string;
}

// Token generation
const generateTokens = (user: User) => {
  const payload: JWTPayload = {
    sub: user.id,
    email: user.email,
    workspaceId: user.workspaceId,
    roles: user.roles,
    permissions: user.permissions,
    sessionId: generateSessionId(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes
    jti: generateTokenId()
  };
  
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET);
  const refreshToken = jwt.sign(
    { sub: user.id, sessionId: payload.sessionId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  
  return { accessToken, refreshToken };
};
```

### Permission System
```typescript
// Role-based permissions
enum Role {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  USER = 'USER',
  VIEWER = 'VIEWER'
}

// Fine-grained permissions
enum Permission {
  // Contacts
  CONTACT_VIEW = 'contact:view',
  CONTACT_CREATE = 'contact:create',
  CONTACT_UPDATE = 'contact:update',
  CONTACT_DELETE = 'contact:delete',
  CONTACT_EXPORT = 'contact:export',
  
  // Deals
  DEAL_VIEW = 'deal:view',
  DEAL_CREATE = 'deal:create',
  DEAL_UPDATE = 'deal:update',
  DEAL_DELETE = 'deal:delete',
  DEAL_MOVE = 'deal:move',
  
  // Emails
  EMAIL_VIEW = 'email:view',
  EMAIL_SEND = 'email:send',
  EMAIL_CAMPAIGN = 'email:campaign',
  
  // Analytics
  ANALYTICS_VIEW = 'analytics:view',
  ANALYTICS_EXPORT = 'analytics:export'
}

// Permission checking
class PermissionGuard {
  canAccess(user: User, resource: Resource, action: Action): boolean {
    // Check role-based permissions
    if (this.hasRolePermission(user.roles, resource, action)) {
      return true;
    }
    
    // Check explicit permissions
    const requiredPermission = `${resource}:${action}`;
    if (user.permissions.includes(requiredPermission)) {
      return true;
    }
    
    // Check resource ownership
    if (action === 'view' || action === 'update') {
      return this.isResourceOwner(user, resource);
    }
    
    return false;
  }
}
```

### API Key Authentication
```typescript
// API key for external integrations
interface APIKey {
  id: string;
  key: string; // Hashed
  name: string;
  workspaceId: string;
  permissions: Permission[];
  rateLimit: number;
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdBy: string;
}

// API key middleware
const apiKeyAuth = async (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return next();
  }
  
  const keyHash = hashAPIKey(apiKey);
  const keyRecord = await getAPIKey(keyHash);
  
  if (!keyRecord || keyRecord.expiresAt < new Date()) {
    throw new UnauthorizedError('Invalid API key');
  }
  
  // Set context
  req.context = {
    type: 'api_key',
    workspaceId: keyRecord.workspaceId,
    permissions: keyRecord.permissions,
    rateLimit: keyRecord.rateLimit
  };
  
  // Update last used
  await updateAPIKeyLastUsed(keyRecord.id);
  
  next();
};
```

## Error Handling

### Error Response Format
```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    requestId: string;
    path?: string;
  };
}

// GraphQL error format
interface GraphQLErrorResponse {
  errors: Array<{
    message: string;
    extensions: {
      code: string;
      timestamp: string;
      path?: string[];
      stacktrace?: string[]; // Only in development
    };
  }>;
  data: null | any;
}
```

### Error Codes
```typescript
enum ErrorCode {
  // Authentication errors (401)
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  
  // Authorization errors (403)
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // Validation errors (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // Resource errors (404)
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  
  // Conflict errors (409)
  CONFLICT = 'CONFLICT',
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',
  
  // Rate limiting (429)
  RATE_LIMITED = 'RATE_LIMITED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  
  // Server errors (500)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE'
}
```

### Error Handling Middleware
```typescript
// Global error handler
export class GlobalErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    
    let status = 500;
    let code = ErrorCode.INTERNAL_ERROR;
    let message = 'An unexpected error occurred';
    let details = {};
    
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      
      if (typeof response === 'object') {
        ({ code, message, ...details } = response as any);
      }
    }
    
    // Log error
    logger.error({
      code,
      message,
      status,
      path: request.url,
      method: request.method,
      requestId: request.id,
      userId: request.user?.id,
      error: exception
    });
    
    // Send response
    response.status(status).json({
      error: {
        code,
        message,
        details,
        timestamp: new Date().toISOString(),
        requestId: request.id,
        path: request.url
      }
    });
  }
}
```

### Validation Errors
```typescript
// Field validation errors
class ValidationError extends Error {
  constructor(public errors: Record<string, string[]>) {
    super('Validation failed');
  }
}

// Example validation error response
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "fields": {
        "email": ["Invalid email format", "Email already exists"],
        "phone": ["Invalid phone number format"],
        "customFields.budget": ["Must be a positive number"]
      }
    },
    "timestamp": "2024-01-10T10:30:00Z",
    "requestId": "req_123"
  }
}
```

## Performance Considerations

### Query Optimization
```typescript
// Query complexity analysis
const depthLimit = depthLimit(10);
const costAnalysis = costAnalysis({
  maximumCost: 1000,
  defaultCost: 1,
  scalarCost: 1,
  objectCost: 2,
  listFactor: 10,
  introspection: false,
  ignoreIntrospection: true
});

// Field cost calculation
type Contact @cost(complexity: 1) {
  id: ID!
  emails: [Email!]! @cost(complexity: 10)
  activities: [Activity!]! @cost(complexity: 20, multipliers: ["first"])
  deals: [Deal!]! @cost(complexity: 15, multipliers: ["first"])
}
```

### Caching Strategy
```typescript
// Response caching
interface CacheConfig {
  // Cache control headers
  public: boolean;
  private: boolean;
  maxAge: number; // seconds
  sMaxAge?: number; // CDN cache
  staleWhileRevalidate?: number;
  staleIfError?: number;
}

// Cache directives
type Query {
  # Public data - cache aggressively
  publicStats: Stats! @cacheControl(maxAge: 3600, public: true)
  
  # User-specific - private cache
  me: User! @cacheControl(maxAge: 60, private: true)
  
  # Real-time data - no cache
  liveMetrics: Metrics! @cacheControl(maxAge: 0)
}

// Redis caching layer
class CacheService {
  async get<T>(key: string): Promise<T | null> {
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }
  
  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    await redis.setex(key, ttl, JSON.stringify(value));
  }
  
  async invalidate(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length) {
      await redis.del(...keys);
    }
  }
}
```

### Database Query Optimization
```typescript
// Prisma query optimization
const contacts = await prisma.contact.findMany({
  where: { workspaceId, status: 'ACTIVE' },
  select: {
    id: true,
    name: true,
    email: true,
    // Only include relations if requested
    company: args.include?.includes('company') ? {
      select: { id: true, name: true }
    } : false,
    deals: args.include?.includes('deals') ? {
      select: { id: true, title: true, value: true },
      take: 5,
      orderBy: { createdAt: 'desc' }
    } : false
  },
  take: args.limit,
  skip: args.offset,
  orderBy: parseSort(args.sort)
});

// Index hints
const query = `
  SELECT /*+ INDEX(contacts idx_contacts_workspace_status) */
    c.*, 
    COUNT(DISTINCT d.id) as deal_count
  FROM contacts c
  LEFT JOIN deals d ON c.id = d.contact_id
  WHERE c.workspace_id = $1
  GROUP BY c.id
  ORDER BY c.created_at DESC
  LIMIT $2 OFFSET $3
`;
```

### Rate Limiting
```typescript
// Rate limit configuration
interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
  standardHeaders: boolean;
  legacyHeaders: boolean;
}

// Different limits for different operations
const rateLimits = {
  // Standard API calls
  standard: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    keyGenerator: (req) => req.user?.id || req.ip
  }),
  
  // Email sending
  emailSend: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50,
    message: 'Too many emails sent. Please try again later.'
  }),
  
  // File uploads
  fileUpload: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    message: 'File upload limit exceeded.'
  }),
  
  // AI operations
  aiOperations: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100,
    message: 'AI operation limit exceeded.',
    skip: (req) => req.user?.subscription === 'premium'
  })
};
```

## Real-time Features

### WebSocket Implementation
```typescript
// WebSocket gateway
@WebSocketGateway({
  cors: {
    origin: process.env.CLIENT_URL,
    credentials: true
  },
  transports: ['websocket', 'polling'],
  namespace: '/realtime'
})
export class RealtimeGateway {
  @WebSocketServer()
  server: Server;
  
  // Handle connection
  async handleConnection(client: Socket) {
    const token = client.handshake.auth.token;
    
    try {
      const user = await this.authService.verifyToken(token);
      client.data.user = user;
      
      // Join workspace room
      client.join(`workspace:${user.workspaceId}`);
      
      // Join personal room
      client.join(`user:${user.id}`);
      
      // Send connection confirmation
      client.emit('connected', {
        userId: user.id,
        workspaceId: user.workspaceId
      });
    } catch (error) {
      client.disconnect();
    }
  }
  
  // Broadcast updates
  async broadcastDealUpdate(deal: Deal, event: string) {
    this.server
      .to(`workspace:${deal.workspaceId}`)
      .emit('deal:updated', {
        event,
        dealId: deal.id,
        data: deal,
        timestamp: new Date()
      });
  }
}
```

### Subscription Management
```graphql
# GraphQL subscriptions
type Subscription {
  # Deal updates
  dealUpdated(pipelineId: ID!): DealUpdateEvent!
  
  # Email notifications
  emailReceived(folders: [EmailFolder!]): EmailEvent!
  
  # Contact activity
  contactActivity(contactId: ID!): ActivityEvent!
  
  # System notifications
  notification(types: [NotificationType!]): NotificationEvent!
}

# Event types
type DealUpdateEvent {
  type: DealEventType!
  deal: Deal!
  previousStage: Stage
  actor: User!
  timestamp: DateTime!
}

enum DealEventType {
  CREATED
  UPDATED
  MOVED
  WON
  LOST
  DELETED
}
```

### Pub/Sub Implementation
```typescript
// Redis pub/sub for scaling
class PubSubService {
  private publisher: RedisClient;
  private subscriber: RedisClient;
  
  async publish(channel: string, message: any) {
    await this.publisher.publish(
      channel,
      JSON.stringify(message)
    );
  }
  
  subscribe(channel: string, handler: (message: any) => void) {
    this.subscriber.subscribe(channel);
    
    this.subscriber.on('message', (receivedChannel, message) => {
      if (receivedChannel === channel) {
        handler(JSON.parse(message));
      }
    });
  }
  
  // Typed pub/sub
  async publishDealUpdate(deal: Deal, event: DealEventType) {
    await this.publish(`deals:${deal.workspaceId}`, {
      type: 'deal.updated',
      event,
      dealId: deal.id,
      stageId: deal.stageId,
      value: deal.value,
      timestamp: new Date()
    });
  }
}
```

## Versioning Strategy

### API Versioning
```typescript
// Version in URL path
app.use('/api/v1', v1Routes);
app.use('/api/v2', v2Routes);

// Version in header
const apiVersion = req.headers['api-version'] || 'v1';

// GraphQL schema versioning
const schema = buildSchema({
  typeDefs: [
    commonTypeDefs,
    versionedTypeDefs[version]
  ],
  resolvers: [
    commonResolvers,
    versionedResolvers[version]
  ]
});
```

### Backward Compatibility
```typescript
// Deprecation notices
type Contact {
  id: ID!
  # Deprecated field
  fullName: String! @deprecated(reason: "Use firstName and lastName")
  
  # New fields
  firstName: String!
  lastName: String!
}

// Field aliasing for compatibility
const resolvers = {
  Contact: {
    // Support old field name
    fullName: (contact) => `${contact.firstName} ${contact.lastName}`,
    
    // Map old field in input
    async updateContact(_, { input }) {
      if (input.fullName && !input.firstName) {
        const [firstName, ...rest] = input.fullName.split(' ');
        input.firstName = firstName;
        input.lastName = rest.join(' ');
      }
      
      return updateContact(input);
    }
  }
};
```

### Migration Strategy
```typescript
// API migration helpers
class APIMigration {
  // Transform old format to new
  static migrateContactV1toV2(v1Contact: ContactV1): ContactV2 {
    return {
      ...v1Contact,
      name: {
        first: v1Contact.firstName,
        last: v1Contact.lastName
      },
      communications: {
        emails: [{ address: v1Contact.email, primary: true }],
        phones: v1Contact.phone ? [{ number: v1Contact.phone, primary: true }] : []
      }
    };
  }
  
  // Version detection
  static detectVersion(data: any): string {
    if (data.communications) return 'v2';
    if (data.email) return 'v1';
    return 'unknown';
  }
}
```

## Security Best Practices

### Input Sanitization
```typescript
// Input validation and sanitization
class InputSanitizer {
  static sanitizeHTML(input: string): string {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a'],
      ALLOWED_ATTR: ['href']
    });
  }
  
  static sanitizeSQL(input: string): string {
    // Use parameterized queries instead
    return input.replace(/['";\\]/g, '');
  }
  
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  static validatePhoneNumber(phone: string): boolean {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
  }
}
```

### CORS Configuration
```typescript
const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      process.env.CLIENT_URL,
      'https://app.example.com',
      'https://staging.example.com'
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  exposedHeaders: ['X-Request-ID', 'X-RateLimit-Remaining'],
  maxAge: 86400 // 24 hours
};
```

### Security Headers
```typescript
// Helmet configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", process.env.API_URL],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Custom security headers
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});
```

### API Security Checklist
```typescript
// Security audit checklist
const securityChecklist = {
  authentication: {
    useHTTPS: true,
    jwtSecretStrength: 'strong', // 256+ bits
    tokenExpiration: true,
    refreshTokenRotation: true,
    passwordComplexity: true,
    bruteForceProtection: true
  },
  
  authorization: {
    principleOfLeastPrivilege: true,
    roleBasedAccess: true,
    resourceLevelPermissions: true,
    apiKeyScopeLimit: true
  },
  
  dataProtection: {
    encryptionAtRest: true,
    encryptionInTransit: true,
    personalDataMasking: true,
    auditLogging: true,
    dataRetentionPolicy: true
  },
  
  apiSecurity: {
    rateLimiting: true,
    inputValidation: true,
    outputEncoding: true,
    sqlInjectionPrevention: true,
    xssProtection: true,
    csrfProtection: true
  }
};
```

## Testing Strategies

### Unit Testing
```typescript
// GraphQL resolver testing
describe('ContactResolver', () => {
  let resolver: ContactResolver;
  let mockService: jest.Mocked<ContactService>;
  
  beforeEach(() => {
    mockService = createMockService(ContactService);
    resolver = new ContactResolver(mockService);
  });
  
  describe('createContact', () => {
    it('should create a contact with valid input', async () => {
      const input = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com'
      };
      
      const expectedContact = {
        id: 'contact_123',
        ...input,
        createdAt: new Date()
      };
      
      mockService.create.mockResolvedValue(expectedContact);
      
      const result = await resolver.createContact(input, mockContext);
      
      expect(result).toEqual(expectedContact);
      expect(mockService.create).toHaveBeenCalledWith(input, mockContext.user);
    });
    
    it('should throw validation error for invalid email', async () => {
      const input = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid-email'
      };
      
      await expect(resolver.createContact(input, mockContext))
        .rejects.toThrow(ValidationError);
    });
  });
});
```

### Integration Testing
```typescript
// API integration tests
describe('Contact API Integration', () => {
  let app: INestApplication;
  let token: string;
  
  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();
    
    app = moduleFixture.createNestApplication();
    await app.init();
    
    // Get auth token
    const authResponse = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation {
            login(email: "test@example.com", password: "password") {
              accessToken
            }
          }
        `
      });
    
    token = authResponse.body.data.login.accessToken;
  });
  
  describe('Contact CRUD', () => {
    it('should create and retrieve a contact', async () => {
      // Create contact
      const createResponse = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({
          query: `
            mutation CreateContact($input: CreateContactInput!) {
              createContact(input: $input) {
                id
                firstName
                lastName
                email
              }
            }
          `,
          variables: {
            input: {
              firstName: 'Jane',
              lastName: 'Smith',
              email: 'jane@example.com'
            }
          }
        });
      
      expect(createResponse.status).toBe(200);
      expect(createResponse.body.data.createContact).toMatchObject({
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com'
      });
      
      const contactId = createResponse.body.data.createContact.id;
      
      // Retrieve contact
      const getResponse = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({
          query: `
            query GetContact($id: ID!) {
              contact(id: $id) {
                id
                firstName
                lastName
                email
              }
            }
          `,
          variables: { id: contactId }
        });
      
      expect(getResponse.body.data.contact.id).toBe(contactId);
    });
  });
  
  afterAll(async () => {
    await app.close();
  });
});
```

### Load Testing
```typescript
// k6 load test script
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp up more
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'],    // Error rate under 10%
  },
};

const BASE_URL = 'https://api.example.com';
const AUTH_TOKEN = __ENV.AUTH_TOKEN;

export default function () {
  // Test contact list endpoint
  const listResponse = http.post(
    `${BASE_URL}/graphql`,
    JSON.stringify({
      query: `
        query {
          contacts(first: 20) {
            edges {
              node {
                id
                name
                email
              }
            }
          }
        }
      `
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
    }
  );
  
  check(listResponse, {
    'list status is 200': (r) => r.status === 200,
    'list response time < 500ms': (r) => r.timings.duration < 500,
    'list has contacts': (r) => JSON.parse(r.body).data.contacts.edges.length > 0,
  });
  
  sleep(1);
}
```

### Contract Testing
```typescript
// Pact consumer test
describe('Contact API Consumer', () => {
  const provider = new Pact({
    consumer: 'Web Frontend',
    provider: 'Contact API',
    port: 1234,
    log: path.resolve(process.cwd(), 'logs', 'pact.log'),
    dir: path.resolve(process.cwd(), 'pacts'),
    logLevel: 'INFO',
  });
  
  beforeAll(() => provider.setup());
  afterEach(() => provider.verify());
  afterAll(() => provider.finalize());
  
  describe('get contact', () => {
    it('should return a contact', async () => {
      // Arrange
      const expectedContact = {
        id: '123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com'
      };
      
      await provider.addInteraction({
        state: 'a contact with ID 123 exists',
        uponReceiving: 'a request to get a contact',
        withRequest: {
          method: 'POST',
          path: '/graphql',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': like('Bearer token')
          },
          body: {
            query: `
              query GetContact($id: ID!) {
                contact(id: $id) {
                  id
                  firstName
                  lastName
                  email
                }
              }
            `,
            variables: { id: '123' }
          }
        },
        willRespondWith: {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            data: {
              contact: like(expectedContact)
            }
          }
        }
      });
      
      // Act
      const response = await getContact('123');
      
      // Assert
      expect(response).toEqual(expectedContact);
    });
  });
});
```

## API Documentation

### OpenAPI/Swagger
```yaml
openapi: 3.0.0
info:
  title: hasteCRM API
  version: 1.0.0
  description: |
    AI-powered CRM platform API documentation.
    
    ## Authentication
    All endpoints require authentication via JWT token in the Authorization header:
    ```
    Authorization: Bearer <token>
    ```
    
    ## Rate Limiting
    - Standard endpoints: 100 requests per 15 minutes
    - Email sending: 50 requests per hour
    - File uploads: 20 requests per hour
    
servers:
  - url: https://api.example.com/v1
    description: Production
  - url: https://staging-api.example.com/v1
    description: Staging
    
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      
  schemas:
    Contact:
      type: object
      properties:
        id:
          type: string
          format: uuid
        firstName:
          type: string
          minLength: 1
          maxLength: 50
        lastName:
          type: string
          minLength: 1
          maxLength: 50
        email:
          type: string
          format: email
        createdAt:
          type: string
          format: date-time
```

### GraphQL Documentation
```graphql
"""
The Contact type represents a person or organization in the CRM.
Contacts can be associated with deals, activities, and email communications.
"""
type Contact {
  """Unique identifier for the contact"""
  id: ID!
  
  """Contact's first name"""
  firstName: String!
  
  """Contact's last name"""
  lastName: String!
  
  """Primary email address"""
  email: String!
  
  """Phone number in E.164 format"""
  phone: String
  
  """Associated company"""
  company: Company
  
  """Current position/job title"""
  position: String
  
  """List of deals associated with this contact"""
  deals(
    """Filter deals by status"""
    status: DealStatus
    
    """Limit number of results"""
    first: Int = 10
  ): [Deal!]!
  
  """Recent activities for this contact"""
  activities(
    """Filter by activity type"""
    type: ActivityType
    
    """Limit number of results"""
    first: Int = 20
  ): [Activity!]!
  
  """Custom fields as JSON"""
  customFields: JSON
  
  """Creation timestamp"""
  createdAt: DateTime!
  
  """Last update timestamp"""
  updatedAt: DateTime!
}
```

### API Client SDKs
```typescript
// TypeScript SDK example
import { CRMClient } from '@hastecrm/sdk';

const client = new CRMClient({
  apiKey: process.env.CRM_API_KEY,
  environment: 'production'
});

// Type-safe API calls
const contacts = await client.contacts.list({
  filter: { status: 'active' },
  sort: ['-createdAt'],
  page: { limit: 20 }
});

const newContact = await client.contacts.create({
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  customFields: {
    source: 'Website',
    industry: 'Technology'
  }
});

// Real-time subscriptions
client.subscribe('contact.created', (contact) => {
  console.log('New contact:', contact);
});
```

### API Changelog
```markdown
# API Changelog

## v2.0.0 (2024-01-15)
### Breaking Changes
- Renamed `fullName` field to separate `firstName` and `lastName`
- Changed `phone` field format to E.164
- Removed deprecated `tags` field in favor of `labels`

### New Features
- Added GraphQL subscriptions for real-time updates
- Introduced bulk operations for contacts and deals
- Added AI-powered email generation endpoints

### Improvements
- Improved query performance with new caching layer
- Enhanced error messages with field-level details
- Added request ID to all responses for debugging

## v1.5.0 (2023-12-01)
### New Features
- Added pipeline analytics endpoints
- Introduced custom field support for all resources
- Added webhook management API

### Bug Fixes
- Fixed pagination cursor encoding issue
- Resolved timezone handling in date filters
- Fixed rate limiting counter reset
```

## Best Practices Summary

1. **Consistency**: Use consistent naming, patterns, and responses
2. **Documentation**: Keep API docs up-to-date with examples
3. **Versioning**: Plan for backward compatibility
4. **Security**: Implement defense in depth
5. **Performance**: Optimize queries and implement caching
6. **Error Handling**: Provide clear, actionable error messages
7. **Testing**: Comprehensive test coverage at all levels
8. **Monitoring**: Track API usage, performance, and errors

---

*API Design Principles v1.0*  
*Last Updated: January 2024*