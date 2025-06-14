# Claude Code Development Guide - hasteCRM

## 🔴 CRITICAL: Documentation-First Development

**✅ AUTO-ACCEPTS ENABLED**: This project is fully configured for Claude Code to work with auto-accepts enabled in Cursor IDE. All configurations, mock services, and error handling are in place.

**BEFORE ANY TASK**: You MUST read the documentation in this order:

1. This file (CLAUDE.md) - Check "Current Focus" section below
2. [MASTER-CONFIG.md](./MASTER-CONFIG.md) - For all version numbers and standards
3. Task-specific documentation in `claude-tasks/`
4. [ERROR-RECOVERY.md](./ERROR-RECOVERY.md) - If you encounter ANY error

**ENFORCE**: The `.cursorrules` file in the project root contains mandatory rules you must follow.

## 🎯 Quick Start

This guide helps Claude Code build hasteCRM. Start here, then dive into specific sections as needed.

## 📚 Documentation Map

### Getting Started

1. Read this guide first
2. Review [Architecture Overview](./architecture/overview.md)
3. Set up your [Development Environment](./development/setup.md)
4. Follow the [Phase 1 Tasks](./claude-tasks/phase-1-foundation.md)

### Core Documentation

- **Architecture**: System design and patterns
- **Development**: Coding standards and workflows
- **Features**: Implementation guides for each feature
- **API**: Endpoint documentation
- **Deployment**: Production deployment guides

### Task Lists

Each phase has its own task list in `claude-tasks/`. Complete them in order:

1. [Foundation](./claude-tasks/phase-1-foundation.md)
2. [Contact Management](./claude-tasks/phase-2-contacts.md)
3. [Gmail Integration](./claude-tasks/phase-3-gmail.md)
4. ...continue through all phases

## 🏗️ Key Principles

### 1. Test-Driven Development

Write tests first, then code. See [Testing Guide](./development/testing-guide.md)

### 2. Type Safety

TypeScript everywhere. No `any` types. See [Coding Standards](./development/coding-standards.md)

### 3. Security First

Every feature must be secure. See [Security Architecture](./architecture/security.md)

### 4. Performance Matters

Design for scale from the beginning.

## 🚀 Development Workflow

1. Pick a task from the current phase
2. Write tests for the feature
3. Implement the feature
4. Ensure all tests pass
5. Submit for review
6. Move to next task

## 📋 Quick Commands

\```bash

# Start development

pnpm dev

# Run tests

pnpm test

# Type check

pnpm type-check

# Build all packages

pnpm build
\```

## 🎯 Current Focus

**Phase**: 4 - AI Features  
**Status**: In Progress  
**Current Task**: AI Service Implementation  
**Next Task**: Email Summarization UI Integration  
**Documentation**: [Phase 2 Tasks](./docs/claude-tasks.md#phase-2-contact-management-days-4-5)

### ✅ Completed Tasks

#### Phase 1

- Set up NestJS API with GraphQL
- Configure PostgreSQL + Prisma with Docker
- Implement JWT authentication with access/refresh tokens
- Create workspace management with multi-tenancy
- Set up development environment with TypeScript
- Implement Google OAuth authentication
- Add email verification flow
- Create password reset functionality
- Add two-factor authentication (2FA) with TOTP
- Implement Redis-based session management
- Create rate limiting for auth endpoints

#### Phase 2

- Created contact CRUD operations with GraphQL
- Implemented contact search and filtering
- Added company relationships management
- Built contact UI components (ContactList, ContactCard, ContactFilters)
- Added bulk import/export functionality (CSV, Excel, JSON)

#### Phase 3
- Gmail API service implementation
- Email sync with pagination and threading
- Webhook support for real-time updates
- Webhook recovery service

### 🔄 In Progress

#### Phase 4
- AI service with Claude 3.5 Sonnet integration
- Email summarization API
- Smart compose functionality
- AI insights generation
- Contact enrichment service

### 📋 Upcoming Tasks

1. Phase 3: Gmail Integration
2. Phase 4: AI Features
3. Phase 5: Pipeline Management
4. Phase 6: Production Prep

**IMPORTANT**: Update this section after completing each task!

## 🔍 Setup Validation

Before starting any work, always run:

```bash
node scripts/check-setup.js
```

You should see all green checkmarks. If not, the script tells you exactly what to fix.

## 🛡️ Mock Services Available

The project includes mock services for development:

- **AI Operations** - No API keys needed (USE_MOCK_AI=true)
- **Email Sending** - Uses Mailhog locally
- **File Storage** - Local filesystem

## 📚 Where to Go Next

- [Phase 1 Tasks](./claude-tasks/phase-1-foundation.md) - Start here!
- [Database Schema](./architecture/database-schema.md) - Understand data model
- [API Design](./architecture/api-design.md) - Learn API patterns
- [Testing Guide](./development/testing-guide.md) - Write good tests
- [ERROR-RECOVERY](./ERROR-RECOVERY.md) - If you encounter any errors
