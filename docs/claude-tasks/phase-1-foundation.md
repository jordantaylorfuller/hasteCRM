# Phase 1: Foundation Setup Tasks

## 🎯 Phase Overview

**Duration**: 2 weeks  
**Priority**: Critical  
**Dependencies**: None  
**Success Criteria**: All tests passing, core infrastructure operational  
**Team Size**: 1-2 developers  

Phase 1 establishes the core infrastructure and basic functionality for the hasteCRM system. This phase focuses on setting up the essential components that all other features will build upon, with an emphasis on scalability, security, and developer experience.

## 📋 Goals

- [ ] Set up monorepo project structure with proper tooling
- [ ] Implement secure authentication and authorization system
- [ ] Create multi-tenant workspace management
- [ ] Establish scalable database schema with migrations
- [ ] Set up GraphQL API with type safety
- [ ] Implement comprehensive security measures
- [ ] Create automated testing infrastructure
- [ ] Set up monitoring and observability

## 🚀 Prerequisites

Before starting Phase 1, ensure you have:
- Node.js 18+ and pnpm 8+ installed
- Docker Desktop running
- PostgreSQL 15+ and Redis 7+ (via Docker)
- Git configured with proper credentials
- VS Code with recommended extensions

## 📝 Detailed Tasks

> **Important**: All version numbers and technical specifications must align with [MASTER-CONFIG.md](../MASTER-CONFIG.md)

### 1. Project Setup (Day 1-2)

#### 1.1 Monorepo Initialization
```bash
# Execute these commands for Claude Code
mkdir hasteCRM && cd hasteCRM
npx create-turbo@latest
```

**Tasks:**
- [ ] Initialize Turborepo monorepo structure
- [ ] Create workspace packages:
  - [ ] `apps/web` - Next.js 14 frontend
  - [ ] `apps/api` - NestJS backend
  - [ ] `apps/workers` - Background job processors
  - [ ] `packages/database` - Prisma schemas
  - [ ] `packages/types` - Shared TypeScript types
  - [ ] `packages/ui` - Shared UI components
  - [ ] `packages/utils` - Shared utilities
- [ ] Configure TypeScript with strict mode
- [ ] Set up path aliases for clean imports
- [ ] Create shared ESLint and Prettier configs

**Verification:**
```bash
pnpm build # Should build all packages
pnpm lint  # Should lint all packages
pnpm test  # Should run all tests
```

#### 1.2 Development Environment
- [ ] Create `docker-compose.yml` with:
  ```yaml
  version: '3.8'
  services:
    postgres:
      image: postgres:15-alpine
      environment:
        POSTGRES_DB: hasteCRM_dev
        POSTGRES_USER: postgres
        POSTGRES_PASSWORD: change-me-in-production
      ports:
        - "5432:5432"
      volumes:
        - postgres_data:/var/lib/postgresql/data
    
    redis:
      image: redis:7-alpine
      ports:
        - "6379:6379"
      volumes:
        - redis_data:/data
    
    mailhog:
      image: mailhog/mailhog
      ports:
        - "1025:1025"
        - "8025:8025"
  
  volumes:
    postgres_data:
    redis_data:
  ```
- [ ] Create `.env.example` with all required variables
- [ ] Set up Git hooks with Husky:
  - [ ] Pre-commit: lint-staged
  - [ ] Commit-msg: conventional commits
  - [ ] Pre-push: type checking
- [ ] Configure VS Code workspace settings
- [ ] Create development scripts in package.json

### 2. Database Foundation (Day 3-4)

#### 2.1 Prisma Setup
```bash
# In packages/database
pnpm add -D prisma @prisma/client
npx prisma init
```

#### 2.2 Core Schema Design
Create comprehensive schema in `packages/database/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Multi-tenant workspace
model Workspace {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  plan        Plan     @default(FREE)
  
  // Settings
  settings    Json     @default("{}")
  features    Json     @default("{}")
  
  // Limits
  maxUsers    Int      @default(5)
  maxContacts Int      @default(1000)
  
  // Relations
  users       User[]
  invitations Invitation[]
  apiKeys     ApiKey[]
  auditLogs   AuditLog[]
  
  // Timestamps
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([slug])
}

model User {
  id              String    @id @default(cuid())
  email           String    @unique
  emailVerified   Boolean   @default(false)
  
  // Profile
  firstName       String?
  lastName        String?
  avatar          String?
  
  // Auth
  passwordHash    String?
  googleId        String?   @unique
  
  // Workspace
  workspaceId     String
  workspace       Workspace @relation(fields: [workspaceId], references: [id])
  role            Role      @default(MEMBER)
  
  // Security
  twoFactorEnabled Boolean  @default(false)
  twoFactorSecret  String?
  
  // Relations
  sessions        Session[]
  activities      Activity[]
  
  // Timestamps
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  lastLoginAt     DateTime?
  
  @@index([workspaceId])
  @@index([email])
}

enum Plan {
  FREE
  STARTER
  PROFESSIONAL
  ENTERPRISE
}

enum Role {
  OWNER
  ADMIN
  MEMBER
  VIEWER
}
```

