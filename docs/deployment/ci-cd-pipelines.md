# CI/CD Pipeline Configuration

## Overview

This document provides complete CI/CD pipeline configurations for hasteCRM using GitHub Actions. The pipelines handle testing, building, and deploying the application.

## Table of Contents

1. [GitHub Actions Workflows](#github-actions-workflows)
2. [Environment Configuration](#environment-configuration)
3. [Deployment Strategies](#deployment-strategies)
4. [Security Scanning](#security-scanning)
5. [Monitoring Integration](#monitoring-integration)

## GitHub Actions Workflows

### Main CI Pipeline

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  NODE_VERSION: '18.x'
  PNPM_VERSION: '8'

jobs:
  # Dependency Installation and Caching
  setup:
    name: Setup
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Get pnpm store directory
        id: pnpm-cache
        shell: bash
        run: |
          echo "STORE_PATH=$(pnpm store path)" >> $GITHUB_OUTPUT

      - name: Setup pnpm cache
        uses: actions/cache@v3
        with:
          path: ${{ steps.pnpm-cache.outputs.STORE_PATH }}
          key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-pnpm-store-

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Cache dependencies
        uses: actions/cache@v3
        with:
          path: |
            node_modules
            apps/*/node_modules
            packages/*/node_modules
          key: ${{ runner.os }}-deps-${{ hashFiles('**/pnpm-lock.yaml') }}

  # Linting and Type Checking
  lint:
    name: Lint & Type Check
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Restore dependencies
        uses: actions/cache@v3
        with:
          path: |
            node_modules
            apps/*/node_modules
            packages/*/node_modules
          key: ${{ runner.os }}-deps-${{ hashFiles('**/pnpm-lock.yaml') }}

      - name: Run ESLint
        run: pnpm lint

      - name: Run TypeScript check
        run: pnpm type-check

      - name: Check formatting
        run: pnpm format:check

  # Unit and Integration Tests
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
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
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
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Restore dependencies
        uses: actions/cache@v3
        with:
          path: |
            node_modules
            apps/*/node_modules
            packages/*/node_modules
          key: ${{ runner.os }}-deps-${{ hashFiles('**/pnpm-lock.yaml') }}

      - name: Setup test database
        run: |
          cp .env.test.example .env.test
          pnpm db:push --force
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/hastecrm_test

      - name: Run tests (shard ${{ matrix.shard }})
        run: pnpm test:ci --shard=${{ matrix.shard }}/4
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/hastecrm_test
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: test-jwt-secret
          NODE_ENV: test

      - name: Upload coverage
        uses: actions/upload-artifact@v3
        with:
          name: coverage-${{ matrix.shard }}
          path: coverage/

  # E2E Tests
  e2e:
    name: E2E Tests
    needs: [lint, test]
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: hastecrm_e2e
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}

      - name: Restore dependencies
        uses: actions/cache@v3
        with:
          path: |
            node_modules
            apps/*/node_modules
            packages/*/node_modules
          key: ${{ runner.os }}-deps-${{ hashFiles('**/pnpm-lock.yaml') }}

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium

      - name: Build application
        run: pnpm build
        env:
          NEXT_PUBLIC_API_URL: http://localhost:4000

      - name: Run E2E tests
        run: pnpm test:e2e
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/hastecrm_e2e
          E2E_TEST: true

      - name: Upload Playwright report
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/

  # Security Scanning
  security:
    name: Security Scan
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

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

      - name: Run npm audit
        run: pnpm audit --audit-level=moderate

      - name: Run CodeQL analysis
        uses: github/codeql-action/analyze@v2

  # Build Docker Images
  build:
    name: Build
    needs: [lint, test, security]
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    strategy:
      matrix:
        app: [web, api, worker]
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: hastenyc/hastecrm-${{ matrix.app }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,prefix={{branch}}-

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./apps/${{ matrix.app }}/Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            APP_NAME=${{ matrix.app }}
            BUILD_DATE=${{ github.event.head_commit.timestamp }}
            VCS_REF=${{ github.sha }}

  # Coverage Report
  coverage:
    name: Coverage Report
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Download coverage artifacts
        uses: actions/download-artifact@v3
        with:
          path: coverage-reports

      - name: Merge coverage reports
        run: |
          npx nyc merge coverage-reports coverage/coverage-final.json
          npx nyc report --reporter=lcov --reporter=text

      - name: Upload to Codecov
        uses: codecov/codecov-action@v3
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          file: ./coverage/lcov.info
          fail_ci_if_error: true

      - name: Comment PR with coverage
        if: github.event_name == 'pull_request'
        uses: romeovs/lcov-reporter-action@v0.3.1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          lcov-file: ./coverage/lcov.info
```

### CD Pipeline - Staging

```yaml
# .github/workflows/deploy-staging.yml
name: Deploy to Staging

on:
  push:
    branches: [develop]
  workflow_dispatch:

env:
  KUBE_CONFIG_DATA: ${{ secrets.KUBE_CONFIG_DATA_STAGING }}
  KUBE_NAMESPACE: hastecrm-staging

jobs:
  deploy:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure kubectl
        run: |
          echo "${{ env.KUBE_CONFIG_DATA }}" | base64 -d > /tmp/kubeconfig
          echo "KUBECONFIG=/tmp/kubeconfig" >> $GITHUB_ENV

      - name: Set image tag
        run: echo "IMAGE_TAG=develop-${GITHUB_SHA::8}" >> $GITHUB_ENV

      - name: Deploy API
        run: |
          kubectl set image deployment/hastecrm-api \
            api=hastenyc/hastecrm-api:${{ env.IMAGE_TAG }} \
            -n ${{ env.KUBE_NAMESPACE }}

      - name: Deploy Web
        run: |
          kubectl set image deployment/hastecrm-web \
            web=hastenyc/hastecrm-web:${{ env.IMAGE_TAG }} \
            -n ${{ env.KUBE_NAMESPACE }}

      - name: Deploy Worker
        run: |
          kubectl set image deployment/hastecrm-worker \
            worker=hastenyc/hastecrm-worker:${{ env.IMAGE_TAG }} \
            -n ${{ env.KUBE_NAMESPACE }}

      - name: Wait for rollout
        run: |
          kubectl rollout status deployment/hastecrm-api -n ${{ env.KUBE_NAMESPACE }}
          kubectl rollout status deployment/hastecrm-web -n ${{ env.KUBE_NAMESPACE }}
          kubectl rollout status deployment/hastecrm-worker -n ${{ env.KUBE_NAMESPACE }}

      - name: Run smoke tests
        run: |
          npm install -g newman
          newman run tests/postman/staging-smoke-tests.json \
            --env-var "baseUrl=https://api-staging.haste.nyc"

      - name: Notify Slack
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Staging deployment ${{ job.status }}'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### CD Pipeline - Production

```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Production

on:
  release:
    types: [published]
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to deploy'
        required: true

env:
  KUBE_CONFIG_DATA: ${{ secrets.KUBE_CONFIG_DATA_PRODUCTION }}
  KUBE_NAMESPACE: hastecrm-production

jobs:
  validate:
    name: Pre-deployment Validation
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.version.outputs.version }}
    steps:
      - name: Determine version
        id: version
        run: |
          if [ "${{ github.event_name }}" = "release" ]; then
            echo "version=${{ github.event.release.tag_name }}" >> $GITHUB_OUTPUT
          else
            echo "version=${{ github.event.inputs.version }}" >> $GITHUB_OUTPUT
          fi

      - name: Validate version format
        run: |
          if ! [[ "${{ steps.version.outputs.version }}" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo "Invalid version format. Expected: vX.Y.Z"
            exit 1
          fi

  backup:
    name: Backup Database
    needs: validate
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Trigger database backup
        run: |
          curl -X POST https://api.haste.nyc/internal/backup \
            -H "Authorization: Bearer ${{ secrets.INTERNAL_API_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{"type": "pre-deployment", "version": "${{ needs.validate.outputs.version }}"}'

      - name: Wait for backup completion
        run: |
          for i in {1..30}; do
            STATUS=$(curl -s https://api.haste.nyc/internal/backup/status \
              -H "Authorization: Bearer ${{ secrets.INTERNAL_API_TOKEN }}")
            if [ "$STATUS" = "completed" ]; then
              echo "Backup completed successfully"
              exit 0
            fi
            sleep 10
          done
          echo "Backup timeout"
          exit 1

  deploy:
    name: Deploy to Production
    needs: [validate, backup]
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          ref: ${{ needs.validate.outputs.version }}

      - name: Configure kubectl
        run: |
          echo "${{ env.KUBE_CONFIG_DATA }}" | base64 -d > /tmp/kubeconfig
          echo "KUBECONFIG=/tmp/kubeconfig" >> $GITHUB_ENV

      - name: Update Kubernetes manifests
        run: |
          export VERSION=${{ needs.validate.outputs.version }}
          envsubst < k8s/production/deployment.yaml | kubectl apply -f -

      - name: Deploy with Blue-Green strategy
        run: |
          # Create new green deployment
          kubectl apply -f k8s/production/deployment-green.yaml
          
          # Wait for green deployment to be ready
          kubectl wait --for=condition=available --timeout=600s \
            deployment/hastecrm-api-green -n ${{ env.KUBE_NAMESPACE }}
          
          # Run health checks on green deployment
          GREEN_URL=$(kubectl get service hastecrm-api-green -n ${{ env.KUBE_NAMESPACE }} -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
          curl -f http://$GREEN_URL/health || exit 1
          
          # Switch traffic to green
          kubectl patch service hastecrm-api -n ${{ env.KUBE_NAMESPACE }} \
            -p '{"spec":{"selector":{"version":"green"}}}'
          
          # Wait and verify
          sleep 30
          
          # Delete old blue deployment
          kubectl delete deployment hastecrm-api-blue -n ${{ env.KUBE_NAMESPACE }} || true
          
          # Rename green to blue for next deployment
          kubectl patch deployment hastecrm-api-green -n ${{ env.KUBE_NAMESPACE }} \
            --type='json' -p='[{"op": "replace", "path": "/metadata/name", "value":"hastecrm-api-blue"}]'

      - name: Run production tests
        run: |
          npm install -g newman
          newman run tests/postman/production-tests.json \
            --env-var "baseUrl=https://api.haste.nyc" \
            --bail

      - name: Update status page
        run: |
          curl -X POST https://status.haste.nyc/api/deployments \
            -H "Authorization: Bearer ${{ secrets.STATUS_PAGE_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{
              "version": "${{ needs.validate.outputs.version }}",
              "status": "completed",
              "environment": "production"
            }'

  rollback:
    name: Rollback if Failed
    needs: [validate, deploy]
    if: failure()
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Configure kubectl
        run: |
          echo "${{ env.KUBE_CONFIG_DATA }}" | base64 -d > /tmp/kubeconfig
          echo "KUBECONFIG=/tmp/kubeconfig" >> $GITHUB_ENV

      - name: Rollback deployment
        run: |
          kubectl rollout undo deployment/hastecrm-api -n ${{ env.KUBE_NAMESPACE }}
          kubectl rollout undo deployment/hastecrm-web -n ${{ env.KUBE_NAMESPACE }}
          kubectl rollout undo deployment/hastecrm-worker -n ${{ env.KUBE_NAMESPACE }}

      - name: Notify team
        uses: 8398a7/action-slack@v3
        with:
          status: failure
          text: 'Production deployment failed and was rolled back!'
          webhook_url: ${{ secrets.SLACK_WEBHOOK_URGENT }}
```

### PR Automation

```yaml
# .github/workflows/pr-automation.yml
name: PR Automation

on:
  pull_request:
    types: [opened, edited, synchronize, ready_for_review]

jobs:
  validate-pr:
    name: Validate PR
    runs-on: ubuntu-latest
    steps:
      - name: Check PR title
        uses: amannn/action-semantic-pull-request@v5
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Label PR
        uses: actions/labeler@v4
        with:
          repo-token: ${{ secrets.GITHUB_TOKEN }}

      - name: Check PR size
        uses: CodelyTV/pr-size-labeler@v1
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          xs_label: 'size/xs'
          xs_max_size: 10
          s_label: 'size/s'
          s_max_size: 100
          m_label: 'size/m'
          m_max_size: 500
          l_label: 'size/l'
          l_max_size: 1000
          xl_label: 'size/xl'

      - name: Check for migrations
        uses: actions/github-script@v6
        with:
          script: |
            const files = await github.rest.pulls.listFiles({
              owner: context.repo.owner,
              repo: context.repo.repo,
              pull_number: context.issue.number
            });
            
            const hasMigrations = files.data.some(file => 
              file.filename.includes('migrations/')
            );
            
            if (hasMigrations) {
              await github.rest.issues.addLabels({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.issue.number,
                labels: ['database-migration']
              });
              
              await github.rest.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.issue.number,
                body: '⚠️ This PR contains database migrations. Please ensure:\n\n- [ ] Migrations are reversible\n- [ ] Migrations have been tested locally\n- [ ] Deployment plan includes migration execution'
              });
            }

  preview-deployment:
    name: Deploy Preview
    runs-on: ubuntu-latest
    if: github.event.pull_request.draft == false
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        id: vercel-deploy
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          scope: ${{ secrets.VERCEL_ORG_ID }}
          alias-domains: pr-${{ github.event.pull_request.number }}.hastecrm.vercel.app

      - name: Comment PR
        uses: actions/github-script@v6
        with:
          script: |
            const url = '${{ steps.vercel-deploy.outputs.preview-url }}';
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: `🚀 Preview deployment ready!\n\n🔗 [View Preview](${url})\n\n_This preview will be automatically deleted when the PR is merged or closed._`
            });
```

### Database Migration Pipeline

```yaml
# .github/workflows/database-migration.yml
name: Database Migration

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to run migrations'
        required: true
        type: choice
        options:
          - staging
          - production
      migration_type:
        description: 'Migration type'
        required: true
        type: choice
        options:
          - up
          - down
          - status

jobs:
  migrate:
    name: Run Migration
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment }}
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18.x'

      - name: Install dependencies
        run: |
          npm install -g prisma
          cd packages/database
          npm install

      - name: Run migrations
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          cd packages/database
          
          case "${{ github.event.inputs.migration_type }}" in
            "up")
              prisma migrate deploy
              ;;
            "down")
              # Custom rollback logic
              npm run migrate:rollback
              ;;
            "status")
              prisma migrate status
              ;;
          esac

      - name: Verify migration
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          cd packages/database
          npm run db:verify

      - name: Notify completion
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Database migration ${{ github.event.inputs.migration_type }} completed in ${{ github.event.inputs.environment }}'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

## Environment Configuration

### GitHub Secrets Setup

```bash
# Required secrets for each environment

# Global
DOCKER_USERNAME
DOCKER_PASSWORD
CODECOV_TOKEN
SLACK_WEBHOOK
SLACK_WEBHOOK_URGENT

# Staging
KUBE_CONFIG_DATA_STAGING
DATABASE_URL_STAGING
REDIS_URL_STAGING
JWT_SECRET_STAGING
ANTHROPIC_API_KEY_STAGING
OPENAI_API_KEY_STAGING
GOOGLE_CLIENT_ID_STAGING
GOOGLE_CLIENT_SECRET_STAGING

# Production
KUBE_CONFIG_DATA_PRODUCTION
DATABASE_URL_PRODUCTION
REDIS_URL_PRODUCTION
JWT_SECRET_PRODUCTION
ANTHROPIC_API_KEY_PRODUCTION
OPENAI_API_KEY_PRODUCTION
GOOGLE_CLIENT_ID_PRODUCTION
GOOGLE_CLIENT_SECRET_PRODUCTION
INTERNAL_API_TOKEN
STATUS_PAGE_TOKEN

# Vercel (for PR previews)
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

### Environment Files

```bash
# .env.example
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password@localhost:5432/hastecrm_dev
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-jwt-secret-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars
NEXT_PUBLIC_API_URL=http://localhost:4000

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:4000/auth/google/callback

# AI Services
ANTHROPIC_API_KEY=your-anthropic-api-key
OPENAI_API_KEY=your-openai-api-key
PERPLEXITY_API_KEY=your-perplexity-api-key

# Email
SENDGRID_API_KEY=your-sendgrid-api-key
EMAIL_FROM=noreply@haste.nyc

# Storage
S3_ACCESS_KEY_ID=your-s3-access-key
S3_SECRET_ACCESS_KEY=your-s3-secret-key
S3_BUCKET=hastecrm-uploads
S3_REGION=us-east-1

# Monitoring
SENTRY_DSN=your-sentry-dsn
NEW_RELIC_LICENSE_KEY=your-new-relic-key
```

## Deployment Strategies

### Blue-Green Deployment Script

```bash
#!/bin/bash
# scripts/blue-green-deploy.sh

set -e

NAMESPACE=${NAMESPACE:-hastecrm-production}
APP_NAME=${APP_NAME:-hastecrm-api}
VERSION=${VERSION:-latest}

echo "Starting blue-green deployment for $APP_NAME:$VERSION"

# Check current active color
CURRENT_COLOR=$(kubectl get service $APP_NAME -n $NAMESPACE -o jsonpath='{.spec.selector.color}')
NEW_COLOR="green"
if [ "$CURRENT_COLOR" = "green" ]; then
  NEW_COLOR="blue"
fi

echo "Current active: $CURRENT_COLOR, deploying to: $NEW_COLOR"

# Update the new color deployment
kubectl set image deployment/$APP_NAME-$NEW_COLOR \
  app=hastenyc/$APP_NAME:$VERSION \
  -n $NAMESPACE

# Wait for rollout
kubectl rollout status deployment/$APP_NAME-$NEW_COLOR -n $NAMESPACE

# Health check
NEW_ENDPOINT=$(kubectl get service $APP_NAME-$NEW_COLOR -n $NAMESPACE -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
for i in {1..30}; do
  if curl -f http://$NEW_ENDPOINT/health; then
    echo "Health check passed"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "Health check failed"
    exit 1
  fi
  sleep 2
done

# Switch traffic
kubectl patch service $APP_NAME -n $NAMESPACE \
  -p '{"spec":{"selector":{"color":"'$NEW_COLOR'"}}}'

echo "Traffic switched to $NEW_COLOR"

# Monitor for 5 minutes
echo "Monitoring for errors..."
sleep 300

# If successful, scale down old deployment
kubectl scale deployment/$APP_NAME-$CURRENT_COLOR --replicas=0 -n $NAMESPACE

echo "Blue-green deployment completed successfully"
```

### Canary Deployment Configuration

```yaml
# k8s/canary/flagger-canary.yaml
apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: hastecrm-api
  namespace: hastecrm-production
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: hastecrm-api
  service:
    port: 80
    targetPort: 4000
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
      interval: 1m
    webhooks:
    - name: load-test
      url: http://flagger-loadtester.test/
      timeout: 5s
      metadata:
        cmd: "hey -z 1m -q 10 -c 2 https://api.haste.nyc/health"
```

## Security Scanning

### SAST Configuration

```yaml
# .github/workflows/security-scan.yml
name: Security Scan

on:
  schedule:
    - cron: '0 0 * * *'  # Daily at midnight
  push:
    branches: [main, develop]

jobs:
  scan:
    name: Security Scanning
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run Semgrep
        uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/security-audit
            p/secrets
            p/owasp-top-ten
            p/typescript
            p/react

      - name: Run Snyk
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

      - name: Run GitLeaks
        uses: zricethezav/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: OWASP Dependency Check
        uses: dependency-check/Dependency-Check_Action@main
        with:
          project: 'hasteCRM'
          path: '.'
          format: 'HTML'
          args: >
            --enableRetired
            --enableExperimental

      - name: Upload reports
        uses: actions/upload-artifact@v3
        with:
          name: security-reports
          path: |
            semgrep-results.sarif
            snyk-results.json
            dependency-check-report.html
```

## Monitoring Integration

### Deployment Metrics Script

```bash
#!/bin/bash
# scripts/deployment-metrics.sh

DEPLOYMENT_ID=$(date +%s)
ENVIRONMENT=$1
VERSION=$2
STATUS=$3

# Send to DataDog
curl -X POST "https://api.datadoghq.com/api/v1/events" \
  -H "DD-API-KEY: $DATADOG_API_KEY" \
  -H "Content-Type: application/json" \
  -d @- <<EOF
{
  "title": "Deployment to $ENVIRONMENT",
  "text": "Version $VERSION deployed with status: $STATUS",
  "tags": ["environment:$ENVIRONMENT", "version:$VERSION", "status:$STATUS"],
  "alert_type": "info"
}
EOF

# Send to New Relic
curl -X POST "https://api.newrelic.com/v2/applications/$NEW_RELIC_APP_ID/deployments.json" \
  -H "X-Api-Key: $NEW_RELIC_API_KEY" \
  -H "Content-Type: application/json" \
  -d @- <<EOF
{
  "deployment": {
    "revision": "$VERSION",
    "environment": "$ENVIRONMENT",
    "user": "$GITHUB_ACTOR",
    "description": "Automated deployment from GitHub Actions"
  }
}
EOF

# Update Grafana annotation
curl -X POST "https://grafana.haste.nyc/api/annotations" \
  -H "Authorization: Bearer $GRAFANA_API_KEY" \
  -H "Content-Type: application/json" \
  -d @- <<EOF
{
  "dashboardUID": "hastecrm-overview",
  "time": $(date +%s)000,
  "tags": ["deployment", "$ENVIRONMENT"],
  "text": "Deployed version $VERSION to $ENVIRONMENT"
}
EOF
```

This completes the comprehensive CI/CD pipeline configuration for hasteCRM.