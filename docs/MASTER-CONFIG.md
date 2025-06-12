# Master Configuration & Standards

**IMPORTANT**: This is the single source of truth for all technical specifications, versions, and configurations in the hasteCRM project. All other documentation must reference this file for version numbers and technical standards.

**Last Updated**: 2024-01-15  
**Platform Version**: 1.0.0  
**API Version**: 1.0.0  
**Documentation Version**: 1.0.0

## Technology Stack

### Core Runtime
- **Node.js**: 18.19.0 LTS (exact version for consistency)
- **pnpm**: 8.14.0 (exact version for consistency)
- **TypeScript**: 5.3.3 (exact version for consistency)
- **Turborepo**: 1.11.3 (monorepo orchestration)

### Infrastructure
- **Docker**: 24.0.7 (minimum 24.0.0)
- **Docker Compose**: 2.23.3 (minimum 2.20.0)
- **Kubernetes**: 1.28.4 (for production deployments)

### Databases
- **PostgreSQL**: 15.5 (exact version)
  - Extensions: pgvector 0.5.1, uuid-ossp, pg_trgm
- **Redis**: 7.2.4 (exact version)
  - Cluster mode for staging/production
  - Single instance for development
- **Elasticsearch**: 8.11.1 (exact version)
  - Used for full-text search and analytics
  - Single node for development
  - Cluster for production

### API Architecture

#### Primary API Strategy
hasteCRM uses a **hybrid API approach** optimized for different use cases:

1. **GraphQL** (Primary Interface)
   - Used for: Complex queries, real-time subscriptions, frontend data fetching
   - Endpoint: `/graphql`
   - Version: Unversioned (schema evolution via deprecation)

2. **REST API** (Specialized Operations)
   - Used for: File uploads, webhooks, OAuth callbacks, exports, legacy integrations
   - Base Path: `/v1`
   - Version: v1 (versioned endpoints)

3. **WebSocket** (Real-time)
   - Used for: Live updates, collaboration features
   - Endpoint: `/ws`

### Authentication & Security

#### JWT Configuration
- **Algorithm**: RS256
- **Access Token Expiry**: 15 minutes
- **Refresh Token Expiry**: 7 days
- **Token Rotation**: Enabled in production

#### OAuth Providers
- Google Workspace (primary)
- Microsoft 365
- LinkedIn (optional)

### Rate Limiting

#### Standard Limits
| Endpoint Type | Authenticated | Unauthenticated |
|--------------|---------------|-----------------|
| GraphQL | 1000 req/min | 100 req/min |
| REST API | 500 req/min | 50 req/min |
| WebSocket | 100 msg/min | N/A |
| File Upload | 10 req/min | N/A |

#### Implementation
- Window: 60 seconds (sliding window)
- Storage: Redis
- Headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset

### Monitoring Stack

#### Production Stack
- **APM**: Datadog (primary)
- **Error Tracking**: Sentry
- **Logs**: Datadog Logs
- **Uptime**: Datadog Synthetics
- **Custom Metrics**: StatsD -> Datadog

#### Development Stack
- **APM**: Local Jaeger
- **Logs**: Console + File
- **Metrics**: Prometheus + Grafana (optional)

### Email Configuration

#### Providers by Environment
| Environment | Inbound | Outbound |
|------------|---------|----------|
| Development | Gmail API | Mailhog (SMTP) |
| Staging | Gmail API | SendGrid |
| Production | Gmail API | AWS SES |

### File Storage

#### Storage Backends
| Environment | Provider | Configuration |
|------------|----------|---------------|
| Development | MinIO | Local S3-compatible |
| Staging | AWS S3 | Dedicated bucket |
| Production | AWS S3 + CloudFront | CDN-enabled |

### Feature Flags

#### Implementation
- **Production**: LaunchDarkly
- **Staging**: LaunchDarkly (separate project)
- **Development**: Environment variables

### Code Standards

#### Import Conventions
```typescript
// 1. External imports
import { Injectable } from '@nestjs/common';

// 2. Internal absolute imports (using @/ alias)
import { DatabaseService } from '@/shared/database';

// 3. Relative imports (only for same module)
import { ContactEntity } from './contact.entity';
```

#### Async Patterns
- **Preferred**: async/await for all asynchronous operations
- **Exceptions**: Streams, EventEmitters

### Performance Targets

#### API Response Times (p95)
- GraphQL Query: < 100ms
- GraphQL Mutation: < 200ms
- REST Endpoint: < 150ms
- WebSocket Message: < 50ms

#### Infrastructure Targets
- Container Startup: < 30s
- Database Connection Pool: 20-100 connections
- Redis Connection Pool: 10-50 connections

### Deployment Configuration

#### Container Registry
- **Production**: AWS ECR (private)
- **Staging**: AWS ECR (private)
- **Development**: Local Docker daemon

#### Image Naming Convention
```
[registry]/hastecrm/[service]:[tag]

Examples:
- 123456789.dkr.ecr.us-east-1.amazonaws.com/hastecrm/api:v1.0.0
- 123456789.dkr.ecr.us-east-1.amazonaws.com/hastecrm/web:latest
```

### Testing Requirements

#### Coverage Targets
- **Unit Tests**: 80% minimum
- **Integration Tests**: 60% minimum
- **E2E Tests**: Critical paths only

#### Test Frameworks
- **Unit**: Jest 29.x
- **Integration**: Jest + Supertest
- **E2E**: Playwright 1.40.x

### Security Standards

#### OWASP Compliance
- Input validation on all endpoints
- SQL injection prevention via parameterized queries
- XSS prevention via content security policy
- CSRF protection on state-changing operations

#### Encryption
- **At Rest**: AES-256-GCM
- **In Transit**: TLS 1.3 minimum
- **Passwords**: Argon2id
- **API Keys**: HMAC-SHA256

### Documentation Standards

#### Version Format
- **Platform**: Semantic versioning (1.0.0)
- **API**: Major version only (v1)
- **Docs**: Aligned with platform version

#### Update Protocol
1. Update this master config first
2. Update affected documentation
3. Include change reason in commit

### Framework Versions

#### Backend (NestJS)
- **NestJS**: 10.3.0
- **@nestjs/graphql**: 12.0.11
- **@nestjs/apollo**: 12.0.11
- **Apollo Server**: 3.12.1
- **Prisma**: 5.7.1
- **BullMQ**: 5.1.1

#### Frontend (Next.js)
- **Next.js**: 14.0.4
- **React**: 18.2.0
- **React DOM**: 18.2.0
- **Zustand**: 4.4.7
- **@tanstack/react-query**: 5.17.1
- **Shadcn/ui**: Latest components
- **Tailwind CSS**: 3.4.0

#### Testing
- **Jest**: 29.7.0
- **React Testing Library**: 14.1.2
- **Playwright**: 1.40.1
- **MSW (Mock Service Worker)**: 2.0.11

#### Development Tools
- **ESLint**: 8.56.0
- **Prettier**: 3.1.1
- **Husky**: 8.0.3
- **lint-staged**: 15.2.0

## Change Log

### 2024-01-15 (Update 2)
- Added exact versions for all core dependencies
- Added Turborepo version
- Added Elasticsearch configuration
- Added framework-specific versions

### 2024-01-15
- Initial master configuration document
- Consolidated all version specifications
- Clarified API strategy and monitoring stack