**Tasks:**
- [ ] Create complete schema with all models
- [ ] Add proper indexes for performance
- [ ] Set up migration system
- [ ] Create seed data script
- [ ] Configure Prisma client generation
- [ ] Add database backup strategy

### 3. Authentication System (Day 5-6)

#### 3.1 NestJS Auth Module
Create comprehensive auth module in `apps/api/src/modules/auth`:

```typescript
// auth.module.ts
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { 
          expiresIn: '15m', // Per MASTER-CONFIG.md
          algorithm: 'RS256' 
        },
      }),
      inject: [ConfigService],
    }),
    PassportModule,
    PrismaModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    GoogleStrategy,
    RefreshTokenStrategy,
  ],
  exports: [AuthService],
})
export class AuthModule {}
```

**Tasks:**
- [ ] Implement JWT authentication with refresh tokens
- [ ] Create secure password hashing with bcrypt
- [ ] Add Google OAuth integration
- [ ] Implement email verification flow
- [ ] Create password reset functionality
- [ ] Add two-factor authentication support
- [ ] Implement session management with Redis
- [ ] Create rate limiting for auth endpoints

#### 3.2 Security Features
- [ ] Implement refresh token rotation
- [ ] Add device tracking
- [ ] Create suspicious login detection
- [ ] Implement account lockout after failed attempts
- [ ] Add email notifications for security events

### 4. Authorization Framework (Day 7)

#### 4.1 RBAC Implementation
```typescript
// decorators/roles.decorator.ts
export const RequireRoles = (...roles: Role[]) => 
  SetMetadata('roles', roles);

// decorators/permissions.decorator.ts
export const RequirePermissions = (...permissions: string[]) => 
  SetMetadata('permissions', permissions);

// guards/auth.guard.ts
@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Implementation
  }
}
```

**Tasks:**
- [ ] Create role-based access control system
- [ ] Implement permission-based authorization
- [ ] Add workspace-level isolation
- [ ] Create resource ownership checks
- [ ] Implement field-level permissions
- [ ] Add audit logging for authorization

### 5. GraphQL API Framework (Day 8-9)

#### 5.1 GraphQL Setup
```typescript
// apps/api/src/app.module.ts
@Module({
  imports: [
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      useFactory: (config: ConfigService) => ({
        autoSchemaFile: true,
        sortSchema: true,
        playground: config.get('NODE_ENV') !== 'production',
        introspection: true,
        context: ({ req, res }) => ({ req, res }),
        plugins: [
          ApolloServerPluginLandingPageLocalDefault(),
        ],
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

**Tasks:**
- [ ] Set up Apollo Server with NestJS
- [ ] Create GraphQL schema with code-first approach
- [ ] Implement DataLoader for N+1 prevention
- [ ] Add query complexity analysis
- [ ] Create custom scalars (DateTime, JSON, etc.)
- [ ] Implement field-level resolvers
- [ ] Add GraphQL subscriptions support
- [ ] Create error handling and formatting

### 6. User Management (Day 10)

#### 6.1 User Service Implementation
```typescript
@Injectable()
export class UserService {
  constructor(
    private prisma: PrismaService,
    private eventBus: EventBus,
  ) {}

  async create(data: CreateUserDto): Promise<User> {
    // Validate workspace limits
    await this.validateWorkspaceLimits(data.workspaceId);
    
    // Create user with transaction
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data });
      
      // Emit event
      await this.eventBus.emit(new UserCreatedEvent(created));
      
      return created;
    });
    
    return user;
  }
}
```

**Tasks:**
- [ ] Create comprehensive user CRUD operations
- [ ] Implement user profile management
- [ ] Add workspace invitation system
- [ ] Create user search with filters
- [ ] Implement user activity tracking
- [ ] Add bulk user operations
- [ ] Create user export functionality

### 7. Security Implementation (Day 11)

#### 7.1 Security Middleware
```typescript
// Security configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(compression());
app.use(cors(corsOptions));
app.use(rateLimit(rateLimitOptions));
```

**Tasks:**
- [ ] Configure HTTPS/TLS with cert management
- [ ] Implement rate limiting with Redis
- [ ] Set up CORS with proper origins
- [ ] Configure security headers
- [ ] Add request validation with class-validator
- [ ] Implement SQL injection prevention
- [ ] Create XSS protection
- [ ] Set up comprehensive audit logging
- [ ] Add API key management

### 8. Testing Foundation (Day 12)

#### 8.1 Test Setup
```typescript
// test/setup.ts
beforeAll(async () => {
  await prisma.$connect();
  await seedTestDatabase();
});

