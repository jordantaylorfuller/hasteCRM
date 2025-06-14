# Environment Configuration Guide

## Overview

This document outlines the environment setup and configuration for the hasteCRM application across development, staging, and production environments. Each environment is designed with specific purposes, configurations, and access controls.

## Environment Architecture

```
                                                 
Development         Staging          Production  
   (dev)         �   (stg)         �   (prod)    
                                                 
                                             
      �                   �                    �
                                                 
  Local DB         Staging DB       Production DB
                                                 
```

## Environment Types

### 1. Development Environment

**Purpose**: Active development and testing of new features

**Infrastructure**:
- **URL**: `https://dev.hastecrm.com`
- **API**: `https://api-dev.hastecrm.com`
- **Database**: PostgreSQL 15 (single instance)
- **Redis**: Single instance for caching
- **File Storage**: Local S3-compatible storage (MinIO)

**Configuration**:
```bash
# .env.development
NODE_ENV=development
APP_URL=https://dev.hastecrm.com
API_URL=https://api-dev.hastecrm.com

# Database
DATABASE_URL=postgresql://hastecrm_dev:password@localhost:5432/hastecrm_dev
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Redis
REDIS_URL=redis://localhost:6379/0

# Storage
STORAGE_TYPE=minio
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin
STORAGE_BUCKET=hastecrm-dev

# Email
EMAIL_PROVIDER=mailhog
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false

# Feature Flags
ENABLE_DEBUG_MODE=true
ENABLE_API_DOCS=true
ENABLE_QUERY_LOGGING=true
LOG_LEVEL=debug

# Security
JWT_SECRET=change-me-in-production-min-32-chars
ENCRYPTION_KEY=change-me-encryption-key
SESSION_SECRET=change-me-session-secret
```

**Access Control**:
- All developers have full access
- No production data
- Seed data for testing

### 2. Staging Environment

**Purpose**: Pre-production testing and QA

**Infrastructure**:
- **URL**: `https://staging.hastecrm.com`
- **API**: `https://api-staging.hastecrm.com`
- **Database**: PostgreSQL 15 (primary + read replica)
- **Redis**: Redis cluster (3 nodes)
- **File Storage**: AWS S3 (staging bucket)

**Configuration**:
```bash
# .env.staging
NODE_ENV=staging
APP_URL=https://staging.hastecrm.com
API_URL=https://api-staging.hastecrm.com

# Database
DATABASE_URL=postgresql://hastecrm_stg:${DB_PASSWORD}@staging-db.region.rds.amazonaws.com:5432/hastecrm_staging
DATABASE_READ_URL=postgresql://hastecrm_stg:${DB_PASSWORD}@staging-db-read.region.rds.amazonaws.com:5432/hastecrm_staging
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20

# Redis
REDIS_CLUSTER_NODES=staging-redis-001.cache.amazonaws.com:6379,staging-redis-002.cache.amazonaws.com:6379,staging-redis-003.cache.amazonaws.com:6379

# Storage
STORAGE_TYPE=s3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
STORAGE_BUCKET=hastecrm-staging

# Email
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=${SENDGRID_API_KEY}
FROM_EMAIL=staging@hastecrm.com

# Feature Flags
ENABLE_DEBUG_MODE=false
ENABLE_API_DOCS=true
ENABLE_QUERY_LOGGING=false
LOG_LEVEL=info

# Security
JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
SESSION_SECRET=${SESSION_SECRET}

# Monitoring
SENTRY_DSN=${SENTRY_DSN_STAGING}
NEW_RELIC_LICENSE_KEY=${NEW_RELIC_LICENSE_KEY}
```

**Access Control**:
- QA team has full access
- Developers have read access
- Anonymized production data for testing

### 3. Production Environment

**Purpose**: Live customer-facing application

**Infrastructure**:
- **URL**: `https://app.hastecrm.com`
- **API**: `https://api.hastecrm.com`
- **Database**: PostgreSQL 15 (primary + multiple read replicas)
- **Redis**: Redis cluster (6 nodes) with failover
- **File Storage**: AWS S3 with CloudFront CDN
- **Load Balancer**: AWS ALB with auto-scaling

