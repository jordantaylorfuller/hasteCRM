# Development Quick Reference Guide

## 🚀 Quick Start
```bash
# Clone and setup
git clone <repo>
cd ai-crm-platform
./scripts/setup-dev.sh

# Start development
pnpm dev

# Run tests
pnpm test
```

## 🌿 Git Workflow

### Branch Names
- **Feature**: `feature/{ticket-id}-{description}`
- **Bugfix**: `bugfix/{ticket-id}-{description}`
- **Hotfix**: `hotfix/{ticket-id}-{description}`
- **Release**: `release/{version}`

### Commit Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**: feat, fix, docs, style, refactor, perf, test, build, ci, chore

### PR Process
1. Create feature branch
2. Make changes with tests
3. Push and create PR
4. Pass all checks
5. Get 2 reviews
6. Merge to develop

## 🧪 Testing Commands

### Run Tests
```bash
# All tests
pnpm test

# Unit tests only
pnpm test:unit

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e

# With coverage
pnpm test:coverage

# Watch mode
pnpm test:watch
```

### Test Structure
```
tests/
├── unit/          # Fast, isolated tests
├── integration/   # API & service tests
├── e2e/          # User journey tests
└── fixtures/     # Test data
```

## 📝 Code Standards

### TypeScript
- No `any` types
- Explicit return types
- Use interfaces over types
- Proper error handling

### React
- Functional components only
- Custom hooks for logic
- Memoize expensive operations
- Proper key props

### File Naming
- Components: `PascalCase.tsx`
- Utilities: `camelCase.ts`
- Tests: `*.test.ts(x)`
- Styles: `*.module.css`

## 🏗️ Project Structure
```
src/
├── app/          # Next.js app router
├── components/   # React components
├── hooks/        # Custom hooks
├── lib/          # Utilities
├── services/     # Business logic
├── styles/       # Global styles
└── types/        # TypeScript types
```

## 🔧 Common Tasks

### Add a new feature
1. Create feature branch
2. Write tests first (TDD)
3. Implement feature
4. Update documentation
5. Submit PR

### Fix a bug
1. Create bugfix branch
2. Write failing test
3. Fix the bug
4. Verify all tests pass
5. Submit PR

### Update dependencies
```bash
# Check outdated
pnpm outdated

# Update all
pnpm update

# Update specific
pnpm update {package}

# Update lock file
pnpm install
```

## 🚨 Troubleshooting

### Build fails
```bash
# Clear cache
pnpm clean

# Reinstall deps
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Check types
pnpm type-check
```

### Tests fail
```bash
# Run specific test
pnpm test {file}

# Debug mode
node --inspect-brk node_modules/.bin/jest {file}

# Update snapshots
pnpm test -u
```

### Git issues
```bash
# Undo last commit
git reset --soft HEAD~1

# Fix commit message
git commit --amend

# Clean working directory
git stash

# Sync with upstream
git fetch upstream
git rebase upstream/develop
```

## 📊 Code Quality

### Linting
```bash
# Run ESLint
pnpm lint

# Fix automatically
pnpm lint:fix

# Check formatting
pnpm format:check

# Fix formatting
pnpm format
```

### Pre-commit Hooks
- ESLint check
- Prettier format
- Type checking
- Test affected
- Commit message validation

## 🔑 Environment Variables
```env
# Database
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=redis://...

# API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-...

# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Feature Flags
NEXT_PUBLIC_ENABLE_AI=true
```

## 📚 Key Resources
- [Setup Guide](./setup.md)
- [Coding Standards](./coding-standards.md)
- [Testing Guide](./testing-guide.md)
- [Git Workflow](./git-workflow.md)

## 🎯 Performance Tips
1. Use React.memo() for expensive components
2. Implement virtual scrolling for long lists
3. Lazy load routes and components
4. Optimize images with next/image
5. Use React Query for server state
6. Implement proper caching strategies

## 🚀 Deployment Checklist
- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Documentation updated
- [ ] Environment variables set
- [ ] Database migrations run
- [ ] Feature flags configured
- [ ] Monitoring alerts set up
- [ ] Rollback plan ready