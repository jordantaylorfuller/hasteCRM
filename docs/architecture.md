# hasteCRM Architecture

## Overview

hasteCRM is a modern CRM platform built with a microservices architecture, focusing on AI integration and real-time capabilities.

## Technology Stack

See [MASTER-CONFIG.md](./MASTER-CONFIG.md) for all version numbers.

- **Frontend**: Next.js 14, React 18, Tailwind CSS, Shadcn/ui
- **Backend**: NestJS 10, GraphQL, PostgreSQL 15, Redis 7
- **AI**: Claude API, OpenAI API (optional)
- **Infrastructure**: Docker, Kubernetes (production)

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Load Balancer (nginx/ALB)                    │
└─────────────────┬───────────────────────┬───────────────────────┘
                  │                       │
         ┌────────▼────────┐     ┌────────▼────────┐
         │   Web App       │     │  API Gateway    │
         │  (Port 3000)    │     │  (Port 4000)    │
         │  Next.js        │     │  NestJS/GraphQL │
         └────────┬────────┘     └────────┬────────┘
                  │                       │
                  └───────────┬───────────┘
                              │
                  ┌───────────▼───────────┐
                  │    Core Services      │
                  ├─────────────────────────┤
                  │ • Auth Service        │
                  │ • Contact Service     │
                  │ • Email Service       │
                  │ • AI Service          │
                  └───────────┬───────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ┌────▼────┐          ┌────▼────┐          ┌────▼────┐
   │PostgreSQL│          │  Redis  │          │ BullMQ  │
   │Database  │          │  Cache  │          │  Queue  │
   └──────────┘          └─────────┘          └─────────┘
```

## Database Schema

### Core Models

```prisma
model User {
  id            String     @id @default(cuid())
  email         String     @unique
  firstName     String?
  lastName      String?
  role          UserRole   @default(USER)
  workspaces    WorkspaceUser[]
  createdAt     DateTime   @default(now())
}

model Workspace {
  id            String     @id @default(cuid())
  name          String
  slug          String     @unique
  plan          WorkspacePlan @default(FREE)
  users         WorkspaceUser[]
  contacts      Contact[]
}

model Contact {
  id            String     @id @default(cuid())
  workspaceId   String
  email         String?
  firstName     String?
  lastName      String?
  company       Company?   @relation(fields: [companyId], references: [id])
  companyId     String?
  activities    Activity[]
  createdAt     DateTime   @default(now())
}
```

See full schema in `/packages/database/prisma/schema.prisma`

## API Design

### GraphQL First

Primary API using GraphQL for:

- Complex queries with relationships
- Real-time subscriptions
- Type safety

```graphql
type Query {
  viewer: User!
  contact(id: ID!): Contact
  contacts(first: Int!, after: String): ContactConnection!
}

type Mutation {
  createContact(input: CreateContactInput!): ContactPayload!
  updateContact(input: UpdateContactInput!): ContactPayload!
}

type Subscription {
  contactCreated(workspaceId: ID!): Contact!
}
```

### REST Endpoints

Supplementary REST API for:

- File uploads
- Webhooks
- OAuth callbacks

## Security

### Authentication

- JWT tokens (RS256)
- OAuth2 with Google
- Multi-factor authentication support

### Authorization

- Role-based access control (RBAC)
- Workspace-level isolation
- Row-level security in PostgreSQL

### Data Protection

- Encryption at rest (AES-256)
- TLS 1.3 for all connections
- PII field encryption

## Performance

### Targets

- API Response: < 200ms (p95)
- Page Load: < 2s
- Database Query: < 50ms (p95)

### Optimization

- Redis caching
- Database connection pooling
- CDN for static assets
- GraphQL query complexity limits

## Deployment

### Development

```bash
docker-compose up -d
pnpm dev
```

### Production

- Kubernetes deployment
- Blue-green deployments
- Auto-scaling based on CPU/memory
- Health checks and readiness probes

## Monitoring

- **Metrics**: Prometheus + Grafana
- **Logs**: Centralized logging
- **Tracing**: OpenTelemetry
- **Alerts**: PagerDuty integration