**Configuration**:
```bash
# .env.production
NODE_ENV=production
APP_URL=https://app.hastecrm.com
API_URL=https://api.hastecrm.com

# Database
DATABASE_URL=postgresql://hastecrm_prod:${DB_PASSWORD}@prod-db-primary.region.rds.amazonaws.com:5432/hastecrm_production
DATABASE_READ_URLS=postgresql://hastecrm_prod:${DB_PASSWORD}@prod-db-read-1.region.rds.amazonaws.com:5432/hastecrm_production,postgresql://hastecrm_prod:${DB_PASSWORD}@prod-db-read-2.region.rds.amazonaws.com:5432/hastecrm_production
DATABASE_POOL_MIN=20
DATABASE_POOL_MAX=100
DATABASE_SSL=require

# Redis
REDIS_CLUSTER_NODES=${REDIS_CLUSTER_NODES}
REDIS_PASSWORD=${REDIS_PASSWORD}

# Storage
STORAGE_TYPE=s3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
STORAGE_BUCKET=hastecrm-production
CDN_URL=https://cdn.hastecrm.com

# Email
EMAIL_PROVIDER=ses
AWS_SES_REGION=us-east-1
FROM_EMAIL=noreply@hastecrm.com

# Feature Flags
ENABLE_DEBUG_MODE=false
ENABLE_API_DOCS=false
ENABLE_QUERY_LOGGING=false
LOG_LEVEL=error

# Security
JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
SESSION_SECRET=${SESSION_SECRET}
ALLOWED_ORIGINS=https://app.hastecrm.com
SECURE_COOKIES=true
HSTS_ENABLED=true

# Monitoring
SENTRY_DSN=${SENTRY_DSN_PRODUCTION}
NEW_RELIC_LICENSE_KEY=${NEW_RELIC_LICENSE_KEY}
DATADOG_API_KEY=${DATADOG_API_KEY}

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=1000
```

**Access Control**:
- DevOps team has infrastructure access
- Support team has read-only data access
- Strict audit logging

### 4. Local Development

**Purpose**: Individual developer environments

**Setup Script**:
```bash
#!/bin/bash
# setup-local.sh

# Install dependencies
npm install
cd packages/api && npm install
cd ../web && npm install
cd ../..

# Setup local databases
docker-compose up -d postgres redis minio

# Wait for services
sleep 10

# Run migrations
npm run db:migrate

# Seed development data
npm run db:seed

# Create .env.local
cp .env.example .env.local
echo " Local environment ready!"
echo "=� Update .env.local with your settings"
echo "=� Run 'npm run dev' to start"
```

**Docker Compose Configuration**:
```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: hastecrm_dev
      POSTGRES_PASSWORD: change-me-local-password
      POSTGRES_DB: hastecrm_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: change-me-minio-user
      MINIO_ROOT_PASSWORD: change-me-minio-password
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data

  mailhog:
    image: mailhog/mailhog:latest
    ports:
      - "1025:1025"
      - "8025:8025"

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

## Environment Variables

### Core Variables

| Variable | Description | Dev | Staging | Production |
|----------|-------------|-----|---------|------------|
| NODE_ENV | Environment name | development | staging | production |
| APP_URL | Frontend URL | dev.hastecrm.com | staging.hastecrm.com | app.hastecrm.com |
| API_URL | Backend API URL | api-dev.hastecrm.com | api-staging.hastecrm.com | api.hastecrm.com |
| LOG_LEVEL | Logging verbosity | debug | info | error |

### Database Variables

| Variable | Description | Required | Encrypted |
|----------|-------------|----------|-----------|
| DATABASE_URL | Primary database connection | Yes | Yes |
| DATABASE_READ_URL | Read replica connection | No | Yes |
| DATABASE_POOL_MIN | Minimum connection pool size | Yes | No |
| DATABASE_POOL_MAX | Maximum connection pool size | Yes | No |
| DATABASE_SSL | SSL requirement | No | No |

### Security Variables

| Variable | Description | Rotation | Storage |
|----------|-------------|----------|---------|
| JWT_SECRET | JWT signing secret | Monthly | AWS Secrets Manager |
| ENCRYPTION_KEY | Data encryption key | Quarterly | AWS KMS |
| SESSION_SECRET | Session encryption | Monthly | AWS Secrets Manager |
| API_KEY_SALT | API key hashing salt | Yearly | AWS Secrets Manager |

## Configuration Management

### 1. Secret Management

**AWS Secrets Manager Integration**:
```typescript
import { SecretsManager } from 'aws-sdk';

