# Git Workflow Guide

## Table of Contents
1. [Overview](#overview)
2. [Branch Strategy](#branch-strategy)
3. [Commit Guidelines](#commit-guidelines)
4. [Pull Request Process](#pull-request-process)
5. [Code Review Standards](#code-review-standards)
6. [Release Process](#release-process)
7. [Hotfix Procedures](#hotfix-procedures)
8. [Git Commands Reference](#git-commands-reference)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

## Overview

This guide outlines our Git workflow for hasteCRM. We follow a modified GitFlow strategy with emphasis on continuous integration, code quality, and collaborative development.

### Core Principles
- Feature branches for all development
- Mandatory code reviews
-  All tests must pass before merging
- Clear, descriptive commit messages
- Continuous deployment to staging
- Protected main and develop branches

## Branch Strategy

### Branch Types

```
main (production)

   develop (staging)
   
      feature/crm-123-contact-import
      feature/crm-456-ai-scoring
   
      bugfix/crm-789-email-sync
   
      chore/update-dependencies

   release/1.2.0

   hotfix/crm-999-critical-fix
```

### Branch Naming Convention

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/{ticket-id}-{description}` | `feature/crm-123-gmail-integration` |
| Bugfix | `bugfix/{ticket-id}-{description}` | `bugfix/crm-456-login-error` |
| Hotfix | `hotfix/{ticket-id}-{description}` | `hotfix/crm-789-payment-fix` |
| Release | `release/{version}` | `release/1.2.0` |
| Chore | `chore/{description}` | `chore/update-dependencies` |

### Branch Policies

#### Protected Branches
- **main**: Production branch
  - No direct pushes
  - Requires PR with 2 approvals
  - All checks must pass
  - Admin override only for emergencies

- **develop**: Integration branch
  - No direct pushes
  - Requires PR with 1 approval
  - All checks must pass

## Commit Guidelines

### Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `build`: Build system changes
- `ci`: CI configuration changes
- `chore`: Other changes (updating dependencies, etc.)
- `revert`: Reverting a previous commit

### Examples

```bash
# Feature
feat(contacts): add bulk import functionality

Implement CSV import with field mapping and duplicate detection.
Supports up to 10,000 contacts per import.

Closes #123

# Bug fix
fix(email): resolve Gmail sync timeout issue

Increase timeout to 30s and add retry logic for large mailboxes.
Previous 10s timeout was causing failures for accounts with >1000 emails.

Fixes #456

# Breaking change
feat(api)!: change contact endpoint response format

BREAKING CHANGE: Contact API now returns nested company object
instead of company_id. Update all API clients accordingly.

# Multi-line description
refactor(auth): improve JWT token validation

- Extract token validation to separate service
- Add token expiration check
- Implement refresh token rotation
- Add comprehensive logging
```

### Commit Best Practices

1. **Atomic commits**: Each commit should represent one logical change
2. **Present tense**: "add feature" not "added feature"
3. **Imperative mood**: "move cursor to..." not "moves cursor to..."
4. **Line length**: 
   - Subject line: max 72 characters
   - Body: wrap at 80 characters
5. **Reference issues**: Use "Closes #123" or "Fixes #456"

## Pull Request Process

### Creating a Pull Request

1. **Update your branch**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout feature/your-branch
   git rebase develop
   ```

2. **Push your branch**
   ```bash
   git push origin feature/your-branch
   ```

3. **Create PR via GitHub/GitLab**

### PR Template

```markdown
## Description
Brief description of changes and why they're needed.

## Type of Change
- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Related Issues
Closes #(issue number)

## Changes Made
- List specific changes
- Include technical details
- Mention any migrations or configuration changes

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] No console errors
- [ ] Responsive design tested

## Screenshots (if applicable)
Include before/after screenshots for UI changes

## Checklist
- [ ] My code follows the project style guidelines
- [ ] I have performed a self-review
- [ ] I have commented my code where necessary
- [ ] I have updated the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix/feature works
- [ ] New and existing unit tests pass locally
- [ ] Any dependent changes have been merged
```

### PR Guidelines

1. **Keep PRs small**: Aim for <400 lines of code
2. **One feature per PR**: Don't mix features
3. **Update tests**: Include tests for new functionality
4. **Update documentation**: Keep docs in sync
5. **Respond to feedback**: Address review comments promptly

## Code Review Standards

### Review Checklist

#### Code Quality
- [ ] Code follows project conventions
- [ ] No commented-out code
- [ ] No console.logs or debug statements
- [ ] Proper error handling
- [ ] No hardcoded values

#### Architecture
- [ ] Follows established patterns
- [ ] Proper separation of concerns
- [ ] No circular dependencies
- [ ] Appropriate abstractions

#### Performance
- [ ] No N+1 queries
- [ ] Efficient algorithms used
- [ ] Proper caching implemented
- [ ] No memory leaks

#### Security
- [ ] Input validation
- [ ] No SQL injection vulnerabilities
- [ ] Proper authentication/authorization
- [ ] Sensitive data encrypted
- [ ] No secrets in code

#### Testing
- [ ] Adequate test coverage
- [ ] Edge cases tested
- [ ] Integration tests for critical paths
- [ ] Tests are maintainable

### Review Comments

Use GitHub's suggestion feature for small changes:
```suggestion
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
```

Be constructive and specific:
```
L "This is wrong"
 "This could cause a race condition when multiple users access simultaneously. Consider using a mutex or transaction."
```

## Release Process

### Version Numbering
We follow [Semantic Versioning](https://semver.org/):
- **MAJOR.MINOR.PATCH** (e.g., 1.2.3)
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes

### Release Workflow

1. **Create release branch**
   ```bash
   git checkout -b release/1.2.0 develop
   ```

2. **Update version numbers**
   ```bash
   npm version minor  # or major/patch
   ```

3. **Update CHANGELOG.md**
   ```markdown
   ## [1.2.0] - 2024-01-15
   ### Added
   - Contact bulk import (#123)
   - AI-powered lead scoring (#124)
   
   ### Fixed
   - Gmail sync timeout issue (#125)
   
   ### Changed
   - Improved dashboard performance
   ```

4. **Create PR to main**
   - Run full test suite
   - Deploy to staging for final testing
   - Get approval from tech lead

5. **Merge and tag**
   ```bash
   git checkout main
   git merge --no-ff release/1.2.0
   git tag -a v1.2.0 -m "Release version 1.2.0"
   git push origin main --tags
   ```

6. **Back-merge to develop**
   ```bash
   git checkout develop
   git merge --no-ff main
   ```

## Hotfix Procedures

For critical production issues:

1. **Create hotfix branch from main**
   ```bash
   git checkout -b hotfix/crm-999-critical-fix main
   ```

2. **Fix the issue**
   - Minimal changes only
   - Include tests
   - Update version (patch)

3. **Test thoroughly**
   - Run full test suite
   - Test in staging environment
   - Verify fix doesn't break other features

4. **Merge to main and develop**
   ```bash
   # Merge to main
   git checkout main
   git merge --no-ff hotfix/crm-999-critical-fix
   git tag -a v1.2.1 -m "Hotfix version 1.2.1"
   
   # Merge to develop
   git checkout develop
   git merge --no-ff hotfix/crm-999-critical-fix
   ```

## Git Commands Reference

### Daily Workflow

```bash
# Start new feature
git checkout develop
git pull origin develop
git checkout -b feature/crm-123-new-feature

# Regular commits
git add .
git commit -m "feat(module): add new functionality"

# Update feature branch with latest develop
git checkout develop
git pull origin develop
git checkout feature/crm-123-new-feature
git rebase develop

# Push changes
git push origin feature/crm-123-new-feature
```

### Useful Commands

```bash
# Interactive rebase (squash commits)
git rebase -i HEAD~3

# Amend last commit
git commit --amend

# Cherry-pick specific commit
git cherry-pick <commit-hash>

# Stash changes
git stash save "WIP: feature description"
git stash pop

# View branch graph
git log --graph --oneline --all

# Find who changed a line
git blame <file>

# Search commits
git log --grep="keyword"

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1

# Clean untracked files
git clean -fd
```

### Aliases

Add to `~/.gitconfig`:

```ini
[alias]
    co = checkout
    br = branch
    ci = commit
    st = status
    lg = log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset'
    undo = reset --soft HEAD~1
    amend = commit --amend --no-edit
    pullbase = pull --rebase origin develop
    pushf = push --force-with-lease
```

## Best Practices

### Do's 

1. **Pull frequently**: Keep your branch up to date
2. **Commit often**: Small, logical commits
3. **Write tests**: TDD when possible
4. **Review your own PR**: Before requesting reviews
5. **Use .gitignore**: Don't commit generated files
6. **Sign commits**: Use GPG signing for security

### Don'ts L

1. **Don't force push**: To shared branches
2. **Don't commit secrets**: Use environment variables
3. **Don't commit broken code**: All commits should work
4. **Don't mix concerns**: Separate refactoring from features
5. **Don't ignore conflicts**: Resolve carefully
6. **Don't commit large files**: Use Git LFS if needed

### Git Hooks

Pre-commit hooks (`.husky/pre-commit`):
```bash
#!/bin/sh
npm run lint
npm run test:unit
npm run type-check
```

Commit message hook (`.husky/commit-msg`):
```bash
#!/bin/sh
npx commitlint --edit $1
```

## Troubleshooting

### Common Issues

#### Merge Conflicts
```bash
# Resolve conflicts manually, then:
git add <resolved-files>
git rebase --continue
# or
git merge --continue
```

#### Accidentally Committed to Wrong Branch
```bash
# Create new branch with current changes
git branch new-feature-branch

# Reset current branch
git reset --hard origin/develop

# Switch to new branch
git checkout new-feature-branch
```

#### Need to Undo a Merge
```bash
# Undo merge commit
git revert -m 1 <merge-commit-hash>
```

#### Lost Commits
```bash
# Find lost commits
git reflog

# Restore lost commit
git checkout <commit-hash>
```

#### Large File Committed by Mistake
```bash
# Remove from history (WARNING: rewrites history)
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch path/to/large/file' \
  --prune-empty --tag-name-filter cat -- --all
```

### Getting Help

1. **Check Git documentation**: `git help <command>`
2. **Ask team lead**: For workflow questions
3. **Create discussion**: In #dev-help Slack channel
4. **Review this guide**: Most answers are here

## Continuous Integration

Our CI pipeline runs on every PR:

```yaml
name: CI Pipeline
on:
  pull_request:
    branches: [develop, main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install dependencies
        run: npm ci
      - name: Run linter
        run: npm run lint
      - name: Run type check
        run: npm run type-check
      - name: Run tests
        run: npm test
      - name: Build
        run: npm run build
```

## Resources

- [Pro Git Book](https://git-scm.com/book/en/v2)
- [GitHub Flow Guide](https://guides.github.com/introduction/flow/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [Git Flight Rules](https://github.com/k88hudson/git-flight-rules)

---

*Last updated: January 2024*  
*Version: 1.0*