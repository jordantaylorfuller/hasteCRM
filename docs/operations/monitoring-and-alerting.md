# Monitoring and Alerting Guide

## Overview

This guide defines the monitoring strategy, metrics, alerts, and response procedures for hasteCRM in production.

## Key Metrics

### Service Level Objectives (SLOs)

| Service | SLI | SLO Target | Critical |
|---------|-----|------------|----------|
| API | Availability | 99.9% | 99.5% |
| API | Response Time (p95) | < 200ms | < 500ms |
| Web | Page Load Time | < 2s | < 4s |
| Database | Query Time (p95) | < 50ms | < 100ms |
| Background Jobs | Processing Time | < 30s | < 60s |
| Email Delivery | Success Rate | > 98% | > 95% |

### Golden Signals

#### 1. Latency
```yaml
metrics:
  - name: http_request_duration_seconds
    type: histogram
    labels: [method, endpoint, status]
    
  - name: database_query_duration_seconds
    type: histogram
    labels: [operation, table]
    
  - name: job_processing_duration_seconds
    type: histogram
    labels: [job_type, status]
```

#### 2. Traffic
```yaml
metrics:
  - name: http_requests_total
    type: counter
    labels: [method, endpoint, status]
    
  - name: active_users_total
    type: gauge
    labels: [workspace]
    
  - name: websocket_connections_active
    type: gauge
    labels: [type]
```

#### 3. Errors
```yaml
metrics:
  - name: http_errors_total
    type: counter
    labels: [method, endpoint, error_type]
    
  - name: job_failures_total
    type: counter
    labels: [job_type, error_reason]
    
  - name: external_api_errors_total
    type: counter
    labels: [service, operation]
```

#### 4. Saturation
```yaml
metrics:
  - name: database_connections_active
    type: gauge
    labels: [database]
    
  - name: redis_memory_usage_bytes
    type: gauge
    
  - name: queue_depth
    type: gauge
    labels: [queue_name]
```

## Alert Configuration

### Critical Alerts (Page immediately)

```yaml
alerts:
  - name: APIDown
    expr: up{service="api"} == 0
    for: 1m
    severity: critical
    action: page
    runbook: /runbooks/api-down.md

  - name: DatabaseDown
    expr: postgres_up == 0
    for: 30s
    severity: critical
    action: page
    runbook: /runbooks/database-down.md

  - name: HighErrorRate
    expr: |
      rate(http_errors_total[5m]) / rate(http_requests_total[5m]) > 0.05
    for: 5m
    severity: critical
    action: page
    runbook: /runbooks/high-error-rate.md

  - name: P95LatencyHigh
    expr: |
      histogram_quantile(0.95, http_request_duration_seconds) > 0.5
    for: 5m
    severity: critical
    action: page
    runbook: /runbooks/high-latency.md
```

### Warning Alerts (Notify during business hours)

```yaml
alerts:
  - name: DiskSpaceLow
    expr: disk_free_percent < 20
    for: 10m
    severity: warning
    action: notify
    
  - name: CPUHighUsage
    expr: cpu_usage_percent > 80
    for: 15m
    severity: warning
    action: notify
    
  - name: QueueBacklog
    expr: queue_depth > 1000
    for: 10m
    severity: warning
    action: notify
    
  - name: CacheHitRateLow
    expr: redis_hit_rate < 0.8
    for: 30m
    severity: warning
    action: notify
```

## Dashboards

### System Overview Dashboard

```json
{
  "title": "hasteCRM System Overview",
  "panels": [
    {
      "title": "Request Rate",
      "query": "sum(rate(http_requests_total[5m])) by (service)"
    },
    {
      "title": "Error Rate",
      "query": "sum(rate(http_errors_total[5m])) by (service)"
    },
    {
      "title": "P95 Latency",
      "query": "histogram_quantile(0.95, http_request_duration_seconds)"
    },
    {
      "title": "Active Users",
      "query": "sum(active_users_total)"
    }
  ]
}
```

### API Performance Dashboard

```json
{
  "title": "API Performance",
  "panels": [
    {
      "title": "Requests by Endpoint",
      "query": "sum(rate(http_requests_total[5m])) by (endpoint)"
    },
    {
      "title": "Latency by Endpoint",
      "query": "histogram_quantile(0.95, http_request_duration_seconds) by (endpoint)"
    },
    {
      "title": "GraphQL Query Performance",
      "query": "histogram_quantile(0.95, graphql_query_duration_seconds) by (operation)"
    },
    {
      "title": "Database Query Time",
      "query": "histogram_quantile(0.95, database_query_duration_seconds)"
    }
  ]
}
```

## Logging Strategy

### Log Levels

```typescript
enum LogLevel {
  ERROR = 0,    // System errors, exceptions
  WARN = 1,     // Degraded performance, non-critical issues
  INFO = 2,     // State changes, business events
  DEBUG = 3,    // Detailed execution info
  TRACE = 4     // Very detailed trace info
}

// Production: INFO
// Staging: DEBUG
// Development: DEBUG
```

### Structured Logging

```typescript
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  correlationId: string;
  userId?: string;
  workspaceId?: string;
  message: string;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// Example
logger.info('User login successful', {
  userId: user.id,
  workspaceId: workspace.id,
  correlationId: request.id,
  metadata: {
    loginMethod: 'google',
    ip: request.ip,
    userAgent: request.headers['user-agent']
  }
});
```

### Log Aggregation

