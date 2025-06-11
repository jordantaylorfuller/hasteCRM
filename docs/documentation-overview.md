# hasteCRM Documentation

**Version**: 1.0.0  
**Status**: In Development  
**Last Updated**: 2024-01-15

> **Note**: For authoritative version numbers and technical specifications, see [MASTER-CONFIG.md](./MASTER-CONFIG.md)

Welcome to the hasteCRM documentation. This next-generation CRM leverages AI at every level to create an intelligent, automated sales and relationship management system that surpasses traditional solutions.

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/haste/hasteCRM.git
cd hasteCRM

# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your API keys

# Start development
pnpm dev
```

Visit http://localhost:3000 to see the app running.

## 📋 Prerequisites

- Node.js v18+ 
- pnpm v8+
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+
- Google Cloud account (for Gmail API)
- API Keys: Claude (Anthropic), OpenAI, Perplexity

## 🎯 Why hasteCRM?

Unlike traditional CRMs, we've built AI into the core of every feature:

- **🤖 Natural Language Automations**: Tell Claude what you want to automate in plain English
- **📧 Smart Email Management**: AI categorizes, summarizes, and extracts action items
- **🔍 Intelligent Lead Scoring**: ML models that learn from your specific sales patterns
- **📊 Predictive Analytics**: Know which deals will close before your competitors
- **🎙️ Meeting Intelligence**: Automatic transcription, summaries, and CRM updates

## Overview

hasteCRM is built with a focus on:
- **AI-First Architecture**: Every feature enhanced with AI capabilities
- **Seamless Google Workspace Integration**: Real-time Gmail sync, Google Meet transcription, and more
- **Multi-Pipeline Intelligence**: Sales, investor, recruitment, and vendor management workflows
- **Advanced Analytics**: Predictive forecasting and AI-generated insights

## 🏗️ Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js App   │────▶│  GraphQL API    │────▶│   PostgreSQL    │
│   (Frontend)    │     │   (NestJS)      │     │   + Redis       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                        │
         │                       ▼                        │
         │              ┌─────────────────┐              │
         └─────────────▶│  AI Services    │──────────────┘
                        │ Claude/GPT/Perp │
                        └─────────────────┘
```

## 📅 Project Status

### ✅ Completed
- [x] Foundation and authentication system
- [x] Contact management with custom fields
- [x] Gmail integration with real-time sync

### 🚧 In Progress
- [ ] AI-powered automation builder
- [ ] Email campaign system with tracking
- [ ] Pipeline management

### 📋 Upcoming
- [ ] Meeting transcription and intelligence
- [ ] Advanced analytics dashboard
- [ ] Mobile app (React Native)

## ⚙️ Configuration

### Essential Environment Variables
```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/crm_dev"
REDIS_URL="redis://localhost:6379"

# Authentication
JWT_SECRET="change-me-in-production-min-32-chars"
JWT_REFRESH_SECRET="change-me-refresh-secret-min-32-chars"
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret-here"

# AI Services (get keys from respective platforms)
ANTHROPIC_API_KEY="your-anthropic-api-key-here"
OPENAI_API_KEY="your-openai-api-key-here"
PERPLEXITY_API_KEY="your-perplexity-api-key-here"
```

## 📝 Common Commands

```bash
# Development
pnpm dev              # Start all services
pnpm dev:api          # Start backend only
pnpm dev:web          # Start frontend only

# Database
pnpm db:migrate       # Run migrations
pnpm db:seed          # Seed test data
pnpm db:studio        # Open Prisma Studio

# Testing
pnpm test            # Run all tests
pnpm test:e2e        # Run E2E tests
pnpm test:coverage   # Generate coverage report

# Code Quality
pnpm lint            # Lint code
pnpm format          # Format code
pnpm type-check      # TypeScript check
```

## Documentation Structure

### Getting Started
- [Development Setup](development/setup.md) - Get your development environment running
- [Architecture Overview](architecture/overview.md) - Understand the system design
- [Coding Standards](development/coding-standards.md) - Follow our development guidelines

### Architecture
- [System Overview](architecture/overview.md) - High-level architecture and design decisions
- [Database Schema](architecture/database-schema.md) - Data models and relationships
- [API Design](architecture/api-design.md) - API architecture principles
- [Security](architecture/security.md) - Security measures and best practices

