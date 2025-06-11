# Master Configuration & Standards

**IMPORTANT**: This is the single source of truth for all technical specifications, versions, and configurations in the hasteCRM project. All other documentation must reference this file for version numbers and technical standards.

**Last Updated**: 2024-01-15  
**Platform Version**: 1.0.0  
**API Version**: 1.0.0  
**Documentation Version**: 1.0.0

## Technology Stack

### Core Runtime
- **Node.js**: 18.x LTS (minimum 18.17.0)
- **pnpm**: 8.x (minimum 8.6.0)
- **TypeScript**: 5.x (minimum 5.2.0)

### Infrastructure
- **Docker**: 24.x (minimum 24.0.0)
- **Docker Compose**: 2.x (minimum 2.20.0)
- **Kubernetes**: 1.28+ (for production deployments)

### Databases
- **PostgreSQL**: 15.x (minimum 15.0)
  - Extensions: pgvector 0.5.x, uuid-ossp, pg_trgm
- **Redis**: 7.x (minimum 7.0.0)
  - Cluster mode for staging/production
  - Single instance for development

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

## Change Log

### 2024-01-15
- Initial master configuration document
- Consolidated all version specifications
- Clarified API strategy and monitoring stack