```yaml
logging:
  aggregator: datadog
  
  pipelines:
    - name: application
      source: "api,web,worker"
      processing:
        - parse_json
        - extract_attributes
        - mask_sensitive_data
      
    - name: access
      source: "nginx,alb"
      processing:
        - parse_access_log
        - geoip_enrichment
        
    - name: security
      source: "auth,firewall"
      processing:
        - parse_security_events
        - threat_detection
```

## Tracing

### Distributed Tracing Setup

```typescript
import { trace, context } from '@opentelemetry/api';

const tracer = trace.getTracer('hasteCRM');

// Trace HTTP requests
app.use((req, res, next) => {
  const span = tracer.startSpan(`${req.method} ${req.path}`);
  
  span.setAttributes({
    'http.method': req.method,
    'http.url': req.url,
    'http.target': req.path,
    'user.id': req.user?.id,
  });
  
  context.with(trace.setSpan(context.active(), span), () => {
    res.on('finish', () => {
      span.setAttributes({
        'http.status_code': res.statusCode,
      });
      span.end();
    });
    next();
  });
});
```

### Critical User Journeys to Trace

1. **User Login Flow**
   - OAuth redirect
   - Token validation
   - Workspace loading
   - Initial data fetch

2. **Contact Creation**
   - Form submission
   - Validation
   - Database write
   - Enrichment trigger
   - Search indexing

3. **Email Sync**
   - Webhook receipt
   - Message fetch
   - Processing
   - Storage
   - Notification

## Health Checks

### Application Health Endpoints

```typescript
// Liveness probe - is the app running?
app.get('/health/live', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Readiness probe - can the app serve traffic?
app.get('/health/ready', async (req, res) => {
  const checks = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkElasticsearch(),
  ]);
  
  const isReady = checks.every(check => check.healthy);
  
  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not ready',
    checks: checks
  });
});

// Detailed health check
app.get('/health/detailed', authenticate, async (req, res) => {
  const health = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: await checkDatabase(),
    redis: await checkRedis(),
    elasticsearch: await checkElasticsearch(),
    queues: await checkQueues(),
    externalServices: await checkExternalServices(),
  };
  
  res.json(health);
});
```

## Incident Response

### Severity Levels

| Level | Description | Response Time | Example |
|-------|-------------|---------------|---------|
| P1 | Critical - Service Down | 15 min | API unavailable |
| P2 | Major - Degraded Service | 30 min | Slow responses |
| P3 | Minor - Feature Issue | 2 hours | Search not updating |
| P4 | Low - Non-critical | Next day | UI glitch |

### Response Procedures

```yaml
incident_response:
  detection:
    - Alert triggered
    - User report
    - Monitoring anomaly
    
  triage:
    - Acknowledge alert
    - Assess severity
    - Notify stakeholders
    
  diagnosis:
    - Check dashboards
    - Review logs
    - Analyze traces
    
  mitigation:
    - Apply immediate fix
    - Scale resources
    - Failover if needed
    
  resolution:
    - Deploy permanent fix
    - Verify metrics normal
    - Update status page
    
  post_mortem:
    - Timeline of events
    - Root cause analysis
    - Action items
    - Update runbooks
```

## Performance Monitoring

### Application Performance Metrics

```typescript
// Track key operations
const metrics = {
  // API endpoints
  apiLatency: new Histogram({
    name: 'api_request_duration_seconds',
    help: 'API request latency',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
  }),
  
  // Database queries
  dbLatency: new Histogram({
    name: 'db_query_duration_seconds',
    help: 'Database query latency',
    labelNames: ['operation', 'table'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5]
  }),
  
  // Background jobs
  jobDuration: new Histogram({
    name: 'job_duration_seconds',
    help: 'Background job duration',
    labelNames: ['job_type', 'status'],
    buckets: [0.1, 0.5, 1, 5, 10, 30, 60]
  })
};
```

### Database Performance

```sql
-- Slow query monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Key queries to monitor
SELECT 
  query,
  mean_exec_time,
  calls,
  total_exec_time,
  rows
FROM pg_stat_statements
WHERE mean_exec_time > 100  -- queries slower than 100ms
ORDER BY mean_exec_time DESC
LIMIT 20;
```

## Alerting Best Practices

### Alert Fatigue Prevention

1. **Actionable Alerts Only**
   - Every alert should have a clear action
   - Include runbook link in alert

2. **Proper Thresholds**
   - Based on historical data
   - Account for normal variations
   - Regular threshold reviews

3. **Alert Grouping**
   - Group related alerts
   - Prevent notification storms
   - Clear dependencies

4. **Testing Alerts**
   ```bash
   # Test alert routing
   ./scripts/test-alert.sh critical "Test API Down Alert"
   
   # Verify escalation
   ./scripts/test-escalation.sh P1
   ```

## Monitoring Checklist

### Daily
- [ ] Review overnight alerts
- [ ] Check error rates
- [ ] Verify backup completion
- [ ] Review security alerts

### Weekly
- [ ] Analyze performance trends
- [ ] Review capacity metrics
- [ ] Update alert thresholds
- [ ] Test monitoring stack

### Monthly
- [ ] Review SLO compliance
- [ ] Analyze cost metrics
- [ ] Update dashboards
- [ ] Monitoring system updates

### Quarterly
- [ ] Full monitoring audit
- [ ] Runbook updates
- [ ] Alert effectiveness review
- [ ] Capacity planning