afterAll(async () => {
  await cleanupTestDatabase();
  await prisma.$disconnect();
});
```

**Tasks:**
- [ ] Configure Jest with TypeScript
- [ ] Create test database strategy
- [ ] Set up test data factories
- [ ] Implement unit test structure
- [ ] Add integration test helpers
- [ ] Create E2E test setup with Supertest
- [ ] Add test coverage reporting
- [ ] Implement continuous testing in CI

### 9. Monitoring & Observability (Day 13)

#### 9.1 Logging Setup
```typescript
// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'api' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});
```

**Tasks:**
- [ ] Set up structured logging with Winston
- [ ] Implement distributed tracing
- [ ] Add error tracking with Sentry
- [ ] Create performance monitoring
- [ ] Implement health check endpoints
- [ ] Set up metrics with Prometheus
- [ ] Create custom dashboards
- [ ] Add alerting rules

### 10. Documentation (Day 14)

**Tasks:**
- [ ] Generate API documentation with Swagger
- [ ] Create GraphQL schema documentation
- [ ] Write comprehensive README files
- [ ] Document architecture decisions (ADRs)
- [ ] Create development setup guide
- [ ] Add deployment documentation
- [ ] Create troubleshooting guide
- [ ] Document security practices

## ✅ Definition of Done

Each task must meet these criteria:
1. **Code Complete**: Feature implemented and working
2. **Tests Written**: Unit and integration tests with >80% coverage
3. **Documentation**: Code documented and API docs updated
4. **Code Review**: Peer reviewed and approved
5. **Security Check**: Passed security checklist
6. **Performance**: Meets performance benchmarks

## 📊 Success Metrics

- **Authentication**: <200ms response time for auth endpoints
- **API Performance**: <100ms p95 latency for GraphQL queries
- **Test Coverage**: >80% code coverage
- **Security**: Pass OWASP Top 10 checklist
- **Uptime**: 99.9% availability in development
- **Developer Experience**: <5 minutes to onboard new developer

## 🔄 Daily Checklist

```markdown
### Day Start
- [ ] Pull latest changes
- [ ] Check CI/CD status
- [ ] Review assigned tasks
- [ ] Update task board

### During Development
- [ ] Write tests first (TDD)
- [ ] Commit frequently with conventional commits
- [ ] Update documentation as you go
- [ ] Run tests before pushing

### Day End
- [ ] Push all changes
- [ ] Update task status
- [ ] Note any blockers
- [ ] Plan next day's tasks
```

## 🚨 Common Pitfalls to Avoid

1. **Don't skip tests** - Write tests as you go, not after
2. **Don't hardcode values** - Use environment variables
3. **Don't ignore TypeScript errors** - Fix them immediately
4. **Don't bypass security** - Always use proper authentication
5. **Don't forget indexes** - Add them during schema design

## 📈 Progress Tracking

Use this template for daily updates:
```markdown
## Date: YYYY-MM-DD

### Completed
- Task 1
- Task 2

### In Progress
- Task 3 (70% complete)

### Blockers
- Issue with X

### Next
- Task 4
- Task 5
```

## 🎯 Phase Completion Checklist

Before moving to Phase 2, ensure:
- [ ] All tasks completed and tested
- [ ] Documentation is comprehensive
- [ ] Security audit passed
- [ ] Performance benchmarks met
- [ ] Code review completed
- [ ] No critical bugs
- [ ] Monitoring is operational
- [ ] Team handoff completed

## 📚 Resources

### Documentation
- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [GraphQL Best Practices](https://graphql.org/learn/best-practices/)
- [OWASP Security Guide](https://owasp.org/www-project-web-security-testing-guide/)

### Internal Docs
- [Architecture Overview](../architecture/overview.md)
- [Database Schema](../architecture/database-schema.md)
- [API Design](../architecture/api-design.md)
- [Security Guidelines](../architecture/security.md)

## ➡️ Next Phase

**Phase 2: Contact Management** - Building upon the foundation to add core CRM functionality including contact CRUD, search, and activity tracking.

---

*Last Updated: 2024-01-15*  
*Documentation Version: 1.0*