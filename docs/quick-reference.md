# hasteCRM - Consolidated Quick Reference

## 🎯 Project Overview
**hasteCRM** - AI-powered platform with intelligent contact management, email integration, sales pipelines, and AI-driven insights.

> ⚠️ **Status**: Currently in planning phase - implementation not yet started

## 🏗️ Tech Stack
- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: NestJS, GraphQL, Prisma, PostgreSQL 15+
- **AI/ML**: Claude API, OpenAI, Perplexity, LangChain
- **Infrastructure**: Docker, Kubernetes, Redis, BullMQ
- **Real-time**: WebSockets, Server-Sent Events

## 🚀 Quick Start

### Initial Setup
```bash
# Clone repository
git clone https://github.com/your-org/hasteCRM.git
cd hasteCRM

# Initialize project structure
./scripts/initialize-project.sh

# Start Docker services
docker-compose up -d

# Install dependencies
pnpm install

# Start development
pnpm dev
```

### Access Points
- **Frontend**: http://localhost:3000
- **API**: http://localhost:4000/graphql
- **API Docs**: http://localhost:4000/api
- **Mailhog**: http://localhost:8025
- **pgAdmin**: http://localhost:5050

## 📁 Project Structure
```
hasteCRM/
├── apps/
│   ├── web/          # Next.js frontend application
│   ├── api/          # NestJS backend API
│   └── worker/       # Background job processor
├── packages/
│   ├── database/     # Prisma schema & migrations
│   ├── ui/           # Shared UI components
│   ├── types/        # Shared TypeScript types
│   └── utils/        # Shared utilities
├── docs/             # Documentation
├── scripts/          # Utility scripts
└── infrastructure/   # Docker & K8s configs
```

## 🏛️ Architecture Overview

### System Design
- **Architecture**: Microservices with AI integration
- **API Style**: GraphQL-first with REST for specific needs
- **Database**: PostgreSQL with pgvector for embeddings
- **Caching**: Redis for sessions and caching
- **Queue**: BullMQ for background jobs
- **Search**: Elasticsearch for full-text search

### API Endpoints
```
GraphQL:    /graphql
REST API:   /api/v1/*
WebSockets: /ws
Health:     /health
Metrics:    /metrics
```

## 💾 Database Schema

### Core Tables
- `workspaces` - Multi-tenant organizations
- `users` - User accounts & profiles
- `contacts` - CRM contacts
- `companies` - Business entities
- `deals` - Sales opportunities
- `pipelines` - Sales processes
- `emails` - Email communications
- `activities` - Timeline events

### Key Features
- Row-level security (RLS)
- JSONB for custom fields
- Vector embeddings for AI
- Time-based partitioning
- Audit logging

## 🔐 Security

### Authentication
- JWT tokens (15min access, 7d refresh)
- OAuth 2.0 (Google, Microsoft)
- Two-factor authentication (TOTP)
- API keys for integrations

### Security Layers
1. WAF & DDoS protection
2. Rate limiting per endpoint
3. Input validation & sanitization
4. Encrypted data at rest
5. TLS for all communications

## 🔑 Key Commands

### Development
```bash
pnpm dev              # Start all dev servers
pnpm build            # Build all packages
pnpm test             # Run test suite
pnpm lint             # Lint code
pnpm format           # Format code
```

### Database
```bash
pnpm db:migrate       # Run migrations
pnpm db:seed          # Seed test data
pnpm db:studio        # Open Prisma Studio
pnpm db:reset         # Reset database
```

### Docker
```bash
docker-compose up -d  # Start services
docker-compose down   # Stop services
docker-compose logs   # View logs
docker-compose ps     # List services
```

## 🌿 Git Workflow

### Branch Naming
- `feature/{ticket}-{description}`
- `bugfix/{ticket}-{description}`
- `hotfix/{ticket}-{description}`
- `release/{version}`

### Commit Format
```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

**Types**: feat, fix, docs, style, refactor, perf, test, build, ci, chore

### PR Process
1. Create feature branch from `develop`
2. Make changes with tests
3. Run `pnpm test` and `pnpm lint`
4. Push and create PR
5. Pass all CI checks
6. Get code review approval
7. Merge to develop

## 🧪 Testing

### Test Commands
```bash
pnpm test             # Run all tests
pnpm test:unit        # Unit tests only
pnpm test:e2e         # E2E tests
pnpm test:watch       # Watch mode
pnpm test:coverage    # Coverage report
```

### Test Structure
```
__tests__/
├── unit/            # Unit tests
├── integration/     # Integration tests
├── e2e/            # End-to-end tests
└── fixtures/       # Test data
```

## 📊 Environment Variables

### Required Variables
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/crm

# Redis
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-secret-key
GOOGLE_CLIENT_ID=your-google-id
GOOGLE_CLIENT_SECRET=your-google-secret

# AI Services
ANTHROPIC_API_KEY=your-claude-key
OPENAI_API_KEY=your-openai-key
```

## 🚀 Deployment

### Environments
- **Development**: Local Docker
- **Staging**: Kubernetes cluster
- **Production**: Multi-region K8s

### Deploy Commands
```bash
# Build images
pnpm docker:build

# Deploy to staging
kubectl apply -f k8s/staging/

# Deploy to production
kubectl apply -f k8s/production/
```

## 📈 Monitoring

### Health Checks
- `/health` - Basic health
- `/health/ready` - Readiness check
- `/health/live` - Liveness check

### Metrics
- Prometheus metrics at `/metrics`
- Custom business metrics
- Performance tracking
- Error tracking with Sentry

## 🔍 Troubleshooting

### Common Issues
1. **Port conflicts**: Check if ports 3000, 4000, 5432, 6379 are free
2. **Docker issues**: Run `docker-compose down -v` and restart
3. **Database errors**: Check migrations with `pnpm db:migrate:status`
4. **Type errors**: Run `pnpm type-check`

### Debug Commands
```bash
docker-compose logs api       # API logs
docker-compose exec api sh    # Shell into API
pnpm db:studio               # Inspect database
redis-cli                    # Redis CLI
```

## 📚 Additional Resources

- [Full Documentation](./index.md)
- [Architecture Details](./architecture/overview.md)
- [API Documentation](./api/api-overview.md)
- [Development Setup](./development/setup.md)
- [Deployment Guide](./deployment/environments.md)

---

*For detailed information on any topic, refer to the full documentation.*