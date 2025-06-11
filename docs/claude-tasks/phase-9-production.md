# Phase 9: Production Deployment & Operations

## Overview

Phase 9 focuses on preparing the AI-CRM platform for production deployment, establishing operational procedures, and ensuring the system can handle enterprise-scale workloads reliably and securely.

## Table of Contents

1. [Production Readiness Checklist](#production-readiness-checklist)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Deployment Pipeline](#deployment-pipeline)
4. [Monitoring & Observability](#monitoring--observability)
5. [Performance Optimization](#performance-optimization)
6. [Security Hardening](#security-hardening)
7. [Disaster Recovery](#disaster-recovery)
8. [Operational Procedures](#operational-procedures)
9. [Cost Optimization](#cost-optimization)
10. [Success Metrics](#success-metrics)

## Production Readiness Checklist

### Code Quality
- [ ] All tests passing with >80% coverage
- [ ] No critical security vulnerabilities
- [ ] Code reviewed and approved
- [ ] Performance benchmarks met
- [ ] Documentation complete
- [ ] Error handling comprehensive
- [ ] Logging implemented properly
- [ ] Feature flags configured

### Infrastructure
- [ ] Auto-scaling configured
- [ ] Load balancers set up
- [ ] CDN configured
- [ ] Database replicas ready
- [ ] Redis cluster deployed
- [ ] Message queue configured
- [ ] Backup systems tested
- [ ] SSL certificates installed

### Security
- [ ] Security audit completed
- [ ] Penetration testing passed
- [ ] WAF rules configured
- [ ] DDoS protection enabled
- [ ] Secrets management implemented
- [ ] Access controls verified
- [ ] Compliance requirements met
- [ ] Incident response plan ready

### Monitoring
- [ ] Application monitoring configured
- [ ] Infrastructure monitoring active
- [ ] Log aggregation working
- [ ] Alerting rules defined
- [ ] Dashboards created
- [ ] SLOs established
- [ ] Error tracking integrated
- [ ] Performance monitoring enabled

## Infrastructure Setup

### AWS Architecture

```yaml
# terraform/production/main.tf
provider "aws" {
  region = var.aws_region
}

# VPC Configuration
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  
  name = "crm-production-vpc"
  cidr = "10.0.0.0/16"
  
  azs             = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
  
  enable_nat_gateway = true
  enable_vpn_gateway = true
  enable_dns_hostnames = true
  
  tags = {
    Environment = "production"
    Project     = "ai-crm"
  }
}

# EKS Cluster
module "eks" {
  source = "terraform-aws-modules/eks/aws"
  
  cluster_name    = "crm-production"
  cluster_version = "1.28"
  
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets
  
  node_groups = {
    general = {
      desired_capacity = 3
      max_capacity     = 10
      min_capacity     = 3
      
      instance_types = ["t3.large"]
      
      k8s_labels = {
        Environment = "production"
        NodeType    = "general"
      }
    }
    
    compute = {
      desired_capacity = 2
      max_capacity     = 8
      min_capacity     = 2
      
      instance_types = ["c5.xlarge"]
      
      k8s_labels = {
        Environment = "production"
        NodeType    = "compute"
      }
      
      taints = [{
        key    = "compute"
        value  = "true"
        effect = "NO_SCHEDULE"
      }]
    }
  }
}

# RDS Aurora PostgreSQL
module "rds" {
  source = "terraform-aws-modules/rds-aurora/aws"
  
  name           = "crm-production-db"
  engine         = "aurora-postgresql"
  engine_version = "15.4"
  
  instances = {
    1 = {
      instance_class = "db.r6g.xlarge"
    }
    2 = {
      instance_class = "db.r6g.xlarge"
    }
  }
  
  vpc_id  = module.vpc.vpc_id
  subnets = module.vpc.database_subnets
  
  storage_encrypted = true
  kms_key_id       = aws_kms_key.rds.arn
  
  backup_retention_period = 30
  preferred_backup_window = "03:00-04:00"
  
  enabled_cloudwatch_logs_exports = ["postgresql"]
  
  monitoring_interval = 60
  
  performance_insights_enabled = true
  performance_insights_retention_period = 7
}

# ElastiCache Redis Cluster
module "redis" {
  source = "terraform-aws-modules/elasticache/aws"
  
  cluster_id           = "crm-production-redis"
  engine              = "redis"
  node_type           = "cache.r6g.large"
  num_cache_nodes     = 3
  parameter_group_family = "redis7"
  engine_version      = "7.1"
  port                = 6379
  
  subnet_ids = module.vpc.elasticache_subnets
  
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  
  automatic_failover_enabled = true
  multi_az_enabled          = true
  
  snapshot_retention_limit = 5
  snapshot_window         = "03:00-05:00"
}

# S3 Buckets
resource "aws_s3_bucket" "assets" {
  bucket = "crm-production-assets"
  
  tags = {
    Environment = "production"
  }
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_encryption" "assets" {
  bucket = aws_s3_bucket.assets.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# CloudFront CDN
resource "aws_cloudfront_distribution" "cdn" {
  origin {
    domain_name = aws_s3_bucket.assets.bucket_regional_domain_name
    origin_id   = "S3-${aws_s3_bucket.assets.id}"
    
    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.assets.cloudfront_access_identity_path
    }
  }
  
  enabled             = true
  is_ipv6_enabled    = true
  default_root_object = "index.html"
  
  aliases = ["cdn.crm.com"]
  
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.assets.id}"
    
    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
    
    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true
  }
  
  price_class = "PriceClass_100"
  
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
  
  viewer_certificate {
    acm_certificate_arn = aws_acm_certificate.cdn.arn
    ssl_support_method  = "sni-only"
  }
}

# WAF Configuration
resource "aws_wafv2_web_acl" "main" {
  name  = "crm-production-waf"
  scope = "REGIONAL"
  
  default_action {
    allow {}
  }
  
  rule {
    name     = "RateLimitRule"
    priority = 1
    
    action {
      block {}
    }
    
    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }
    
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "RateLimitRule"
      sampled_requests_enabled   = true
    }
  }
  
  rule {
    name     = "CommonRuleSet"
    priority = 2
    
    override_action {
      none {}
    }
    
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
    
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "CommonRuleSet"
      sampled_requests_enabled   = true
    }
  }
}
```

### Kubernetes Configuration

```yaml
# k8s/production/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: crm-production
  labels:
    environment: production
    
---
# k8s/production/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crm-api
  namespace: crm-production
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: crm-api
  template:
    metadata:
      labels:
        app: crm-api
    spec:
      containers:
      - name: api
        image: crm-api:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: crm-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: crm-secrets
              key: redis-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        
---
# k8s/production/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: crm-api
  namespace: crm-production
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 3000
  selector:
    app: crm-api
    
---
# k8s/production/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: crm-api-hpa
  namespace: crm-production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: crm-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Database Setup

```sql
-- Production database initialization
CREATE DATABASE crm_production;

-- Enable required extensions
\c crm_production;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create read-only user for analytics
CREATE USER crm_analytics WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE crm_production TO crm_analytics;
GRANT USAGE ON SCHEMA public TO crm_analytics;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO crm_analytics;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO crm_analytics;

-- Create application user
CREATE USER crm_app WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE crm_production TO crm_app;
GRANT USAGE ON SCHEMA public TO crm_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO crm_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO crm_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO crm_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO crm_app;

-- Configure connection limits
ALTER DATABASE crm_production SET max_connections = 200;
ALTER DATABASE crm_production SET shared_buffers = '4GB';
ALTER DATABASE crm_production SET effective_cache_size = '12GB';
ALTER DATABASE crm_production SET work_mem = '16MB';
ALTER DATABASE crm_production SET maintenance_work_mem = '512MB';
ALTER DATABASE crm_production SET random_page_cost = 1.1;
ALTER DATABASE crm_production SET effective_io_concurrency = 200;
```

## Deployment Pipeline

### CI/CD Configuration

```yaml
# .github/workflows/production-deploy.yml
name: Production Deployment

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: crm-api
  EKS_CLUSTER_NAME: crm-production

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test -- --coverage
      
      - name: Run security audit
        run: npm audit --production
      
      - name: SonarCloud Scan
        uses: SonarSource/sonarcloud-github-action@master
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

  build:
    needs: test
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.image.outputs.tag }}
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1
      
      - name: Build and push Docker image
        id: image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          echo "tag=$IMAGE_TAG" >> $GITHUB_OUTPUT

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      
      - name: Update kubeconfig
        run: |
          aws eks update-kubeconfig --name ${{ env.EKS_CLUSTER_NAME }} --region ${{ env.AWS_REGION }}
      
      - name: Deploy to Kubernetes
        env:
          IMAGE_TAG: ${{ needs.build.outputs.image-tag }}
        run: |
          kubectl set image deployment/crm-api api=crm-api:$IMAGE_TAG -n crm-production
          kubectl rollout status deployment/crm-api -n crm-production
      
      - name: Run smoke tests
        run: |
          npm run test:smoke
      
      - name: Notify deployment
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Production deployment completed'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### Blue-Green Deployment

```typescript
// scripts/blue-green-deploy.ts
import { ECS, ElasticLoadBalancingV2 } from 'aws-sdk';

class BlueGreenDeployment {
  private ecs: ECS;
  private elb: ElasticLoadBalancingV2;
  
  constructor() {
    this.ecs = new ECS({ region: process.env.AWS_REGION });
    this.elb = new ElasticLoadBalancingV2({ region: process.env.AWS_REGION });
  }
  
  async deploy(imageTag: string): Promise<void> {
    console.log('Starting blue-green deployment...');
    
    // 1. Create new task definition with new image
    const taskDef = await this.createTaskDefinition(imageTag);
    
    // 2. Update green service with new task definition
    await this.updateService('crm-green', taskDef.taskDefinitionArn);
    
    // 3. Wait for green service to be healthy
    await this.waitForHealthyService('crm-green');
    
    // 4. Run smoke tests against green environment
    await this.runSmokeTests('green');
    
    // 5. Switch traffic to green
    await this.switchTraffic('green');
    
    // 6. Monitor for errors
    await this.monitorDeployment(5 * 60 * 1000); // 5 minutes
    
    // 7. Update blue service
    await this.updateService('crm-blue', taskDef.taskDefinitionArn);
    
    console.log('Blue-green deployment completed successfully');
  }
  
  private async switchTraffic(target: 'blue' | 'green'): Promise<void> {
    const targetGroupArn = target === 'blue' 
      ? process.env.BLUE_TARGET_GROUP_ARN 
      : process.env.GREEN_TARGET_GROUP_ARN;
    
    await this.elb.modifyListener({
      ListenerArn: process.env.LISTENER_ARN,
      DefaultActions: [{
        Type: 'forward',
        TargetGroupArn: targetGroupArn
      }]
    }).promise();
  }
  
  private async monitorDeployment(duration: number): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < duration) {
      const errorRate = await this.getErrorRate();
      
      if (errorRate > 0.01) { // 1% error rate threshold
        console.error('High error rate detected, rolling back...');
        await this.rollback();
        throw new Error('Deployment failed due to high error rate');
      }
      
      await new Promise(resolve => setTimeout(resolve, 10000)); // Check every 10s
    }
  }
  
  private async rollback(): Promise<void> {
    await this.switchTraffic('blue');
    console.log('Rollback completed');
  }
}
```

### Database Migrations

```typescript
// scripts/production-migrate.ts
import { Client } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

class ProductionMigration {
  private client: Client;
  
  async run(): Promise<void> {
    // Connect to production database
    this.client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    await this.client.connect();
    
    try {
      // Start transaction
      await this.client.query('BEGIN');
      
      // Create migrations table if not exists
      await this.client.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          filename VARCHAR(255) NOT NULL UNIQUE,
          executed_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      
      // Get pending migrations
      const pendingMigrations = await this.getPendingMigrations();
      
      // Execute migrations
      for (const migration of pendingMigrations) {
        console.log(`Executing migration: ${migration}`);
        
        const sql = readFileSync(
          join(__dirname, '../migrations', migration),
          'utf8'
        );
        
        await this.client.query(sql);
        
        // Record migration
        await this.client.query(
          'INSERT INTO migrations (filename) VALUES ($1)',
          [migration]
        );
      }
      
      // Commit transaction
      await this.client.query('COMMIT');
      
      console.log(`Successfully executed ${pendingMigrations.length} migrations`);
    } catch (error) {
      // Rollback on error
      await this.client.query('ROLLBACK');
      throw error;
    } finally {
      await this.client.end();
    }
  }
  
  private async getPendingMigrations(): Promise<string[]> {
    const result = await this.client.query(
      'SELECT filename FROM migrations'
    );
    
    const executed = new Set(result.rows.map(r => r.filename));
    const all = readdirSync(join(__dirname, '../migrations'))
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    return all.filter(f => !executed.has(f));
  }
}

// Run migration
if (require.main === module) {
  const migration = new ProductionMigration();
  migration.run().catch(console.error);
}
```

## Monitoring & Observability

### Application Monitoring

```typescript
// src/monitoring/metrics.ts
import { StatsD } from 'node-statsd';
import { Counter, Histogram, register } from 'prom-client';

class MetricsCollector {
  private statsd: StatsD;
  private requestDuration: Histogram<string>;
  private requestCount: Counter<string>;
  private errorCount: Counter<string>;
  
  constructor() {
    this.statsd = new StatsD({
      host: process.env.STATSD_HOST || 'localhost',
      port: 8125,
      prefix: 'crm.'
    });
    
    // Prometheus metrics
    this.requestDuration = new Histogram({
      name: 'http_request_duration_ms',
      help: 'Duration of HTTP requests in ms',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 5, 15, 50, 100, 500]
    });
    
    this.requestCount = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code']
    });
    
    this.errorCount = new Counter({
      name: 'errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'operation']
    });
    
    register.registerMetric(this.requestDuration);
    register.registerMetric(this.requestCount);
    register.registerMetric(this.errorCount);
  }
  
  recordRequest(method: string, route: string, statusCode: number, duration: number): void {
    const labels = { method, route, status_code: statusCode.toString() };
    
    this.requestDuration.observe(labels, duration);
    this.requestCount.inc(labels);
    
    // StatsD metrics
    this.statsd.timing(`request.duration.${method}.${route}`, duration);
    this.statsd.increment(`request.count.${method}.${route}.${statusCode}`);
  }
  
  recordError(type: string, operation: string): void {
    this.errorCount.inc({ type, operation });
    this.statsd.increment(`error.${type}.${operation}`);
  }
  
  recordBusinessMetric(metric: string, value: number, tags?: Record<string, string>): void {
    this.statsd.gauge(metric, value, tags);
  }
}

// Express middleware
export function metricsMiddleware(metrics: MetricsCollector) {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      metrics.recordRequest(
        req.method,
        req.route?.path || 'unknown',
        res.statusCode,
        duration
      );
    });
    
    next();
  };
}
```

### Logging Configuration

```typescript
// src/monitoring/logger.ts
import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'crm-api',
    environment: process.env.NODE_ENV,
    version: process.env.APP_VERSION
  },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    
    // File transport for production
    new winston.transports.File({
      filename: '/var/log/crm/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    
    new winston.transports.File({
      filename: '/var/log/crm/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 10
    })
  ]
});

// Add Elasticsearch transport in production
if (process.env.NODE_ENV === 'production') {
  logger.add(new ElasticsearchTransport({
    level: 'info',
    clientOpts: {
      node: process.env.ELASTICSEARCH_URL,
      auth: {
        username: process.env.ELASTICSEARCH_USERNAME,
        password: process.env.ELASTICSEARCH_PASSWORD
      }
    },
    index: 'crm-logs',
    pipeline: 'crm-log-pipeline'
  }));
}

// Request logging middleware
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  // Log request
  logger.info('incoming_request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.id
  });
  
  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.info('outgoing_response', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userId: req.user?.id
    });
  });
  
  next();
}

export default logger;
```

### Dashboards

```yaml
# monitoring/grafana/dashboards/api-overview.json
{
  "dashboard": {
    "title": "CRM API Overview",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [{
          "expr": "sum(rate(http_requests_total[5m])) by (method)"
        }]
      },
      {
        "title": "Response Time (p95)",
        "targets": [{
          "expr": "histogram_quantile(0.95, rate(http_request_duration_ms_bucket[5m]))"
        }]
      },
      {
        "title": "Error Rate",
        "targets": [{
          "expr": "sum(rate(http_requests_total{status_code=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m]))"
        }]
      },
      {
        "title": "Active Users",
        "targets": [{
          "expr": "crm_active_users"
        }]
      },
      {
        "title": "Database Connections",
        "targets": [{
          "expr": "pg_stat_database_numbackends{datname=\"crm_production\"}"
        }]
      },
      {
        "title": "CPU Usage",
        "targets": [{
          "expr": "avg(rate(container_cpu_usage_seconds_total{pod=~\"crm-api-.*\"}[5m])) by (pod)"
        }]
      },
      {
        "title": "Memory Usage",
        "targets": [{
          "expr": "avg(container_memory_working_set_bytes{pod=~\"crm-api-.*\"}) by (pod)"
        }]
      },
      {
        "title": "Pod Count",
        "targets": [{
          "expr": "count(up{job=\"kubernetes-pods\",pod=~\"crm-api-.*\"})"
        }]
      }
    ]
  }
}
```

### Alerting Rules

```yaml
# monitoring/prometheus/alerts.yml
groups:
  - name: crm_api_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status_code=~"5.."}[5m])) /
          sum(rate(http_requests_total[5m])) > 0.05
        for: 5m
        labels:
          severity: critical
          team: backend
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }} for the last 5 minutes"
      
      - alert: HighResponseTime
        expr: |
          histogram_quantile(0.95, rate(http_request_duration_ms_bucket[5m])) > 1000
        for: 5m
        labels:
          severity: warning
          team: backend
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is {{ $value }}ms"
      
      - alert: DatabaseConnectionPoolExhausted
        expr: |
          pg_stat_database_numbackends{datname="crm_production"} /
          pg_settings_max_connections > 0.8
        for: 5m
        labels:
          severity: critical
          team: backend
        annotations:
          summary: "Database connection pool nearly exhausted"
          description: "{{ $value | humanizePercentage }} of connections are in use"
      
      - alert: PodCrashLooping
        expr: |
          rate(kube_pod_container_status_restarts_total{pod=~"crm-api-.*"}[15m]) > 0
        for: 5m
        labels:
          severity: critical
          team: devops
        annotations:
          summary: "Pod {{ $labels.pod }} is crash looping"
          description: "Pod has restarted {{ $value }} times in the last 15 minutes"
      
      - alert: HighMemoryUsage
        expr: |
          container_memory_working_set_bytes{pod=~"crm-api-.*"} /
          container_spec_memory_limit_bytes > 0.9
        for: 5m
        labels:
          severity: warning
          team: backend
        annotations:
          summary: "High memory usage on pod {{ $labels.pod }}"
          description: "Memory usage is {{ $value | humanizePercentage }}"
```

## Performance Optimization

### Caching Strategy

```typescript
// src/caching/cache-manager.ts
import Redis from 'ioredis';
import { LRUCache } from 'lru-cache';

export class CacheManager {
  private redis: Redis;
  private localCache: LRUCache<string, any>;
  
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true
    });
    
    this.localCache = new LRUCache({
      max: 1000,
      ttl: 60 * 1000 // 1 minute
    });
  }
  
  async get<T>(key: string): Promise<T | null> {
    // Check local cache first
    const local = this.localCache.get(key);
    if (local) return local;
    
    // Check Redis
    const value = await this.redis.get(key);
    if (value) {
      const parsed = JSON.parse(value);
      this.localCache.set(key, parsed);
      return parsed;
    }
    
    return null;
  }
  
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    
    // Set in both caches
    this.localCache.set(key, value);
    
    if (ttl) {
      await this.redis.set(key, serialized, 'EX', ttl);
    } else {
      await this.redis.set(key, serialized);
    }
  }
  
  async invalidate(pattern: string): Promise<void> {
    // Clear local cache entries
    for (const key of this.localCache.keys()) {
      if (key.match(pattern)) {
        this.localCache.delete(key);
      }
    }
    
    // Clear Redis entries
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
  
  // Cache-aside pattern implementation
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl: number = 3600
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached) return cached;
    
    const value = await factory();
    await this.set(key, value, ttl);
    
    return value;
  }
  
  // Batch operations
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    const results: (T | null)[] = [];
    const missingKeys: string[] = [];
    const missingIndexes: number[] = [];
    
    // Check local cache
    keys.forEach((key, index) => {
      const local = this.localCache.get(key);
      if (local) {
        results[index] = local;
      } else {
        missingKeys.push(key);
        missingIndexes.push(index);
      }
    });
    
    // Get missing from Redis
    if (missingKeys.length > 0) {
      const values = await this.redis.mget(...missingKeys);
      values.forEach((value, i) => {
        const index = missingIndexes[i];
        if (value) {
          const parsed = JSON.parse(value);
          results[index] = parsed;
          this.localCache.set(missingKeys[i], parsed);
        } else {
          results[index] = null;
        }
      });
    }
    
    return results;
  }
}

// Cache decorators
export function Cacheable(ttl: number = 3600) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const cache = (this as any).cache as CacheManager;
      const key = `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;
      
      return cache.getOrSet(key, () => method.apply(this, args), ttl);
    };
  };
}

export function CacheInvalidate(pattern: string | ((args: any[]) => string)) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const result = await method.apply(this, args);
      
      const cache = (this as any).cache as CacheManager;
      const invalidatePattern = typeof pattern === 'function' ? pattern(args) : pattern;
      
      await cache.invalidate(invalidatePattern);
      
      return result;
    };
  };
}
```

### Database Query Optimization

```typescript
// src/database/query-optimizer.ts
import { PrismaClient } from '@prisma/client';
import { QueryEvent } from '@prisma/client/runtime';

