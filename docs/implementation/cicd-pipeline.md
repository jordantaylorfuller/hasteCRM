# Production CI/CD Pipeline Configuration

## Table of Contents
1. [Overview](#overview)
2. [GitHub Actions Workflows](#github-actions-workflows)
3. [Build Pipeline](#build-pipeline)
4. [Test Pipeline](#test-pipeline)
5. [Security Scanning](#security-scanning)
6. [Deployment Pipeline](#deployment-pipeline)
7. [Release Management](#release-management)
8. [Rollback Procedures](#rollback-procedures)
9. [Environment Configuration](#environment-configuration)
10. [Monitoring Integration](#monitoring-integration)

## Overview

This guide provides complete CI/CD pipeline configurations for hasteCRM, ensuring automated, secure, and reliable deployments to production.

## GitHub Actions Workflows

### Main CI Workflow

```yaml
# .github/workflows/ci.yml
name: Continuous Integration

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  NODE_VERSION: '18.19.0'
  PNPM_VERSION: '8.14.0'

jobs:
  setup:
    name: Setup
    runs-on: ubuntu-latest
    outputs:
      cache-hit: ${{ steps.cache.outputs.cache-hit }}
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      
      - name: Get pnpm store directory
        id: pnpm-cache
        shell: bash
        run: |
          echo "STORE_PATH=$(pnpm store path)" >> $GITHUB_OUTPUT
      
      - name: Setup pnpm cache
        id: cache
        uses: actions/cache@v3
        with:
          path: ${{ steps.pnpm-cache.outputs.STORE_PATH }}
          key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-pnpm-store-
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile

  lint:
    name: Lint
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup environment
        uses: ./.github/actions/setup-env
      
      - name: Run ESLint
        run: pnpm lint
      
      - name: Run Prettier check
        run: pnpm format:check
      
      - name: Run type check
        run: pnpm type-check

  test:
    name: Test
    needs: setup
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: hastecrm_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup environment
        uses: ./.github/actions/setup-env
      
      - name: Setup test database
        run: |
          pnpm prisma migrate deploy
          pnpm prisma db seed
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/hastecrm_test
      
      - name: Run unit tests
        run: pnpm test:unit --shard=${{ matrix.shard }}/4
      
      - name: Run integration tests
        run: pnpm test:integration --shard=${{ matrix.shard }}/4
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/hastecrm_test
          REDIS_URL: redis://localhost:6379
      
      - name: Upload coverage
        uses: actions/upload-artifact@v3
        with:
          name: coverage-${{ matrix.shard }}
          path: coverage/

  e2e:
    name: E2E Tests
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup environment
        uses: ./.github/actions/setup-env
      
      - name: Build application
        run: pnpm build
      
      - name: Start services
        run: |
          docker-compose -f docker-compose.test.yml up -d
          pnpm wait-on tcp:3000 tcp:5432 tcp:6379 -t 60000
      
      - name: Run E2E tests
        run: pnpm test:e2e
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: e2e-results
          path: |
            test-results/
            playwright-report/

  security:
    name: Security Scan
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run security audit
        run: pnpm audit --audit-level=high
      
      - name: Run Snyk scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
      
      - name: Run OWASP dependency check
        uses: dependency-check/Dependency-Check_Action@main
        with:
          project: 'hasteCRM'
          path: '.'
          format: 'HTML'
      
      - name: Upload security reports
        uses: actions/upload-artifact@v3
        with:
          name: security-reports
          path: reports/

  build:
    name: Build
    needs: [lint, test, security]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup environment
        uses: ./.github/actions/setup-env
      
      - name: Build packages
        run: pnpm build
      
      - name: Build Docker images
        run: |
          docker build -t hastecrm/api:${{ github.sha }} -f packages/api/Dockerfile .
          docker build -t hastecrm/web:${{ github.sha }} -f packages/web/Dockerfile .
          docker build -t hastecrm/worker:${{ github.sha }} -f packages/worker/Dockerfile .
      
      - name: Push to registry
        if: github.ref == 'refs/heads/main'
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push hastecrm/api:${{ github.sha }}
          docker push hastecrm/web:${{ github.sha }}
          docker push hastecrm/worker:${{ github.sha }}
```

### Deployment Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deployment environment'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production

jobs:
  deploy-staging:
    name: Deploy to Staging
    if: github.event_name == 'push' || github.event.inputs.environment == 'staging'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2
      
      - name: Deploy to EKS
        run: |
          aws eks update-kubeconfig --name hastecrm-staging --region us-east-1
          kubectl set image deployment/crm-api api=${{ steps.login-ecr.outputs.registry }}/hastecrm-api:${{ github.sha }} -n hastecrm-staging
          kubectl set image deployment/crm-web web=${{ steps.login-ecr.outputs.registry }}/hastecrm-web:${{ github.sha }} -n hastecrm-staging
          kubectl set image deployment/crm-worker worker=${{ steps.login-ecr.outputs.registry }}/hastecrm-worker:${{ github.sha }} -n hastecrm-staging
          kubectl rollout status deployment/crm-api -n hastecrm-staging
          kubectl rollout status deployment/crm-web -n hastecrm-staging
          kubectl rollout status deployment/crm-worker -n hastecrm-staging
      
      - name: Run smoke tests
        run: |
          pnpm test:smoke --env=staging
      
      - name: Notify Slack
        uses: slackapi/slack-github-action@v1.24.0
        with:
          payload: |
            {
              "text": "Staging deployment completed",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "✅ Staging deployment successful\n*Commit:* ${{ github.sha }}\n*Author:* ${{ github.actor }}"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}

  deploy-production:
    name: Deploy to Production
    if: github.event.inputs.environment == 'production'
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      
      - name: Create deployment
        uses: chrnorm/deployment-action@v2
        id: deployment
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          environment: production
          description: 'Deploy ${{ github.sha }} to production'
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.PROD_AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.PROD_AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Blue/Green deployment
        run: |
          ./scripts/deploy-blue-green.sh production ${{ github.sha }}
      
      - name: Update deployment status
        if: always()
        uses: chrnorm/deployment-status@v2
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          deployment-id: ${{ steps.deployment.outputs.deployment_id }}
          state: ${{ job.status }}
          environment-url: https://app.haste.nyc
```

## Build Pipeline

### Multi-stage Dockerfile

```dockerfile
# packages/api/Dockerfile
# Build stage
FROM node:18.19-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.14.0 --activate

WORKDIR /app

# Copy workspace files
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY packages ./packages

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the API package
RUN pnpm --filter @hastecrm/api build

# Production stage
FROM node:18.19-alpine AS production

RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy built application
COPY --from=builder /app/packages/api/dist ./dist
COPY --from=builder /app/packages/api/package.json ./
COPY --from=builder /app/packages/api/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
```

### Build Script

```bash
#!/bin/bash
# scripts/build.sh

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🚀 Starting hasteCRM build process${NC}"

# Check Node version
NODE_VERSION=$(node -v)
REQUIRED_NODE="v18.19"
if [[ "$NODE_VERSION" != *"$REQUIRED_NODE"* ]]; then
  echo -e "${RED}❌ Node version mismatch. Required: $REQUIRED_NODE, Found: $NODE_VERSION${NC}"
  exit 1
fi

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
pnpm install --frozen-lockfile

# Run type checking
echo -e "${YELLOW}🔍 Running type check...${NC}"
pnpm type-check

# Run linting
echo -e "${YELLOW}🧹 Running linters...${NC}"
pnpm lint

# Run tests
echo -e "${YELLOW}🧪 Running tests...${NC}"
pnpm test

# Build packages
echo -e "${YELLOW}🔨 Building packages...${NC}"
pnpm build

# Generate Prisma client
echo -e "${YELLOW}🗄️ Generating Prisma client...${NC}"
pnpm prisma generate

# Build Docker images
echo -e "${YELLOW}🐳 Building Docker images...${NC}"
docker build -t hastecrm/api:latest -f packages/api/Dockerfile .
docker build -t hastecrm/web:latest -f packages/web/Dockerfile .
docker build -t hastecrm/worker:latest -f packages/worker/Dockerfile .
docker build -t hastecrm/websocket:latest -f packages/websocket/Dockerfile .

echo -e "${GREEN}✅ Build completed successfully!${NC}"
```

## Test Pipeline

### Test Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@hastecrm/common': resolve(__dirname, './packages/common/src'),
    },
  },
});
```

### Parallel Test Execution

```json
// package.json scripts
{
  "scripts": {
    "test": "vitest run",
    "test:unit": "vitest run --config vitest.unit.config.ts",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:e2e": "playwright test",
    "test:smoke": "vitest run --config vitest.smoke.config.ts",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:parallel": "concurrently \"pnpm test:unit\" \"pnpm test:integration\""
  }
}
```

### E2E Test Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

## Security Scanning

### SAST Configuration

```yaml
# .github/workflows/security.yml
name: Security Scanning

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 1' # Weekly on Monday

jobs:
  dependency-scan:
    name: Dependency Scanning
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'
      
      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'

  code-scan:
    name: Code Scanning
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Initialize CodeQL
        uses: github/codeql-action/init@v2
        with:
          languages: javascript, typescript
      
      - name: Autobuild
        uses: github/codeql-action/autobuild@v2
      
      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v2

  container-scan:
    name: Container Scanning
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build Docker image
        run: docker build -t hastecrm/api:scan -f packages/api/Dockerfile .
      
      - name: Run Trivy container scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'hastecrm/api:scan'
          format: 'table'
          exit-code: '1'
          ignore-unfixed: true
          vuln-type: 'os,library'
          severity: 'CRITICAL,HIGH'

  secrets-scan:
    name: Secrets Scanning
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: Run Gitleaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Security Policy

```markdown
# SECURITY.md
# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.x.x   | :white_check_mark: |
| 1.x.x   | :x:                |
| < 1.0   | :x:                |

## Reporting a Vulnerability

Please report security vulnerabilities to security@haste.nyc

### What to include:
1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if any)

We will acknowledge receipt within 24 hours and provide updates every 72 hours.

## Security Measures

### Authentication & Authorization
- JWT tokens with RS256 algorithm
- Token rotation every 15 minutes
- Role-based access control (RBAC)
- Multi-factor authentication support

### Data Protection
- AES-256 encryption at rest
- TLS 1.3 for data in transit
- PII data masking
- Secure key management with AWS KMS

### Infrastructure Security
- Network isolation with VPCs
- WAF protection
- DDoS mitigation
- Regular security patching

### Compliance
- GDPR compliant
- SOC 2 Type II certified
- HIPAA ready
- PCI DSS Level 1
```

## Deployment Pipeline

### Blue-Green Deployment Script

```bash
#!/bin/bash
# scripts/deploy-blue-green.sh

set -euo pipefail

ENVIRONMENT=$1
VERSION=$2

echo "🚀 Starting blue-green deployment for $ENVIRONMENT with version $VERSION"

# Get current active environment
CURRENT_ENV=$(kubectl get service crm-api-active -n hastecrm-$ENVIRONMENT -o jsonpath='{.spec.selector.deployment}')
if [ "$CURRENT_ENV" == "blue" ]; then
  NEW_ENV="green"
else
  NEW_ENV="blue"
fi

echo "Current environment: $CURRENT_ENV"
echo "Deploying to: $NEW_ENV"

# Update the inactive environment
kubectl set image deployment/crm-api-$NEW_ENV \
  api=hastecrm/api:$VERSION \
  -n hastecrm-$ENVIRONMENT

kubectl set image deployment/crm-web-$NEW_ENV \
  web=hastecrm/web:$VERSION \
  -n hastecrm-$ENVIRONMENT

kubectl set image deployment/crm-worker-$NEW_ENV \
  worker=hastecrm/worker:$VERSION \
  -n hastecrm-$ENVIRONMENT

# Wait for rollout
echo "⏳ Waiting for rollout to complete..."
kubectl rollout status deployment/crm-api-$NEW_ENV -n hastecrm-$ENVIRONMENT
kubectl rollout status deployment/crm-web-$NEW_ENV -n hastecrm-$ENVIRONMENT
kubectl rollout status deployment/crm-worker-$NEW_ENV -n hastecrm-$ENVIRONMENT

# Run health checks
echo "🏥 Running health checks..."
./scripts/health-check.sh $ENVIRONMENT $NEW_ENV

# Switch traffic
echo "🔄 Switching traffic to $NEW_ENV..."
kubectl patch service crm-api-active \
  -p '{"spec":{"selector":{"deployment":"'$NEW_ENV'"}}}' \
  -n hastecrm-$ENVIRONMENT

kubectl patch service crm-web-active \
  -p '{"spec":{"selector":{"deployment":"'$NEW_ENV'"}}}' \
  -n hastecrm-$ENVIRONMENT

echo "✅ Blue-green deployment completed successfully!"
```

### Canary Deployment

```yaml
# k8s/canary/canary-deployment.yaml
apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: crm-api
  namespace: hastecrm-production
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: crm-api
  service:
    port: 80
    targetPort: 3000
    gateways:
    - public-gateway.istio-system.svc.cluster.local
    hosts:
    - api.haste.nyc
  analysis:
    interval: 1m
    threshold: 5
    maxWeight: 50
    stepWeight: 10
    metrics:
    - name: request-success-rate
      thresholdRange:
        min: 99
      interval: 1m
    - name: request-duration
      thresholdRange:
        max: 500
      interval: 30s
    webhooks:
    - name: acceptance-test
      type: pre-rollout
      url: http://flagger-loadtester.test/
      timeout: 30s
      metadata:
        type: bash
        cmd: "curl -s http://crm-api-canary.hastecrm-production:80/health | grep -q 'ok'"
    - name: load-test
      type: rollout
      url: http://flagger-loadtester.test/
      metadata:
        cmd: "hey -z 2m -q 10 -c 2 http://crm-api-canary.hastecrm-production:80/"
```

## Release Management

### Semantic Release Configuration

```json
// .releaserc.json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    [
      "@semantic-release/npm",
      {
        "npmPublish": false
      }
    ],
    [
      "@semantic-release/exec",
      {
        "prepareCmd": "pnpm version ${nextRelease.version} --no-git-tag-version",
        "publishCmd": "docker build -t hastecrm/api:${nextRelease.version} -f packages/api/Dockerfile . && docker push hastecrm/api:${nextRelease.version}"
      }
    ],
    [
      "@semantic-release/git",
      {
        "assets": ["package.json", "CHANGELOG.md"],
        "message": "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}"
      }
    ],
    "@semantic-release/github"
  ]
}
```

### Release Workflow

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches: [main]

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          persist-credentials: false
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 18
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Build
        run: pnpm build
      
      - name: Release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
          DOCKER_USERNAME: ${{ secrets.DOCKER_USERNAME }}
          DOCKER_PASSWORD: ${{ secrets.DOCKER_PASSWORD }}
        run: pnpm semantic-release
```

## Rollback Procedures

### Automated Rollback Script

```bash
#!/bin/bash
# scripts/rollback.sh

set -euo pipefail

ENVIRONMENT=$1
PREVIOUS_VERSION=$2

echo "⚠️  Starting rollback to version $PREVIOUS_VERSION in $ENVIRONMENT"

# Create rollback record
ROLLBACK_ID=$(uuidgen)
echo "Rollback ID: $ROLLBACK_ID"

# Log rollback initiation
curl -X POST https://api.haste.nyc/deployments/rollback \
  -H "Authorization: Bearer $DEPLOYMENT_TOKEN" \
  -d "{
    \"id\": \"$ROLLBACK_ID\",
    \"environment\": \"$ENVIRONMENT\",
    \"targetVersion\": \"$PREVIOUS_VERSION\",
    \"initiatedBy\": \"$USER\",
    \"reason\": \"$3\"
  }"

# Perform rollback
kubectl rollout undo deployment/crm-api -n hastecrm-$ENVIRONMENT
kubectl rollout undo deployment/crm-web -n hastecrm-$ENVIRONMENT
kubectl rollout undo deployment/crm-worker -n hastecrm-$ENVIRONMENT

# Wait for rollback to complete
kubectl rollout status deployment/crm-api -n hastecrm-$ENVIRONMENT
kubectl rollout status deployment/crm-web -n hastecrm-$ENVIRONMENT
kubectl rollout status deployment/crm-worker -n hastecrm-$ENVIRONMENT

# Verify health
./scripts/health-check.sh $ENVIRONMENT

# Update rollback status
curl -X PATCH https://api.haste.nyc/deployments/rollback/$ROLLBACK_ID \
  -H "Authorization: Bearer $DEPLOYMENT_TOKEN" \
  -d '{"status": "completed"}'

echo "✅ Rollback completed successfully!"
```

### Database Migration Rollback

```typescript
// scripts/rollback-migration.ts
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

async function rollbackMigration(targetMigration?: string) {
  const prisma = new PrismaClient();
  
  try {
    // Get current migrations
    const migrations = await prisma.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name 
      FROM _prisma_migrations 
      WHERE finished_at IS NOT NULL 
      ORDER BY finished_at DESC
    `;

    console.log('Current migrations:', migrations);

    if (targetMigration) {
      // Rollback to specific migration
      execSync(`prisma migrate resolve --rolled-back ${targetMigration}`, {
        stdio: 'inherit',
      });
    } else {
      // Rollback last migration
      const lastMigration = migrations[0]?.migration_name;
      if (lastMigration) {
        execSync(`prisma migrate resolve --rolled-back ${lastMigration}`, {
          stdio: 'inherit',
        });
      }
    }

    console.log('✅ Migration rollback completed');
  } catch (error) {
    console.error('❌ Migration rollback failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute if run directly
if (require.main === module) {
  rollbackMigration(process.argv[2]);
}
```

## Environment Configuration

### Environment Management

```typescript
// scripts/env-manager.ts
import * as fs from 'fs';
import * as path from 'path';
import { encrypt, decrypt } from './crypto';

interface EnvironmentConfig {
  name: string;
  variables: Record<string, string>;
  secrets: Record<string, string>;
}

class EnvironmentManager {
  private configPath = path.join(__dirname, '../.env');
  private secretsPath = path.join(__dirname, '../.env.secrets');

  async loadEnvironment(environment: string): Promise<EnvironmentConfig> {
    const config = await this.loadConfig(environment);
    const secrets = await this.loadSecrets(environment);
    
    return {
      name: environment,
      variables: config,
      secrets,
    };
  }

  async saveEnvironment(env: EnvironmentConfig): Promise<void> {
    // Save regular variables
    const envContent = Object.entries(env.variables)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    
    fs.writeFileSync(this.configPath, envContent);

    // Save encrypted secrets
    const encryptedSecrets = {};
    for (const [key, value] of Object.entries(env.secrets)) {
      encryptedSecrets[key] = await encrypt(value);
    }
    
    fs.writeFileSync(
      this.secretsPath,
      JSON.stringify(encryptedSecrets, null, 2)
    );
  }

  async validateEnvironment(env: EnvironmentConfig): Promise<boolean> {
    const requiredVars = [
      'DATABASE_URL',
      'REDIS_URL',
      'JWT_SECRET',
      'AI_CLAUDE_API_KEY',
      'SENDGRID_API_KEY',
    ];

    const missingVars = requiredVars.filter(
      (varName) => !env.variables[varName] && !env.secrets[varName]
    );

    if (missingVars.length > 0) {
      console.error('Missing required variables:', missingVars);
      return false;
    }

    return true;
  }

  private async loadConfig(environment: string): Promise<Record<string, string>> {
    const configFile = path.join(__dirname, `../.env.${environment}`);
    if (!fs.existsSync(configFile)) {
      throw new Error(`Config file not found: ${configFile}`);
    }

    const content = fs.readFileSync(configFile, 'utf-8');
    const config = {};
    
    content.split('\n').forEach((line) => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        config[key.trim()] = valueParts.join('=').trim();
      }
    });

    return config;
  }

  private async loadSecrets(environment: string): Promise<Record<string, string>> {
    const secretsFile = path.join(__dirname, `../.env.${environment}.secrets`);
    if (!fs.existsSync(secretsFile)) {
      return {};
    }

    const encryptedSecrets = JSON.parse(fs.readFileSync(secretsFile, 'utf-8'));
    const secrets = {};
    
    for (const [key, encryptedValue] of Object.entries(encryptedSecrets)) {
      secrets[key] = await decrypt(encryptedValue as string);
    }

    return secrets;
  }
}

export default EnvironmentManager;
```

### Kubernetes Secrets Management

```yaml
# k8s/secrets/external-secrets.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: crm-secrets
  namespace: hastecrm-production
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: SecretStore
    name: aws-secrets-manager
  target:
    name: crm-secrets
    creationPolicy: Owner
  data:
  - secretKey: DATABASE_URL
    remoteRef:
      key: hastecrm/production/database
      property: url
  - secretKey: JWT_SECRET
    remoteRef:
      key: hastecrm/production/auth
      property: jwt_secret
  - secretKey: AI_CLAUDE_API_KEY
    remoteRef:
      key: hastecrm/production/ai
      property: claude_api_key
  - secretKey: AI_OPENAI_API_KEY
    remoteRef:
      key: hastecrm/production/ai
      property: openai_api_key
  - secretKey: SENDGRID_API_KEY
    remoteRef:
      key: hastecrm/production/email
      property: sendgrid_api_key
---
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets-manager
  namespace: hastecrm-production
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        secretRef:
          accessKeyIDSecretRef:
            name: aws-credentials
            key: access-key-id
          secretAccessKeySecretRef:
            name: aws-credentials
            key: secret-access-key
```

## Monitoring Integration

### Deployment Metrics

```typescript
// packages/monitoring/src/deployment/deployment-metrics.ts
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrometheusService } from '../prometheus.service';

@Injectable()
export class DeploymentMetrics {
  private deploymentCounter;
  private deploymentDuration;
  private deploymentStatus;
  private rollbackCounter;

  constructor(
    private prometheus: PrometheusService,
    private eventEmitter: EventEmitter2,
  ) {
    this.initializeMetrics();
    this.subscribeToEvents();
  }

  private initializeMetrics() {
    this.deploymentCounter = new this.prometheus.Counter({
      name: 'deployments_total',
      help: 'Total number of deployments',
      labelNames: ['environment', 'status', 'type'],
    });

    this.deploymentDuration = new this.prometheus.Histogram({
      name: 'deployment_duration_seconds',
      help: 'Duration of deployments in seconds',
      labelNames: ['environment', 'type'],
      buckets: [30, 60, 120, 300, 600, 1200, 1800],
    });

    this.deploymentStatus = new this.prometheus.Gauge({
      name: 'deployment_info',
      help: 'Current deployment information',
      labelNames: ['environment', 'version', 'commit', 'deployed_by'],
    });

    this.rollbackCounter = new this.prometheus.Counter({
      name: 'rollbacks_total',
      help: 'Total number of rollbacks',
      labelNames: ['environment', 'reason'],
    });
  }

  private subscribeToEvents() {
    this.eventEmitter.on('deployment.started', (event) => {
      this.recordDeploymentStart(event);
    });

    this.eventEmitter.on('deployment.completed', (event) => {
      this.recordDeploymentComplete(event);
    });

    this.eventEmitter.on('deployment.failed', (event) => {
      this.recordDeploymentFailed(event);
    });

    this.eventEmitter.on('deployment.rollback', (event) => {
      this.recordRollback(event);
    });
  }

  private recordDeploymentStart(event: any) {
    this.deploymentStatus.set(
      {
        environment: event.environment,
        version: event.version,
        commit: event.commit,
        deployed_by: event.deployedBy,
      },
      1,
    );
  }

  private recordDeploymentComplete(event: any) {
    this.deploymentCounter.inc({
      environment: event.environment,
      status: 'success',
      type: event.type || 'standard',
    });

    this.deploymentDuration.observe(
      {
        environment: event.environment,
        type: event.type || 'standard',
      },
      event.duration,
    );
  }

  private recordDeploymentFailed(event: any) {
    this.deploymentCounter.inc({
      environment: event.environment,
      status: 'failed',
      type: event.type || 'standard',
    });
  }

  private recordRollback(event: any) {
    this.rollbackCounter.inc({
      environment: event.environment,
      reason: event.reason || 'unknown',
    });
  }
}
```

This comprehensive CI/CD pipeline configuration ensures reliable, secure, and monitored deployments for hasteCRM.