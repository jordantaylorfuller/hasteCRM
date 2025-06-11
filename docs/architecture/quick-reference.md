# Architecture Quick Reference Guide

## 🏗️ System Overview
- **Architecture**: Microservices with AI integration
- **Frontend**: Next.js 14 (App Router)
- **Backend**: NestJS with GraphQL
- **Database**: PostgreSQL 15+ with pgvector
- **Cache**: Redis 7.2+
- **Queue**: BullMQ
- **Container**: Docker + Kubernetes

## 🔗 API Design
### GraphQL (Primary)
- **Endpoint**: `/graphql`
- **Auth**: JWT Bearer tokens
- **Subscriptions**: WebSocket for real-time

### REST (Secondary)
- **File uploads**: `/api/v1/files/upload`
- **Webhooks**: `/api/v1/webhooks`
- **OAuth**: `/api/v1/auth/{provider}/callback`

## 💾 Database Schema
### Core Tables
- `workspaces` - Multi-tenancy root
- `users` - User accounts
- `contacts` - CRM contacts
- `companies` - Organizations
- `deals` - Sales pipeline deals
- `emails` - Email communications
- `activities` - Activity tracking

### Key Features
- Row-level security (RLS)
- JSONB for custom fields
- pgvector for AI embeddings
- Time-based partitioning for activities

## 🔐 Security Architecture
### Authentication
- JWT tokens (1hr access, 7d refresh)
- OAuth 2.0 (Google, Microsoft)
- MFA with TOTP
- API keys for integrations

### Security Layers
1. WAF & DDoS protection (Cloudflare)
2. API Gateway with rate limiting
3. Service mesh with mTLS
4. Database encryption at rest
5. Network segmentation

## 🚀 Performance Targets
- GraphQL queries: <100ms (p95)
- API mutations: <200ms (p95)
- WebSocket messages: <50ms (p95)
- Email processing: 10,000/minute
- Concurrent WebSockets: 50,000

## 🔄 Service Communication
### Synchronous
- GraphQL for client-server
- gRPC for internal services
- REST for file operations

### Asynchronous
- Redis Pub/Sub for events
- BullMQ for background jobs
- WebSockets for real-time

## 📦 Deployment
### Environments
- **Development**: Docker Compose
- **Staging**: Kubernetes (single region)
- **Production**: Kubernetes (multi-region)

### Key Services
```yaml
web:        Port 3000 (Next.js)
api:        Port 4000 (NestJS)
postgres:   Port 5432
redis:      Port 6379
```

## 🎯 Quick Commands
```bash
# Local development
docker-compose up -d
pnpm dev

# Run migrations
pnpm prisma migrate dev

# Generate GraphQL types
pnpm codegen

# Build for production
pnpm build

# Deploy to Kubernetes
kubectl apply -f k8s/
```

## 📊 Monitoring
- **Metrics**: Prometheus + Grafana
- **Logs**: ELK Stack
- **Traces**: OpenTelemetry + Jaeger
- **Alerts**: PagerDuty for critical
- **APM**: DataDog or New Relic

## 🔧 Common Tasks

### Add a new service
1. Create service in `services/` directory
2. Add to `docker-compose.yml`
3. Add Kubernetes manifests
4. Update service mesh config
5. Add monitoring dashboards

### Add a new API endpoint
1. Define GraphQL schema
2. Implement resolver
3. Add tests
4. Update API documentation
5. Deploy through CI/CD

### Database migration
1. Create migration: `pnpm prisma migrate dev --name {name}`
2. Test locally
3. Review generated SQL
4. Apply to staging
5. Apply to production

## 🚨 Emergency Procedures

### Service down
1. Check health endpoints
2. Review logs in Grafana
3. Check resource utilization
4. Restart if necessary
5. Escalate if persists

### Database issues
1. Check connection pool
2. Review slow query log
3. Check disk space
4. Scale if needed
5. Failover to replica if critical

### High load
1. Check rate limiting
2. Scale horizontally
3. Enable caching
4. Review slow endpoints
5. Enable emergency mode

## 📚 Further Reading
- [Full Architecture Overview](./overview.md)
- [API Design Details](./api-design.md)
- [Database Schema](./database-schema.md)
- [Security Guide](./security.md)