export class OptimizedPrismaClient extends PrismaClient {
  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' }
      ]
    });
    
    // Monitor slow queries
    this.$on('query', (e: QueryEvent) => {
      if (e.duration > 100) {
        logger.warn('Slow query detected', {
          query: e.query,
          params: e.params,
          duration: e.duration,
          target: e.target
        });
      }
    });
  }
  
  // Optimized contact search with full-text search
  async searchContacts(
    workspaceId: string,
    query: string,
    options: {
      limit?: number;
      offset?: number;
      includeDeleted?: boolean;
    } = {}
  ) {
    const { limit = 20, offset = 0, includeDeleted = false } = options;
    
    return this.$queryRaw`
      SELECT 
        c.*,
        ts_rank(
          to_tsvector('english', 
            coalesce(first_name, '') || ' ' || 
            coalesce(last_name, '') || ' ' || 
            coalesce(email, '') || ' ' || 
            coalesce(company, '')
          ),
          plainto_tsquery('english', ${query})
        ) as rank
      FROM contacts c
      WHERE 
        workspace_id = ${workspaceId}
        ${includeDeleted ? '' : 'AND deleted_at IS NULL'}
        AND to_tsvector('english', 
          coalesce(first_name, '') || ' ' || 
          coalesce(last_name, '') || ' ' || 
          coalesce(email, '') || ' ' || 
          coalesce(company, '')
        ) @@ plainto_tsquery('english', ${query})
      ORDER BY rank DESC, created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;
  }
  
  // Batch operations for performance
  async batchUpdate<T>(
    model: string,
    updates: Array<{ id: string; data: any }>
  ): Promise<void> {
    const BATCH_SIZE = 100;
    
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      
      await this.$transaction(
        batch.map(({ id, data }) => 
          (this as any)[model].update({
            where: { id },
            data
          })
        )
      );
    }
  }
  
  // Connection pooling optimization
  async $connect(): Promise<void> {
    await super.$connect();
    
    // Verify connection pool settings
    const poolStatus = await this.$queryRaw`
      SELECT 
        max_connections,
        (SELECT count(*) FROM pg_stat_activity) as current_connections
      FROM pg_settings 
      WHERE name = 'max_connections'
    `;
    
    logger.info('Database connection pool status', poolStatus);
  }
}
```

### CDN and Static Asset Optimization

```typescript
// scripts/optimize-assets.ts
import { S3 } from 'aws-sdk';
import { CloudFront } from 'aws-sdk';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { gzip } from 'zlib';
import { promisify } from 'util';
import sharp from 'sharp';
import { minify } from 'terser';
import CleanCSS from 'clean-css';

const gzipAsync = promisify(gzip);

class AssetOptimizer {
  private s3: S3;
  private cloudfront: CloudFront;
  
  constructor() {
    this.s3 = new S3({ region: process.env.AWS_REGION });
    this.cloudfront = new CloudFront({ region: process.env.AWS_REGION });
  }
  
  async optimizeAndUpload(buildDir: string): Promise<void> {
    const files = await this.getFiles(buildDir);
    
    for (const file of files) {
      const content = await readFile(file);
      const optimized = await this.optimizeFile(file, content);
      
      await this.uploadToS3(file, optimized, buildDir);
    }
    
    // Invalidate CloudFront cache
    await this.invalidateCache();
  }
  
  private async optimizeFile(
    filePath: string,
    content: Buffer
  ): Promise<Buffer> {
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    switch (ext) {
      case 'js':
        return this.optimizeJavaScript(content);
      case 'css':
        return this.optimizeCSS(content);
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'webp':
        return this.optimizeImage(filePath, content);
      default:
        return content;
    }
  }
  
  private async optimizeJavaScript(content: Buffer): Promise<Buffer> {
    const code = content.toString('utf8');
    const minified = await minify(code, {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log']
      },
      mangle: true,
      format: {
        comments: false
      }
    });
    
    return Buffer.from(minified.code || code);
  }
  
  private async optimizeCSS(content: Buffer): Promise<Buffer> {
    const css = content.toString('utf8');
    const minified = new CleanCSS({
      level: 2,
      compatibility: 'ie11'
    }).minify(css);
    
    return Buffer.from(minified.styles);
  }
  
  private async optimizeImage(
    filePath: string,
    content: Buffer
  ): Promise<Buffer> {
    const image = sharp(content);
    const metadata = await image.metadata();
    
    // Generate multiple sizes for responsive images
    const sizes = [
      { width: 320, suffix: '-sm' },
      { width: 768, suffix: '-md' },
      { width: 1024, suffix: '-lg' },
      { width: 1920, suffix: '-xl' }
    ];
    
    for (const size of sizes) {
      if (metadata.width && metadata.width > size.width) {
        const resized = await image
          .resize(size.width)
          .jpeg({ quality: 85, progressive: true })
          .toBuffer();
        
        const newPath = filePath.replace(/\.[^.]+$/, `${size.suffix}.jpg`);
        await this.uploadToS3(newPath, resized, '');
      }
    }
    
    // Optimize original
    return image
      .jpeg({ quality: 90, progressive: true })
      .toBuffer();
  }
  
  private async uploadToS3(
    filePath: string,
    content: Buffer,
    baseDir: string
  ): Promise<void> {
    const key = filePath.replace(baseDir, '').replace(/^\//, '');
    const contentType = this.getContentType(filePath);
    
    // Gzip text files
    const shouldGzip = ['text/', 'application/javascript', 'application/json']
      .some(type => contentType.startsWith(type));
    
    const body = shouldGzip ? await gzipAsync(content) : content;
    
    await this.s3.putObject({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentEncoding: shouldGzip ? 'gzip' : undefined,
      CacheControl: this.getCacheControl(filePath),
      ACL: 'public-read'
    }).promise();
  }
  
  private getCacheControl(filePath: string): string {
    // Immutable for hashed assets
    if (filePath.match(/\.[a-f0-9]{8,}\./)) {
      return 'public, max-age=31536000, immutable';
    }
    
    // Short cache for HTML
    if (filePath.endsWith('.html')) {
      return 'public, max-age=300, s-maxage=3600';
    }
    
    // Default cache
    return 'public, max-age=86400, s-maxage=604800';
  }
  
  private async invalidateCache(): Promise<void> {
    await this.cloudfront.createInvalidation({
      DistributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID!,
      InvalidationBatch: {
        CallerReference: Date.now().toString(),
        Paths: {
          Quantity: 1,
          Items: ['/*']
        }
      }
    }).promise();
  }
}
```

## Security Hardening

### Security Headers

```typescript
// src/security/headers.ts
import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://cdn.segment.com",
          "https://www.google-analytics.com"
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: [
          "'self'",
          "https://api.segment.io",
          "https://sentry.io",
          "wss://crm.com"
        ],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        reportUri: "/api/security/csp-report"
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin'
    },
    permittedCrossDomainPolicies: false
  });
}

// Additional security headers
export function additionalSecurityHeaders(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS filter
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Remove server header
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  // Add security headers for APIs
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  next();
}
```

### WAF Rules

```typescript
// scripts/configure-waf.ts
import { WAFV2 } from 'aws-sdk';

class WAFConfiguration {
  private waf: WAFV2;
  
  constructor() {
    this.waf = new WAFV2({ region: process.env.AWS_REGION });
  }
  
  async configureRules(): Promise<void> {
    const webAclArn = process.env.WAF_WEB_ACL_ARN!;
    
    // Add custom rules
    await this.addRateLimitRule(webAclArn);
    await this.addGeoBlockingRule(webAclArn);
    await this.addSQLInjectionRule(webAclArn);
    await this.addXSSRule(webAclArn);
    await this.addBotProtectionRule(webAclArn);
  }
  
  private async addRateLimitRule(webAclArn: string): Promise<void> {
    await this.waf.updateWebACL({
      Scope: 'REGIONAL',
      Id: webAclArn,
      Rules: [{
        Name: 'RateLimitPerIP',
        Priority: 1,
        Statement: {
          RateBasedStatement: {
            Limit: 2000,
            AggregateKeyType: 'IP',
            ScopeDownStatement: {
              NotStatement: {
                Statement: {
                  IPSetReferenceStatement: {
                    ARN: process.env.WHITELIST_IP_SET_ARN!
                  }
                }
              }
            }
          }
        },
        Action: {
          Block: {
            CustomResponse: {
              ResponseCode: 429,
              CustomResponseBodyKey: 'rate-limit-exceeded'
            }
          }
        },
        VisibilityConfig: {
          SampledRequestsEnabled: true,
          CloudWatchMetricsEnabled: true,
          MetricName: 'RateLimitPerIP'
        }
      }]
    }).promise();
  }
  
  private async addGeoBlockingRule(webAclArn: string): Promise<void> {
    const blockedCountries = ['CN', 'RU', 'KP']; // Example blocked countries
    
    await this.waf.updateWebACL({
      Scope: 'REGIONAL',
      Id: webAclArn,
      Rules: [{
        Name: 'GeoBlocking',
        Priority: 2,
        Statement: {
          GeoMatchStatement: {
            CountryCodes: blockedCountries
          }
        },
        Action: {
          Block: {
            CustomResponse: {
              ResponseCode: 403,
              CustomResponseBodyKey: 'geo-blocked'
            }
          }
        },
        VisibilityConfig: {
          SampledRequestsEnabled: true,
          CloudWatchMetricsEnabled: true,
          MetricName: 'GeoBlocking'
        }
      }]
    }).promise();
  }
  
  private async addSQLInjectionRule(webAclArn: string): Promise<void> {
    await this.waf.updateWebACL({
      Scope: 'REGIONAL',
      Id: webAclArn,
      Rules: [{
        Name: 'SQLInjectionProtection',
        Priority: 3,
        Statement: {
          OrStatement: {
            Statements: [
              {
                SqliMatchStatement: {
                  FieldToMatch: { Body: {} },
                  TextTransformations: [{
                    Priority: 0,
                    Type: 'URL_DECODE'
                  }, {
                    Priority: 1,
                    Type: 'HTML_ENTITY_DECODE'
                  }]
                }
              },
              {
                SqliMatchStatement: {
                  FieldToMatch: { QueryString: {} },
                  TextTransformations: [{
                    Priority: 0,
                    Type: 'URL_DECODE'
                  }]
                }
              }
            ]
          }
        },
        Action: {
          Block: {
            CustomResponse: {
              ResponseCode: 403,
              CustomResponseBodyKey: 'sql-injection-detected'
            }
          }
        },
        VisibilityConfig: {
          SampledRequestsEnabled: true,
          CloudWatchMetricsEnabled: true,
          MetricName: 'SQLInjectionProtection'
        }
      }]
    }).promise();
  }
}
```

### Secrets Management

```typescript
// src/security/secrets-manager.ts
import { SecretsManager } from 'aws-sdk';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export class SecretManager {
  private secretsManager: SecretsManager;
  private cache: Map<string, { value: any; expires: number }> = new Map();
  
  constructor() {
    this.secretsManager = new SecretsManager({
      region: process.env.AWS_REGION
    });
  }
  
  async getSecret(secretId: string): Promise<any> {
    // Check cache
    const cached = this.cache.get(secretId);
    if (cached && cached.expires > Date.now()) {
      return cached.value;
    }
    
    try {
      const response = await this.secretsManager.getSecretValue({
        SecretId: secretId
      }).promise();
      
      const value = response.SecretString 
        ? JSON.parse(response.SecretString)
        : response.SecretBinary;
      
      // Cache for 5 minutes
      this.cache.set(secretId, {
        value,
        expires: Date.now() + 5 * 60 * 1000
      });
      
      return value;
    } catch (error) {
      logger.error('Failed to retrieve secret', { secretId, error });
      throw error;
    }
  }
  
  async rotateSecret(secretId: string): Promise<void> {
    await this.secretsManager.rotateSecret({
      SecretId: secretId,
      RotationRules: {
        AutomaticallyAfterDays: 30
      }
    }).promise();
  }
  
  // Local encryption for sensitive data
  encrypt(text: string, key: Buffer): { encrypted: string; iv: string } {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted: encrypted + ':' + authTag.toString('hex'),
      iv: iv.toString('hex')
    };
  }
  
  decrypt(encryptedData: string, key: Buffer, iv: string): string {
    const [encrypted, authTag] = encryptedData.split(':');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

// Environment variable validation
export function validateEnvironment(): void {
  const required = [
    'NODE_ENV',
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION',
    'SENTRY_DSN'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    );
  }
  
  // Validate format
  if (!process.env.DATABASE_URL!.startsWith('postgres://')) {
    throw new Error('Invalid DATABASE_URL format');
  }
  
  if (!process.env.REDIS_URL!.startsWith('redis://')) {
    throw new Error('Invalid REDIS_URL format');
  }
}
```

## Disaster Recovery

### Backup Strategy

```typescript
// scripts/backup-manager.ts
import { RDS, S3 } from 'aws-sdk';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class BackupManager {
  private rds: RDS;
  private s3: S3;
  
  constructor() {
    this.rds = new RDS({ region: process.env.AWS_REGION });
    this.s3 = new S3({ region: process.env.AWS_REGION });
  }
  
  async createDatabaseBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotId = `crm-backup-${timestamp}`;
    
    // Create RDS snapshot
    await this.rds.createDBSnapshot({
      DBSnapshotIdentifier: snapshotId,
      DBInstanceIdentifier: process.env.RDS_INSTANCE_ID!
    }).promise();
    
    logger.info('Database snapshot created', { snapshotId });
    
    // Export to S3 for long-term storage
    await this.exportSnapshotToS3(snapshotId);
    
    return snapshotId;
  }
  
  private async exportSnapshotToS3(snapshotId: string): Promise<void> {
    const exportTaskId = `export-${snapshotId}`;
    
    await this.rds.startExportTask({
      ExportTaskIdentifier: exportTaskId,
      SourceArn: `arn:aws:rds:${process.env.AWS_REGION}:${process.env.AWS_ACCOUNT_ID}:snapshot:${snapshotId}`,
      S3BucketName: process.env.BACKUP_BUCKET!,
      S3Prefix: `database-exports/${snapshotId}/`,
      IamRoleArn: process.env.BACKUP_ROLE_ARN!,
      KmsKeyId: process.env.KMS_KEY_ID!
    }).promise();
  }
  
  async createApplicationBackup(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Backup application files
    await execAsync(`
      tar -czf /tmp/app-backup-${timestamp}.tar.gz \
        --exclude=node_modules \
        --exclude=.git \
        --exclude=dist \
        /app
    `);
    
    // Upload to S3
    await this.s3.upload({
      Bucket: process.env.BACKUP_BUCKET!,
      Key: `application-backups/app-backup-${timestamp}.tar.gz`,
      Body: require('fs').createReadStream(`/tmp/app-backup-${timestamp}.tar.gz`),
      ServerSideEncryption: 'AES256'
    }).promise();
    
    // Backup Redis data
    await this.backupRedis(timestamp);
  }
  
  private async backupRedis(timestamp: string): Promise<void> {
    // Trigger Redis backup
    await execAsync('redis-cli BGSAVE');
    
    // Wait for backup to complete
    let backupComplete = false;
    while (!backupComplete) {
      const { stdout } = await execAsync('redis-cli LASTSAVE');
      const lastSave = parseInt(stdout);
      
      if (lastSave > Date.now() / 1000 - 60) {
        backupComplete = true;
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Upload to S3
    await this.s3.upload({
      Bucket: process.env.BACKUP_BUCKET!,
      Key: `redis-backups/redis-backup-${timestamp}.rdb`,
      Body: require('fs').createReadStream('/data/dump.rdb'),
      ServerSideEncryption: 'AES256'
    }).promise();
  }
  
  async testRestore(snapshotId: string): Promise<boolean> {
    try {
      // Create test instance from snapshot
      const testInstanceId = `crm-restore-test-${Date.now()}`;
      
      await this.rds.restoreDBInstanceFromDBSnapshot({
        DBInstanceIdentifier: testInstanceId,
        DBSnapshotIdentifier: snapshotId,
        DBInstanceClass: 'db.t3.small'
      }).promise();
      
      // Wait for instance to be available
      await this.rds.waitFor('dbInstanceAvailable', {
        DBInstanceIdentifier: testInstanceId
      }).promise();
      
      // Run integrity checks
      const integrityCheck = await this.runIntegrityChecks(testInstanceId);
      
      // Cleanup test instance
      await this.rds.deleteDBInstance({
        DBInstanceIdentifier: testInstanceId,
        SkipFinalSnapshot: true
      }).promise();
      
      return integrityCheck;
    } catch (error) {
      logger.error('Restore test failed', { snapshotId, error });
      return false;
    }
  }
  
  private async runIntegrityChecks(instanceId: string): Promise<boolean> {
    // Get connection details
    const instance = await this.rds.describeDBInstances({
      DBInstanceIdentifier: instanceId
    }).promise();
    
    const endpoint = instance.DBInstances![0].Endpoint!;
    const connectionString = `postgres://crm_app:${process.env.DB_PASSWORD}@${endpoint.Address}:${endpoint.Port}/crm_production`;
    
    // Run checks
    const { stdout } = await execAsync(`
      psql "${connectionString}" -c "
        SELECT COUNT(*) FROM users;
        SELECT COUNT(*) FROM contacts;
        SELECT COUNT(*) FROM emails;
      "
    `);
    
    // Verify data exists
    return stdout.includes('COUNT') && !stdout.includes('ERROR');
  }
}