### API Documentation
- [GraphQL Schema](api/graphql-schema.md) - GraphQL API reference, performance testing
- [REST API](api/rest-api.md) - REST endpoints documentation
- [WebSockets](api/websockets.md) - Real-time communication
- [Webhooks](api/webhooks.md) - Event-driven integrations

### Features
- [AI Integration](features/ai-integration.md) - Claude, GPT-4, and Perplexity integration
- [Authentication & Authorization](features/auth.md) - OAuth, JWT, RBAC, and security
- [Contact Management](features/contacts.md) - Contact and activity tracking
- [Email Sync](features/email-sync.md) - Gmail integration and email intelligence
- [Pipelines](features/pipelines.md) - Multi-pipeline management system
- [Spam Prevention](features/spam-prevention.md) - Email deliverability and spam testing

### Development
- [Development Setup](development/setup.md) - Environment configuration
- [Git Workflow](development/git-workflow.md) - Branching and PR guidelines
- [Testing Guide](development/testing-guide.md) - Unit, integration, and E2E testing
- [Coding Standards](development/coding-standards.md) - Code style and best practices

### Deployment
- [Docker](deployment/docker.md) - Container deployment guide
- [Kubernetes](deployment/kubernetes.md) - K8s deployment and scaling
- [Environments](deployment/environments.md) - Staging and production setup
- [Monitoring](deployment/monitoring.md) - Observability and alerting

### Development Phases
- [Phase 1: Foundation](claude-tasks/phase-1-foundation.md) - Core infrastructure
- [Phase 2: Contacts](claude-tasks/phase-2-contacts.md) - Contact management
- [Phase 3: Gmail](claude-tasks/phase-3-gmail.md) - Email integration
- [Phase 4: AI](claude-tasks/phase-4-ai.md) - AI integration layer
- [Phase 5: Pipelines](claude-tasks/phase-5-pipelines.md) - Pipeline management
- [Phase 6: Email Outreach](claude-tasks/phase-6-email-outreach.md) - Campaign system
- [Phase 7: Meeting Intelligence](claude-tasks/phase-7-meeting-intelligence.md) - Meeting insights
- [Phase 8: Advanced Features](claude-tasks/phase-8-advanced-features.md) - Differentiation
- [Phase 9: Production](claude-tasks/phase-9-production.md) - Production readiness
- [Phase 10: Launch](claude-tasks/phase-10-launch.md) - Launch preparation

## Technology Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Shadcn/ui
- **Backend**: NestJS, GraphQL, PostgreSQL, Redis
- **AI Layer**: Claude SDK, OpenAI API, Perplexity API, LangChain
- **Email**: Gmail API, SendGrid, Custom tracking
- **Real-time**: Socket.io, BullMQ
- **Infrastructure**: Docker, Kubernetes, AWS/GCP

## Key Performance Indicators

### Technical KPIs
- API response time: <100ms (p95)
- Frontend load time: <3 seconds
- Database query time: <50ms
- Uptime: 99.9%
- Real-time sync latency: <500ms

### Email Deliverability KPIs
- Spam score: <3.0 average
- Inbox placement rate: >95%
- Authentication pass rate: 100%

## 🔧 Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000
kill -9 $(lsof -ti:3000)
```

### Database Connection Issues
```bash
# Restart Docker containers
docker-compose restart
```

### Clear Cache
```bash
# Clear all caches
pnpm clean && pnpm install
```

See [Development Setup](development/setup.md) for more solutions.

## 👥 Team & Support

- **Development Lead**: Jordan Taylor Fuller
- **Product Manager**: Jordan Taylor Fuller
- **Slack Channel**: #crm-development
- **Email**: crm-team@haste.nyc

### Getting Help
1. Check the documentation
2. Search existing issues
3. Ask in Slack
4. Create a GitHub issue

## Contributing

Please see our [Git Workflow](development/git-workflow.md) and [Coding Standards](development/coding-standards.md) before contributing.

## 🔒 Security

Please report security vulnerabilities to security@haste.nyc.

## 📄 License

This project is proprietary and confidential.