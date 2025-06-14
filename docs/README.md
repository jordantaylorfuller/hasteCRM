# hasteCRM Documentation

## Essential Guides

### Getting Started

- [Quick Start](./getting-started/quick-start.md) - Get running in 5 minutes
- [Development Guide](./development-guide.md) - Development workflow and commands
- [Architecture](./architecture.md) - System design and technology choices

### Building the MVP

- [Implementation Phases](./claude-tasks.md) - Step-by-step build guide
- [API Guide](./api-guide.md) - GraphQL and REST API reference

### Configuration

- [Master Config](./MASTER-CONFIG.md) - All version numbers and standards
- [Environment Setup](./.env.example) - Required environment variables

## Project Structure

```
hasteCRM/
├── apps/
│   ├── web/          # Next.js frontend
│   ├── api/          # NestJS backend
│   └── worker/       # Background jobs
├── packages/
│   ├── database/     # Prisma schema
│   ├── ui/          # Shared components
│   └── shared/      # Utilities
└── docs/            # This documentation
```

## Key Technologies

- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Backend**: NestJS 10, GraphQL, PostgreSQL 15
- **AI**: Claude API, OpenAI (optional)
- **Infrastructure**: Docker, Redis, BullMQ

## Quick Commands

```bash
# Development
pnpm dev              # Start everything
pnpm test            # Run tests
pnpm build           # Build for production

# Database
pnpm db:migrate      # Run migrations
pnpm db:studio       # Open Prisma Studio
```

## For Claude Code

This project is optimized for Claude Code with auto-accept enabled:

1. All configurations are in place
2. Mock services available for development
3. Clear implementation phases in [claude-tasks.md](./claude-tasks.md)
4. Error handling patterns established

Start with Phase 1 in the implementation guide.