// Backup scheduler
export async function scheduleBackups(): Promise<void> {
  const backupManager = new BackupManager();
  
  // Daily database backup at 2 AM
  scheduleJob('0 2 * * *', async () => {
    try {
      const snapshotId = await backupManager.createDatabaseBackup();
      logger.info('Daily database backup completed', { snapshotId });
    } catch (error) {
      logger.error('Daily database backup failed', error);
    }
  });
  
  // Weekly application backup
  scheduleJob('0 3 * * 0', async () => {
    try {
      await backupManager.createApplicationBackup();
      logger.info('Weekly application backup completed');
    } catch (error) {
      logger.error('Weekly application backup failed', error);
    }
  });
  
  // Monthly backup verification
  scheduleJob('0 4 1 * *', async () => {
    try {
      // Get latest snapshot
      const snapshots = await backupManager.rds.describeDBSnapshots({
        DBInstanceIdentifier: process.env.RDS_INSTANCE_ID!,
        MaxRecords: 1
      }).promise();
      
      if (snapshots.DBSnapshots && snapshots.DBSnapshots.length > 0) {
        const result = await backupManager.testRestore(
          snapshots.DBSnapshots[0].DBSnapshotIdentifier!
        );
        
        logger.info('Monthly backup verification completed', { result });
      }
    } catch (error) {
      logger.error('Monthly backup verification failed', error);
    }
  });
}
```

### Disaster Recovery Plan

```markdown
# Disaster Recovery Runbook

