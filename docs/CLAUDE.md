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

**Phase**: 1 - Foundation Setup  
**Status**: Not Started  
**Current Task**: None - Run setup wizard first  
**Next Task**: 1.1 - Monorepo Initialization  
**Documentation**: [Phase 1 Tasks](./claude-tasks/phase-1-foundation.md)

### ✅ Completed Tasks
- None yet

### 🔄 In Progress
- None yet

### 📋 Upcoming Tasks
1. Project Setup (1.1 - 1.3)
2. Authentication System (2.1 - 2.6)
3. Workspace Management (3.1 - 3.4)
4. GraphQL API Setup (4.1 - 4.4)

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