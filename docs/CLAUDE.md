# Claude Code Development Guide - hasteCRM

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

We're currently on **Phase 1: Foundation Setup**
Next milestone: **Complete authentication system**

## 📚 Where to Go Next

- [Phase 1 Tasks](./claude-tasks/phase-1-foundation.md) - Start here!
- [Database Schema](./architecture/database-schema.md) - Understand data model
- [API Design](./architecture/api-design.md) - Learn API patterns
- [Testing Guide](./development/testing-guide.md) - Write good tests