## Recovery Time Objectives
- RTO (Recovery Time Objective): 2 hours
- RPO (Recovery Point Objective): 1 hour

## Disaster Scenarios

### 1. Database Failure
```bash
# Step 1: Assess the damage
aws rds describe-db-instances --db-instance-identifier crm-production

# Step 2: Promote read replica if available
aws rds promote-read-replica --db-instance-identifier crm-production-read-1

# Step 3: Or restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier crm-production-restored \
  --db-snapshot-identifier <latest-snapshot-id>

# Step 4: Update application configuration
kubectl set env deployment/crm-api \
  DATABASE_URL=postgres://user:pass@new-endpoint/crm_production \
  -n crm-production

# Step 5: Verify application health
kubectl get pods -n crm-production
curl https://api.crm.com/health
```

### 2. Region Failure
```bash
# Step 1: Switch DNS to secondary region
aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch file://failover-to-secondary.json

# Step 2: Scale up secondary region
kubectl scale deployment crm-api --replicas=10 \
  -n crm-production \
  --context=us-west-2

# Step 3: Verify traffic routing
dig api.crm.com
curl -I https://api.crm.com/health
```

### 3. Data Corruption
```bash
# Step 1: Stop write operations
kubectl scale deployment crm-api --replicas=0 -n crm-production

# Step 2: Identify corruption timeframe
psql $DATABASE_URL -c "
  SELECT MAX(created_at) 
  FROM audit_log 
  WHERE action = 'suspicious_activity'
"

# Step 3: Restore to point in time
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier crm-production \
  --target-db-instance-identifier crm-production-pitr \
  --restore-time "2024-01-15T12:00:00.000Z"

# Step 4: Verify data integrity
psql $NEW_DATABASE_URL -f /scripts/integrity-check.sql

# Step 5: Switch application to restored database
kubectl set env deployment/crm-api \
  DATABASE_URL=$NEW_DATABASE_URL \
  -n crm-production
```