class SecretManager {
  private client: SecretsManager;
  private cache: Map<string, { value: string; expires: Date }>;

  constructor() {
    this.client = new SecretsManager({ region: process.env.AWS_REGION });
    this.cache = new Map();
  }

  async getSecret(secretName: string): Promise<string> {
    // Check cache
    const cached = this.cache.get(secretName);
    if (cached && cached.expires > new Date()) {
      return cached.value;
    }

    // Fetch from AWS
    const result = await this.client.getSecretValue({ 
      SecretId: secretName 
    }).promise();

    const value = result.SecretString || '';
    
    // Cache for 1 hour
    this.cache.set(secretName, {
      value,
      expires: new Date(Date.now() + 3600000)
    });

    return value;
  }
}
```

### 2. Feature Flags

**LaunchDarkly Integration**:
```typescript
interface FeatureFlags {
  // Core features
  enableNewDashboard: boolean;
  enableAdvancedSearch: boolean;
  enableAIFeatures: boolean;
  
  // Experiments
  abTestEmailComposer: 'control' | 'variant_a' | 'variant_b';
  
  // Rollout percentages
  rolloutPercentage: {
    newPipeline: number;
    mobileApp: number;
  };
}

const flags = {
  development: {
    enableNewDashboard: true,
    enableAdvancedSearch: true,
    enableAIFeatures: true,
    abTestEmailComposer: 'variant_b',
    rolloutPercentage: {
      newPipeline: 100,
      mobileApp: 100
    }
  },
  staging: {
    enableNewDashboard: true,
    enableAdvancedSearch: true,
    enableAIFeatures: false,
    abTestEmailComposer: 'variant_a',
    rolloutPercentage: {
      newPipeline: 100,
      mobileApp: 50
    }
  },
  production: {
    enableNewDashboard: false,
    enableAdvancedSearch: true,
    enableAIFeatures: false,
    abTestEmailComposer: 'control',
    rolloutPercentage: {
      newPipeline: 25,
      mobileApp: 10
    }
  }
};
```

### 3. Environment-Specific Configs

**Database Configuration**:
```typescript
const dbConfig = {
  development: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    pool: { min: 2, max: 10 },
    migrations: {
      directory: './migrations',
      tableName: 'migrations'
    },
    seeds: {
      directory: './seeds/dev'
    }
  },
  staging: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    pool: { min: 5, max: 20 },
    replicas: [{
      connection: process.env.DATABASE_READ_URL
    }],
    migrations: {
      directory: './migrations',
      tableName: 'migrations'
    }
  },
  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    pool: { min: 20, max: 100 },
    replicas: process.env.DATABASE_READ_URLS?.split(',').map(url => ({
      connection: url
    })),
    ssl: { rejectUnauthorized: false },
    migrations: {
      directory: './migrations',
      tableName: 'migrations'
    }
  }
};
```

## Deployment Pipeline

### 1. Environment Promotion

```yaml
# .github/workflows/promote.yml
name: Promote Environment

on:
  workflow_dispatch:
    inputs:
      from:
        description: 'Source environment'
        required: true
        type: choice
        options:
          - development
          - staging
      to:
        description: 'Target environment'
        required: true
        type: choice
        options:
          - staging
          - production

