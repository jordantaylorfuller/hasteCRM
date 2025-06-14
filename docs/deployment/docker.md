# Docker Deployment Guide

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Development Environment](#development-environment)
4. [Production Setup](#production-setup)
5. [Docker Compose Configuration](#docker-compose-configuration)
6. [Container Images](#container-images)
7. [Environment Configuration](#environment-configuration)
8. [Networking](#networking)
9. [Data Persistence](#data-persistence)
10. [Health Checks](#health-checks)
11. [Monitoring & Logging](#monitoring--logging)
12. [Security Best Practices](#security-best-practices)
13. [Scaling & Performance](#scaling--performance)
14. [Troubleshooting](#troubleshooting)
15. [CI/CD Integration](#cicd-integration)

## Overview

This guide covers deploying the hasteCRM using Docker and Docker Compose. Our containerized architecture ensures consistent deployments across development, staging, and production environments while maintaining scalability and security.

### Architecture Overview
```
                                                             
                        Docker Host                           
                                                     
     Nginx          Next.js          NestJS API      
     Proxy      �   Frontend   �    + GraphQL        
                                                     
                                                           
                           ,                              
                                                            
                        �                            
   PostgreSQL         Redis           AI Workers      
    Database       Cache/Queue        (BullMQ)        
                                                     
                                                             
```

## Prerequisites

### System Requirements
- Docker Engine 24.0+
- Docker Compose 2.20+
- 8GB RAM minimum (16GB recommended)
- 20GB disk space
- Linux/macOS/Windows with WSL2

### Installation
```bash
# Install Docker (Ubuntu/Debian)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

## =� Development Environment

### Quick Start
```bash
# Clone repository
git clone https://github.com/your-org/hastecrm.git
cd hastecrm

# Copy environment file
cp .env.example .env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Access services
# Frontend: http://localhost:3000
# API: http://localhost:4000/graphql
# pgAdmin: http://localhost:5050
# Redis Commander: http://localhost:8081
```

### Development docker-compose.yml
```yaml
version: '3.9'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: hastecrm-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
      POSTGRES_DB: ${DB_NAME:-crm_dev}
      POSTGRES_INITDB_ARGS: "-c shared_preload_libraries=pg_stat_statements,pgvector"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/01-init.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache & Queue
  redis:
    image: redis:7.2-alpine
    container_name: hastecrm-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # MinIO (S3-compatible storage)
  minio:
    image: minio/minio:latest
    container_name: hastecrm-minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin}
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

  # API Service
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
      target: development
    container_name: hastecrm-api
    restart: unless-stopped
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    volumes:
      - ./apps/api:/app/apps/api
      - ./packages:/app/packages
      - /app/node_modules
    ports:
      - "4000:4000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: npm run dev:api

  # Frontend Service
  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      target: development
    container_name: hastecrm-web
    restart: unless-stopped
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:4000/graphql
      NEXT_PUBLIC_WS_URL: ws://localhost:4000/graphql
    volumes:
      - ./apps/web:/app/apps/web
      - ./packages:/app/packages
      - /app/node_modules
      - /app/.next
    ports:
      - "3000:3000"
    depends_on:
      - api
    command: npm run dev:web

  # Background Workers
  worker:
    build:
      context: .
      dockerfile: apps/worker/Dockerfile
      target: development
    container_name: hastecrm-worker
    restart: unless-stopped
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      REDIS_URL: redis://redis:6379
    volumes:
      - ./apps/worker:/app/apps/worker
      - ./packages:/app/packages
      - /app/node_modules
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: npm run dev:worker

  # Development Tools
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: hastecrm-pgadmin
    restart: unless-stopped
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@example.com
      PGADMIN_DEFAULT_PASSWORD: admin
      PGADMIN_CONFIG_SERVER_MODE: 'False'
    volumes:
      - pgadmin_data:/var/lib/pgadmin
    ports:
      - "5050:80"
    depends_on:
      - postgres

  redis-commander:
    image: rediscommander/redis-commander:latest
    container_name: hastecrm-redis-commander
    restart: unless-stopped
    environment:
      REDIS_HOSTS: local:redis:6379
    ports:
      - "8081:8081"
    depends_on:
      - redis

  mailhog:
    image: mailhog/mailhog:latest
    container_name: hastecrm-mailhog
    restart: unless-stopped
    ports:
      - "1025:1025" # SMTP
      - "8025:8025" # Web UI

volumes:
  postgres_data:
  redis_data:
  minio_data:
  pgadmin_data:

networks:
  default:
    name: hastecrm-network
```

## <� Production Setup

### Production docker-compose.yml
```yaml
version: '3.9'

services:
  # Nginx Reverse Proxy
  nginx:
    image: nginx:alpine
    container_name: hastecrm-nginx
    restart: always
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - static_data:/usr/share/nginx/html/static
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - web
      - api
    networks:
      - frontend
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # PostgreSQL Master
  postgres:
    image: postgres:15-alpine
    container_name: hastecrm-postgres
    restart: always
    environment:
      POSTGRES_USER_FILE: /run/secrets/db_user
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_INITDB_ARGS: "-c shared_preload_libraries=pg_stat_statements,pgvector"
      # Performance tuning
      POSTGRES_MAX_CONNECTIONS: 200
      POSTGRES_SHARED_BUFFERS: 2GB
      POSTGRES_EFFECTIVE_CACHE_SIZE: 6GB
      POSTGRES_MAINTENANCE_WORK_MEM: 512MB
      POSTGRES_WORK_MEM: 16MB
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    secrets:
      - db_user
      - db_password
    networks:
      - backend
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G

  # Redis Cluster
  redis:
    image: redis:7.2-alpine
    container_name: hastecrm-redis
    restart: always
    command: >
      redis-server
      --appendonly yes
      --maxmemory 2gb
      --maxmemory-policy allkeys-lru
      --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - backend
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 2G

  # API Service (Multiple Instances)
  api:
    image: ${DOCKER_REGISTRY}/hastecrm-api:${VERSION:-latest}
    restart: always
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      JWT_SECRET_FILE: /run/secrets/jwt_secret
      GOOGLE_CLIENT_ID_FILE: /run/secrets/google_client_id
      GOOGLE_CLIENT_SECRET_FILE: /run/secrets/google_client_secret
      ANTHROPIC_API_KEY_FILE: /run/secrets/anthropic_api_key
      OPENAI_API_KEY_FILE: /run/secrets/openai_api_key
    secrets:
      - jwt_secret
      - google_client_id
      - google_client_secret
      - anthropic_api_key
      - openai_api_key
    networks:
      - backend
      - frontend
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
        order: start-first
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
      resources:
        limits:
          cpus: '1'
          memory: 1G
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Frontend Service
  web:
    image: ${DOCKER_REGISTRY}/hastecrm-web:${VERSION:-latest}
    restart: always
    environment:
      NODE_ENV: production
    networks:
      - frontend
    deploy:
      replicas: 2
      update_config:
        parallelism: 1
        delay: 10s
      resources:
        limits:
          cpus: '0.5'
          memory: 512M

  # Background Workers
  worker:
    image: ${DOCKER_REGISTRY}/hastecrm-worker:${VERSION:-latest}
    restart: always
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
    secrets:
      - anthropic_api_key
      - openai_api_key
    networks:
      - backend
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: '2'
          memory: 2G

  # Monitoring Stack
  prometheus:
    image: prom/prometheus:latest
    container_name: hastecrm-prometheus
    restart: always
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/usr/share/prometheus/console_libraries'
      - '--web.console.templates=/usr/share/prometheus/consoles'
    networks:
      - monitoring
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    container_name: hastecrm-grafana
    restart: always
    environment:
      GF_SECURITY_ADMIN_USER_FILE: /run/secrets/grafana_user
      GF_SECURITY_ADMIN_PASSWORD_FILE: /run/secrets/grafana_password
      GF_INSTALL_PLUGINS: grafana-clock-panel,grafana-simple-json-datasource
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
    secrets:
      - grafana_user
      - grafana_password
    networks:
      - monitoring
      - frontend
    ports:
      - "3001:3000"

  # Log Aggregation
  loki:
    image: grafana/loki:latest
    container_name: hastecrm-loki
    restart: always
    volumes:
      - ./monitoring/loki-config.yml:/etc/loki/local-config.yaml:ro
      - loki_data:/loki
    networks:
      - monitoring
    command: -config.file=/etc/loki/local-config.yaml

  promtail:
    image: grafana/promtail:latest
    container_name: hastecrm-promtail
    restart: always
    volumes:
      - /var/log:/var/log:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - ./monitoring/promtail-config.yml:/etc/promtail/config.yml:ro
    networks:
      - monitoring
    command: -config.file=/etc/promtail/config.yml

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  static_data:
    driver: local
  prometheus_data:
    driver: local
  grafana_data:
    driver: local
  loki_data:
    driver: local

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true
  monitoring:
    driver: bridge

secrets:
  db_user:
    external: true
  db_password:
    external: true
  jwt_secret:
    external: true
  google_client_id:
    external: true
  google_client_secret:
    external: true
  anthropic_api_key:
    external: true
  openai_api_key:
    external: true
  grafana_user:
    external: true
  grafana_password:
    external: true
```

## =3 Container Images

### Dockerfile Structure

#### API Dockerfile (apps/api/Dockerfile)
```dockerfile
# Base stage
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8

# Dependencies stage
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/*/package.json ./packages/*/
RUN pnpm install --frozen-lockfile

# Builder stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build:api

# Production stage
FROM node:20-alpine AS production
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/dist/apps/api ./
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

# Switch to non-root user
USER nodejs

EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node healthcheck.js

CMD ["node", "main.js"]

# Development stage
FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 4000
CMD ["pnpm", "run", "dev:api"]
```

#### Frontend Dockerfile (apps/web/Dockerfile)
```dockerfile
# Base stage
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g pnpm@8

# Dependencies stage
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/*/package.json ./packages/*/
RUN pnpm install --frozen-lockfile

# Builder stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build arguments for environment variables
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

# Build application
RUN pnpm run build:web

# Production stage
FROM node:20-alpine AS production
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nodejs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nodejs:nodejs /app/apps/web/public ./apps/web/public

USER nodejs

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "apps/web/server.js"]

# Development stage
FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["pnpm", "run", "dev:web"]
```

### Build & Push Commands
```bash
# Build images
docker build -t crm-api:latest -f apps/api/Dockerfile .
docker build -t crm-web:latest -f apps/web/Dockerfile .
docker build -t crm-worker:latest -f apps/worker/Dockerfile .

# Tag for registry
docker tag crm-api:latest ${DOCKER_REGISTRY}/hastecrm-api:${VERSION}
docker tag crm-web:latest ${DOCKER_REGISTRY}/hastecrm-web:${VERSION}
docker tag crm-worker:latest ${DOCKER_REGISTRY}/hastecrm-worker:${VERSION}

# Push to registry
docker push ${DOCKER_REGISTRY}/hastecrm-api:${VERSION}
docker push ${DOCKER_REGISTRY}/hastecrm-web:${VERSION}
docker push ${DOCKER_REGISTRY}/hastecrm-worker:${VERSION}
```

## � Environment Configuration

### Environment Variables (.env)
```bash
# Application
NODE_ENV=production
APP_NAME=hasteCRM
APP_URL=https://hastecrm.com

# Database
DB_HOST=postgres
DB_PORT=5432
DB_USER=crm_user
DB_PASSWORD=change-me-secure-password
DB_NAME=crm_production

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=change-me-redis-password

# Authentication
JWT_SECRET=change-me-in-production-min-32-chars
JWT_EXPIRY=7d
REFRESH_TOKEN_EXPIRY=30d

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://crm.example.com/auth/google/callback

# AI Services
ANTHROPIC_API_KEY=your-anthropic-api-key-here
OPENAI_API_KEY=your-openai-api-key-here
PERPLEXITY_API_KEY=your-perplexity-api-key-here

# Email
SENDGRID_API_KEY=your-sendgrid-api-key-here
EMAIL_FROM=noreply@crm.example.com

# Storage
S3_ENDPOINT=https://s3.amazonaws.com
S3_ACCESS_KEY=your-s3-access-key-here
S3_SECRET_KEY=your-s3-secret-key-here
S3_BUCKET=crm-uploads
S3_REGION=us-east-1

# Monitoring
SENTRY_DSN=https://your-sentry-dsn-here@sentry.io/project
NEW_RELIC_LICENSE_KEY=your-new-relic-license-key-here
```

### Docker Secrets Management
```bash
# Create secrets
echo "crm_user" | docker secret create db_user -
echo "secure_password" | docker secret create db_password -
echo "change-me-jwt-secret-key" | docker secret create jwt_secret -

# Using secrets in containers
docker service create \
  --name api \
  --secret db_user \
  --secret db_password \
  --env DB_USER_FILE=/run/secrets/db_user \
  --env DB_PASSWORD_FILE=/run/secrets/db_password \
  crm-api:latest
```

## < Networking

### Network Architecture
```yaml
# Frontend network (public facing)
networks:
  frontend:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16

# Backend network (internal only)
  backend:
    driver: bridge
    internal: true
    ipam:
      config:
        - subnet: 172.21.0.0/16

# Monitoring network
  monitoring:
    driver: bridge
    ipam:
      config:
        - subnet: 172.22.0.0/16
```

### Service Discovery
```nginx
# nginx.conf
upstream api_backend {
    least_conn;
    server api_1:4000 max_fails=3 fail_timeout=30s;
    server api_2:4000 max_fails=3 fail_timeout=30s;
    server api_3:4000 max_fails=3 fail_timeout=30s;
}

server {
    listen 443 ssl http2;
    server_name api.crm.example.com;

    location / {
        proxy_pass http://api_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## =� Data Persistence

### Volume Management
```bash
# Create named volumes
docker volume create --name crm_postgres_data
docker volume create --name crm_redis_data
docker volume create --name crm_uploads

# Backup volumes
docker run --rm \
  -v crm_postgres_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/postgres_backup_$(date +%Y%m%d).tar.gz -C /data .

# Restore volumes
docker run --rm \
  -v crm_postgres_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/postgres_backup_20240115.tar.gz -C /data
```

### Database Backup Strategy
```bash
#!/bin/bash
# backup.sh

# Variables
BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_CONTAINER="crm-postgres"

# Create backup
docker exec $DB_CONTAINER pg_dump -U postgres crm_production | gzip > $BACKUP_DIR/crm_backup_$TIMESTAMP.sql.gz

# Keep only last 7 days of backups
find $BACKUP_DIR -name "crm_backup_*.sql.gz" -mtime +7 -delete

# Upload to S3 (optional)
aws s3 cp $BACKUP_DIR/crm_backup_$TIMESTAMP.sql.gz s3://crm-backups/daily/
```

## <� Health Checks

### Container Health Checks
```yaml
# PostgreSQL health check
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 30s

# API health check
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s

# Redis health check
healthcheck:
  test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
  interval: 10s
  timeout: 5s
  retries: 5
```

### Health Check Endpoints
```typescript
// API health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      storage: await checkStorage()
    }
  };
  
  const isHealthy = Object.values(health.services).every(s => s.status === 'ok');
  res.status(isHealthy ? 200 : 503).json(health);
});

async function checkDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  } catch (error) {
    return { status: 'error', message: error.message };
  }
}
```

## =� Monitoring & Logging

### Prometheus Configuration
```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'api'
    static_configs:
      - targets: ['api_1:4000', 'api_2:4000', 'api_3:4000']
    metrics_path: '/metrics'

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  - job_name: 'postgres-exporter'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis-exporter'
    static_configs:
      - targets: ['redis-exporter:9121']
```

### Grafana Dashboards
```json
{
  "dashboard": {
    "title": "CRM Platform Overview",
    "panels": [
      {
        "title": "API Response Time",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"
          }
        ]
      },
      {
        "title": "Database Connections",
        "targets": [
          {
            "expr": "pg_stat_database_numbackends{datname=\"crm_production\"}"
          }
        ]
      },
      {
        "title": "Redis Memory Usage",
        "targets": [
          {
            "expr": "redis_memory_used_bytes / redis_memory_max_bytes * 100"
          }
        ]
      }
    ]
  }
}
```

### Centralized Logging
```yaml
# Loki configuration
auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    address: 127.0.0.1
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1

schema_config:
  configs:
    - from: 2024-01-01
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /loki/boltdb-shipper-active
    cache_location: /loki/boltdb-shipper-cache
    shared_store: filesystem
  filesystem:
    directory: /loki/chunks

limits_config:
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h
```

## = Security Best Practices

### Container Security
```dockerfile
# Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

# Minimize attack surface
FROM node:20-alpine AS production
RUN apk add --no-cache libc6-compat && \
    rm -rf /var/cache/apk/*

# Use specific versions
FROM node:20.11.0-alpine3.19

# Scan for vulnerabilities
RUN npm audit fix --production
```

### Network Security
```yaml
# Isolate services
networks:
  backend:
    internal: true
    
# Use TLS/SSL
services:
  nginx:
    volumes:
      - ./ssl/cert.pem:/etc/nginx/ssl/cert.pem:ro
      - ./ssl/key.pem:/etc/nginx/ssl/key.pem:ro
```

### Secrets Management
```bash
# Use Docker secrets
docker secret create db_password ./secrets/db_password.txt

# Environment variable security
# Never commit .env files
echo ".env" >> .gitignore

# Use BuildKit secrets for build time
# syntax=docker/dockerfile:1
RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN=$(cat /run/secrets/npm_token) \
    npm install
```

### Security Scanning
```bash
# Scan images for vulnerabilities
docker scan crm-api:latest

# Use Trivy for comprehensive scanning
trivy image crm-api:latest

# Runtime security with Falco
docker run -i -t \
    --name falco \
    --privileged \
    -v /var/run/docker.sock:/host/var/run/docker.sock \
    -v /dev:/host/dev \
    -v /proc:/host/proc:ro \
    -v /boot:/host/boot:ro \
    -v /lib/modules:/host/lib/modules:ro \
    -v /usr:/host/usr:ro \
    falcosecurity/falco
```

## =� Scaling & Performance

### Horizontal Scaling
```bash
# Scale API service
docker service scale crm_api=5

# Scale workers based on queue depth
docker service update \
  --replicas-max-per-node 2 \
  --replicas 4 \
  crm_worker
```

### Resource Limits
```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
    reservations:
      cpus: '1'
      memory: 1G
```

### Performance Tuning
```yaml
# PostgreSQL optimization
environment:
  POSTGRES_MAX_CONNECTIONS: 200
  POSTGRES_SHARED_BUFFERS: 2GB
  POSTGRES_EFFECTIVE_CACHE_SIZE: 6GB
  POSTGRES_MAINTENANCE_WORK_MEM: 512MB
  POSTGRES_CHECKPOINT_COMPLETION_TARGET: 0.9
  POSTGRES_WAL_BUFFERS: 16MB
  POSTGRES_DEFAULT_STATISTICS_TARGET: 100
  POSTGRES_RANDOM_PAGE_COST: 1.1
```

### Load Balancing
```nginx
# nginx load balancing
upstream api_backend {
    least_conn;
    server api_1:4000 weight=3;
    server api_2:4000 weight=2;
    server api_3:4000 weight=1;
    
    keepalive 32;
}
```

## =' Troubleshooting

### Common Issues

#### Container Won't Start
```bash
# Check logs
docker logs crm-api

# Inspect container
docker inspect crm-api

# Check events
docker events --filter container=crm-api

# Debug mode
docker run -it --rm crm-api:latest sh
```

#### Database Connection Issues
```bash
# Test connection from API container
docker exec -it crm-api sh
apk add postgresql-client
psql -h postgres -U crm_user -d crm_production

# Check network connectivity
docker exec -it crm-api ping postgres
```

#### Performance Issues
```bash
# Check resource usage
docker stats

# Inspect container metrics
docker exec -it crm-api top

# Check disk usage
docker system df

# Clean up
docker system prune -a
```

### Debug Commands
```bash
# Access container shell
docker exec -it crm-api sh

# View real-time logs
docker logs -f crm-api

# Copy files from container
docker cp crm-api:/app/logs/error.log ./error.log

# Run commands in container
docker exec crm-api npm run migrations
```

## = CI/CD Integration

### GitHub Actions Workflow
```yaml
name: Build and Deploy

on:
  push:
    branches: [main]
    tags: ['v*']

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2
        
      - name: Log in to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
          
      - name: Build and push API image
        uses: docker/build-push-action@v4
        with:
          context: .
          file: ./apps/api/Dockerfile
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/api:latest
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/api:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to production
        run: |
          ssh deploy@server "cd /opt/crm && docker-compose pull && docker-compose up -d"
```

### Deployment Script
```bash
#!/bin/bash
# deploy.sh

set -e

# Variables
COMPOSE_FILE="docker-compose.prod.yml"
STACK_NAME="crm"

echo "Pulling latest images..."
docker-compose -f $COMPOSE_FILE pull

echo "Deploying stack..."
docker stack deploy -c $COMPOSE_FILE $STACK_NAME

echo "Waiting for services to be healthy..."
sleep 30

echo "Running migrations..."
docker exec $(docker ps -q -f name=${STACK_NAME}_api) npm run migrate:up

echo "Deployment complete!"
docker service ls
```

## =� Best Practices

### Image Optimization
1. Use multi-stage builds
2. Minimize layers
3. Use alpine images
4. Remove unnecessary files
5. Leverage build cache

### Security
1. Run as non-root user
2. Use secrets for sensitive data
3. Keep images updated
4. Scan for vulnerabilities
5. Implement network isolation

### Performance
1. Set resource limits
2. Use health checks
3. Implement graceful shutdown
4. Monitor resource usage
5. Optimize database queries

### Maintenance
1. Regular backups
2. Log rotation
3. Update dependencies
4. Monitor disk usage
5. Plan for disaster recovery

## = Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)
- [Kubernetes Deployment Guide](./kubernetes.md)
- [Production Checklist](./production-checklist.md)

---

*Docker Deployment Guide v1.0*  
*Last Updated: January 2024*