### 4. Security Breach
```bash
# Step 1: Isolate affected systems
aws ec2 modify-instance-attribute \
  --instance-id $INSTANCE_ID \
  --no-source-dest-check

# Step 2: Revoke compromised credentials
aws iam delete-access-key \
  --access-key-id $COMPROMISED_KEY \
  --user-name $USER

# Step 3: Rotate all secrets
kubectl delete secret crm-secrets -n crm-production
kubectl create secret generic crm-secrets \
  --from-literal=jwt-secret=$(openssl rand -base64 32) \
  --from-literal=database-password=$(openssl rand -base64 32) \
  -n crm-production

# Step 4: Force logout all users
redis-cli FLUSHDB

# Step 5: Enable enhanced monitoring
kubectl apply -f security-enhanced-monitoring.yaml
```

## Communication Plan

### Incident Response Team
- **Incident Commander**: CTO
- **Technical Lead**: VP Engineering
- **Communications**: VP Marketing
- **Customer Success**: VP Customer Success

### Communication Channels
1. Internal: Slack #incident-response
2. Status Page: https://status.crm.com
3. Customer Email: Template in `/templates/incident-notification.html`
4. Social Media: Twitter @CRMStatus

### Escalation Matrix
| Severity | Notification Time | Stakeholders |
|----------|------------------|--------------|
| Critical | Immediate | All C-level, Board |
| High | 15 minutes | VP Engineering, CTO |
| Medium | 1 hour | Engineering Manager |
| Low | Next business day | Team Lead |
```

## Operational Procedures

### Runbooks

```markdown
# Production Runbooks