jobs:
  promote:
    runs-on: ubuntu-latest
    steps:
      - name: Validate promotion path
        run: |
          if [[ "${{ inputs.from }}" == "development" && "${{ inputs.to }}" == "production" ]]; then
            echo "L Cannot promote directly from development to production"
            exit 1
          fi

      - name: Get source version
        id: source
        run: |
          echo "version=$(git describe --tags --abbrev=0)" >> $GITHUB_OUTPUT

      - name: Create promotion PR
        uses: actions/github-script@v6
        with:
          script: |
            await github.rest.pulls.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `Promote ${inputs.from} to ${inputs.to}`,
              head: `${inputs.from}`,
              base: `${inputs.to}`,
              body: `Promoting version ${steps.source.outputs.version}`
            });
```

### 2. Environment Validation

**Health Check Endpoints**:
```typescript
// Health check configuration per environment
const healthChecks = {
  development: {
    endpoints: [
      { url: '/health', timeout: 5000 },
      { url: '/api/health', timeout: 5000 }
    ],
    services: ['postgres', 'redis'],
    required: ['postgres']
  },
  staging: {
    endpoints: [
      { url: '/health', timeout: 3000 },
      { url: '/api/health', timeout: 3000 },
      { url: '/api/health/db', timeout: 5000 }
    ],
    services: ['postgres', 'redis', 's3'],
    required: ['postgres', 'redis']
  },
  production: {
    endpoints: [
      { url: '/health', timeout: 2000 },
      { url: '/api/health', timeout: 2000 },
      { url: '/api/health/db', timeout: 3000 },
      { url: '/api/health/cache', timeout: 2000 }
    ],
    services: ['postgres', 'redis', 's3', 'ses'],
    required: ['postgres', 'redis', 's3']
  }
};
```

## Monitoring & Alerts

### Environment-Specific Monitoring

**Development**:
- Console logging
- Local error tracking
- Query performance logging

**Staging**:
- Sentry error tracking
- Basic APM metrics
- Slack notifications for errors

**Production**:
- Full APM (New Relic/Datadog)
- Custom metrics dashboards
- PagerDuty integration
- Real-time alerting

### Alert Configuration

```yaml
# alerts/production.yml
alerts:
  - name: High Error Rate
    condition: error_rate > 1%
    duration: 5m
    severity: critical
    notify:
      - pagerduty
      - slack-critical

  - name: Database Connection Pool Exhausted
    condition: db_pool_available < 10%
    duration: 2m
    severity: warning
    notify:
      - slack-ops

  - name: API Response Time
    condition: p95_response_time > 500ms
    duration: 10m
    severity: warning
    notify:
      - slack-ops
```

## Backup & Recovery

### Backup Schedule

| Environment | Database | Files | Retention |
|-------------|----------|-------|-----------|
| Development | Daily | None | 7 days |
| Staging | Daily | Weekly | 30 days |
| Production | Continuous | Daily | 90 days |

### Disaster Recovery

**Production RTO/RPO**:
- RTO (Recovery Time Objective): 1 hour
- RPO (Recovery Point Objective): 15 minutes

**Staging RTO/RPO**:
- RTO: 4 hours
- RPO: 1 hour

## Environment Checklist

### New Environment Setup

- [ ] Infrastructure provisioned
- [ ] SSL certificates configured
- [ ] Database created and migrated
- [ ] Redis cluster configured
- [ ] S3 buckets created
- [ ] Environment variables set
- [ ] Secrets stored securely
- [ ] Monitoring configured
- [ ] Alerts configured
- [ ] Backup scheduled
- [ ] Health checks passing
- [ ] Security scan completed
- [ ] Load testing performed
- [ ] Documentation updated
- [ ] Team access configured

### Environment Decommission

- [ ] Data backed up
- [ ] Resources tagged for deletion
- [ ] DNS records updated
- [ ] SSL certificates revoked
- [ ] Secrets rotated/deleted
- [ ] Access revoked
- [ ] Infrastructure destroyed
- [ ] Documentation updated
- [ ] Cost analysis completed