## Daily Operations

### Health Checks
```bash
#!/bin/bash
# daily-health-check.sh

echo "=== CRM Production Health Check ==="
echo "Date: $(date)"

# API Health
echo -n "API Health: "
curl -s https://api.crm.com/health | jq -r .status

# Database Health
echo -n "Database Connections: "
psql $DATABASE_URL -t -c "SELECT count(*) FROM pg_stat_activity"

# Redis Health
echo -n "Redis Memory Usage: "
redis-cli INFO memory | grep used_memory_human

# Disk Usage
echo "Disk Usage:"
df -h | grep -E "Filesystem|/app|/data"

# Error Rate
echo -n "Error Rate (last hour): "
curl -s http://prometheus:9090/api/v1/query \
  --data-urlencode 'query=rate(http_requests_total{status=~"5.."}[1h])' \
  | jq -r '.data.result[0].value[1]'
```

### Deployment Checklist
- [ ] All tests passing
- [ ] Security scan completed
- [ ] Database migrations reviewed
- [ ] Feature flags configured
- [ ] Monitoring alerts configured
- [ ] Documentation updated
- [ ] Communication sent to team
- [ ] Rollback plan prepared

### Incident Response

#### Detection
1. Monitor alerts in PagerDuty
2. Check Datadog dashboards
3. Review Sentry errors
4. Monitor customer support tickets

#### Response
1. Acknowledge incident in PagerDuty
2. Join #incident-response Slack channel
3. Assess severity and impact
4. Implement immediate mitigation
5. Communicate status to stakeholders

#### Resolution
1. Identify root cause
2. Implement permanent fix
3. Verify resolution
4. Update status page
5. Document incident

#### Post-Mortem
1. Schedule post-mortem meeting within 48 hours
2. Create incident report
3. Identify action items
4. Update runbooks
5. Share learnings with team
```

### On-Call Procedures

```typescript
// src/monitoring/on-call.ts
export class OnCallManager {
  async getCurrentOnCall(): Promise<OnCallEngineer> {
    const schedule = await this.pagerduty.getSchedule('primary');
    return schedule.getCurrentOnCall();
  }
  
  async escalate(incident: Incident): Promise<void> {
    const engineer = await this.getCurrentOnCall();
    
    // Page primary on-call
    await this.pagerduty.createIncident({
      title: incident.title,
      urgency: incident.severity === 'critical' ? 'high' : 'low',
      assignee: engineer.id
    });
    
    // If critical, also notify backup
    if (incident.severity === 'critical') {
      const backup = await this.getBackupOnCall();
      await this.slack.sendMessage({
        channel: backup.slackId,
        text: `Critical incident: ${incident.title}`
      });
    }
    
    // Start incident timeline
    await this.startIncidentTimeline(incident);
  }
  
  private async startIncidentTimeline(incident: Incident): Promise<void> {
    await this.createIncidentChannel(incident);
    await this.notifyStakeholders(incident);
    await this.startRecording(incident);
  }
}
```

## Cost Optimization

### Resource Optimization

```typescript
// scripts/cost-optimizer.ts
import { EC2, RDS, CloudWatch } from 'aws-sdk';

export class CostOptimizer {
  async analyzeAndOptimize(): Promise<CostReport> {
    const report: CostReport = {
      currentMonthlyCost: 0,
      potentialSavings: 0,
      recommendations: []
    };
    
    // Analyze EC2 instances
    const ec2Savings = await this.analyzeEC2Usage();
    report.recommendations.push(...ec2Savings);
    
    // Analyze RDS instances
    const rdsSavings = await this.analyzeRDSUsage();
    report.recommendations.push(...rdsSavings);
    
    // Analyze storage
    const storageSavings = await this.analyzeStorageUsage();
    report.recommendations.push(...storageSavings);
    
    // Analyze data transfer
    const transferSavings = await this.analyzeDataTransfer();
    report.recommendations.push(...transferSavings);
    
    return report;
  }
  
  private async analyzeEC2Usage(): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    
    // Get instance utilization
    const instances = await this.ec2.describeInstances().promise();
    
    for (const reservation of instances.Reservations || []) {
      for (const instance of reservation.Instances || []) {
        const utilization = await this.getInstanceUtilization(
          instance.InstanceId!
        );
        
        // Check if oversized
        if (utilization.cpu < 20 && utilization.memory < 30) {
          recommendations.push({
            resource: `EC2 Instance ${instance.InstanceId}`,
            current: instance.InstanceType,
            recommended: this.recommendInstanceType(utilization),
            monthlySavings: this.calculateInstanceSavings(
              instance.InstanceType!,
              this.recommendInstanceType(utilization)
            ),
            description: 'Instance is oversized based on utilization'
          });
        }
        
        // Check for Reserved Instance opportunities
        if (!instance.InstanceLifecycle) {
          recommendations.push({
            resource: `EC2 Instance ${instance.InstanceId}`,
            current: 'On-Demand',
            recommended: 'Reserved Instance',
            monthlySavings: this.calculateRISavings(instance.InstanceType!),
            description: 'Convert to Reserved Instance for stable workloads'
          });
        }
      }
    }
    
    return recommendations;
  }
  
  private async analyzeStorageUsage(): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];
    
    // Analyze S3 buckets
    const buckets = await this.s3.listBuckets().promise();
    
    for (const bucket of buckets.Buckets || []) {
      const lifecycle = await this.s3.getBucketLifecycleConfiguration({
        Bucket: bucket.Name!
      }).promise().catch(() => null);
      
      if (!lifecycle) {
        recommendations.push({
          resource: `S3 Bucket ${bucket.Name}`,
          current: 'No lifecycle policy',
          recommended: 'Add lifecycle policy',
          monthlySavings: 0, // Calculate based on bucket size
          description: 'Add lifecycle rules to move old data to cheaper storage'
        });
      }
      
      // Check for incomplete multipart uploads
      const uploads = await this.s3.listMultipartUploads({
        Bucket: bucket.Name!
      }).promise();
      
      if (uploads.Uploads && uploads.Uploads.length > 0) {
        recommendations.push({
          resource: `S3 Bucket ${bucket.Name}`,
          current: `${uploads.Uploads.length} incomplete uploads`,
          recommended: 'Clean up incomplete uploads',
          monthlySavings: 0, // Calculate based on size
          description: 'Remove incomplete multipart uploads to save storage costs'
        });
      }
    }
    
    return recommendations;
  }
}

// Cost monitoring dashboard
export async function generateCostDashboard(): Promise<void> {
  const costExplorer = new AWS.CostExplorer();
  
  // Get current month costs
  const currentMonth = await costExplorer.getCostAndUsage({
    TimePeriod: {
      Start: moment().startOf('month').format('YYYY-MM-DD'),
      End: moment().format('YYYY-MM-DD')
    },
    Granularity: 'DAILY',
    Metrics: ['UnblendedCost'],
    GroupBy: [{
      Type: 'DIMENSION',
      Key: 'SERVICE'
    }]
  }).promise();
  
  // Get cost forecast
  const forecast = await costExplorer.getCostForecast({
    TimePeriod: {
      Start: moment().format('YYYY-MM-DD'),
      End: moment().endOf('month').format('YYYY-MM-DD')
    },
    Metric: 'UNBLENDED_COST',
    Granularity: 'MONTHLY'
  }).promise();
  
  // Generate report
  const report = {
    currentMonthSpend: calculateTotalCost(currentMonth),
    projectedMonthlySpend: forecast.Total?.Amount,
    topServices: getTopServices(currentMonth),
    dailyTrend: getDailyTrend(currentMonth),
    recommendations: await new CostOptimizer().analyzeAndOptimize()
  };
  
  // Send to stakeholders
  await sendCostReport(report);
}
```

### Auto-Scaling Configuration

```yaml
# k8s/production/autoscaling.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: crm-api-hpa
  namespace: crm-production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: crm-api
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "1000"
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
      - type: Pods
        value: 2
        periodSeconds: 60
      selectPolicy: Min
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 60
      - type: Pods
        value: 4
        periodSeconds: 60
      selectPolicy: Max

---
apiVersion: autoscaling/v2
kind: VerticalPodAutoscaler
metadata:
  name: crm-api-vpa
  namespace: crm-production
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: crm-api
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
    - containerName: api
      minAllowed:
        cpu: 250m
        memory: 256Mi
      maxAllowed:
        cpu: 2
        memory: 2Gi
      controlledResources: ["cpu", "memory"]
```

## Success Metrics

### Key Performance Indicators

```typescript
// src/monitoring/kpis.ts
export interface ProductionKPIs {
  availability: {
    uptime: number; // Target: 99.95%
    mttr: number; // Target: < 15 minutes
    mtbf: number; // Target: > 720 hours
  };
  performance: {
    p50ResponseTime: number; // Target: < 100ms
    p95ResponseTime: number; // Target: < 500ms
    p99ResponseTime: number; // Target: < 1000ms
    throughput: number; // Target: > 10,000 RPS
  };
  reliability: {
    errorRate: number; // Target: < 0.1%
    successRate: number; // Target: > 99.9%
    dataLossIncidents: number; // Target: 0
  };
  scalability: {
    maxConcurrentUsers: number; // Target: > 100,000
    autoScaleResponseTime: number; // Target: < 2 minutes
    capacityUtilization: number; // Target: 60-80%
  };
  security: {
    vulnerabilities: number; // Target: 0 critical, < 5 high
    incidentResponseTime: number; // Target: < 30 minutes
    complianceScore: number; // Target: 100%
  };
  cost: {
    costPerUser: number; // Target: < $0.50/month
    costPerRequest: number; // Target: < $0.0001
    utilizationEfficiency: number; // Target: > 70%
  };
}

export class KPIMonitor {
  async collectKPIs(): Promise<ProductionKPIs> {
    const [
      availability,
      performance,
      reliability,
      scalability,
      security,
      cost
    ] = await Promise.all([
      this.collectAvailabilityMetrics(),
      this.collectPerformanceMetrics(),
      this.collectReliabilityMetrics(),
      this.collectScalabilityMetrics(),
      this.collectSecurityMetrics(),
      this.collectCostMetrics()
    ]);
    
    return {
      availability,
      performance,
      reliability,
      scalability,
      security,
      cost
    };
  }
  
  async generateReport(): Promise<void> {
    const kpis = await this.collectKPIs();
    const report = this.formatReport(kpis);
    
    // Send to stakeholders
    await this.emailService.send({
      to: process.env.KPI_REPORT_RECIPIENTS!.split(','),
      subject: `Production KPI Report - ${new Date().toISOString().split('T')[0]}`,
      html: report
    });
    
    // Post to dashboard
    await this.dashboardService.updateKPIs(kpis);
    
    // Check SLA compliance
    const slaViolations = this.checkSLACompliance(kpis);
    if (slaViolations.length > 0) {
      await this.alertingService.sendSLAViolationAlert(slaViolations);
    }
  }
}
```

### SLA Monitoring

```typescript
// src/monitoring/sla.ts
export const SLATargets = {
  availability: {
    monthly: 99.95, // 21.6 minutes downtime
    quarterly: 99.95, // 65 minutes downtime
    yearly: 99.95 // 4.38 hours downtime
  },
  performance: {
    p95ResponseTime: 500, // milliseconds
    p99ResponseTime: 1000 // milliseconds
  },
  support: {
    criticalResponseTime: 15, // minutes
    highResponseTime: 60, // minutes
    mediumResponseTime: 240 // minutes
  }
};

export class SLAMonitor {
  async checkCompliance(): Promise<SLAComplianceReport> {
    const period = 'monthly';
    const now = new Date();
    const startOfPeriod = moment().startOf('month').toDate();
    
    // Calculate availability
    const downtime = await this.calculateDowntime(startOfPeriod, now);
    const totalMinutes = (now.getTime() - startOfPeriod.getTime()) / (1000 * 60);
    const uptime = ((totalMinutes - downtime) / totalMinutes) * 100;
    
    // Check performance
    const performanceMetrics = await this.getPerformanceMetrics(
      startOfPeriod,
      now
    );
    
    // Check support response times
    const supportMetrics = await this.getSupportMetrics(startOfPeriod, now);
    
    return {
      period,
      availability: {
        target: SLATargets.availability[period],
        actual: uptime,
        compliant: uptime >= SLATargets.availability[period],
        credit: this.calculateCredit(uptime, SLATargets.availability[period])
      },
      performance: {
        p95: {
          target: SLATargets.performance.p95ResponseTime,
          actual: performanceMetrics.p95,
          compliant: performanceMetrics.p95 <= SLATargets.performance.p95ResponseTime
        },
        p99: {
          target: SLATargets.performance.p99ResponseTime,
          actual: performanceMetrics.p99,
          compliant: performanceMetrics.p99 <= SLATargets.performance.p99ResponseTime
        }
      },
      support: {
        critical: {
          target: SLATargets.support.criticalResponseTime,
          actual: supportMetrics.critical,
          compliant: supportMetrics.critical <= SLATargets.support.criticalResponseTime
        }
      }
    };
  }
  
  private calculateCredit(actual: number, target: number): number {
    if (actual >= target) return 0;
    
    const shortfall = target - actual;
    
    // Credit calculation based on shortfall
    if (shortfall < 0.05) return 10; // 10% credit
    if (shortfall < 0.5) return 25; // 25% credit
    if (shortfall < 1) return 50; // 50% credit
    return 100; // 100% credit for severe violations
  }
}
```

## Summary

Phase 9 establishes a robust production environment with:

1. **Infrastructure**: Highly available, scalable architecture on AWS
2. **Deployment**: Automated CI/CD with blue-green deployments
3. **Monitoring**: Comprehensive observability and alerting
4. **Performance**: Optimized for speed and efficiency
5. **Security**: Hardened against common attack vectors
6. **Disaster Recovery**: Tested backup and recovery procedures
7. **Operations**: Clear runbooks and procedures
8. **Cost Management**: Continuous optimization and monitoring

The platform is now ready to handle enterprise-scale workloads with high reliability, security, and performance.