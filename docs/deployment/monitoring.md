# Monitoring & Observability

## Table of Contents
1. [Overview](#overview)
2. [Monitoring Architecture](#monitoring-architecture)
3. [Metrics Collection](#metrics-collection)
4. [Application Performance Monitoring](#application-performance-monitoring)
5. [Infrastructure Monitoring](#infrastructure-monitoring)
6. [Log Management](#log-management)
7. [Distributed Tracing](#distributed-tracing)
8. [Alerting & Incident Response](#alerting--incident-response)
9. [Custom Dashboards](#custom-dashboards)
10. [Health Checks & Probes](#health-checks--probes)
11. [Performance Optimization](#performance-optimization)
12. [Best Practices](#best-practices)

## Overview

The monitoring and observability stack provides comprehensive visibility into the hasteCRM platform's health, performance, and reliability. It enables proactive issue detection, rapid troubleshooting, and data-driven optimization.

### Key Components
- **Metrics**: Prometheus, Grafana
- **APM**: Datadog, New Relic
- **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana)
- **Tracing**: Jaeger, OpenTelemetry
- **Error Tracking**: Sentry
- **Uptime Monitoring**: Pingdom, StatusCake
- **Infrastructure**: CloudWatch, Google Cloud Monitoring

## <� Monitoring Architecture

### High-Level Architecture
```
                                                             
   Application       �   Collectors        �   Storage       
   Services              & Agents              Systems       
                                                             
                                                        
                                �                        �
                                                              
                      �   Processing        � Visualization   
                           & Analysis            & Alerting    
                                                               
```

### Data Flow
```typescript
interface MonitoringPipeline {
  // Data collection
  collection: {
    metrics: PrometheusAgent;
    logs: FluentBit;
    traces: OpenTelemetryCollector;
    events: CustomEventCollector;
  };
  
  // Processing
  processing: {
    aggregation: StreamProcessor;
    enrichment: DataEnricher;
    sampling: AdaptiveSampler;
  };
  
  // Storage
  storage: {
    metrics: TimescaleDB;
    logs: Elasticsearch;
    traces: Jaeger;
    events: ClickHouse;
  };
  
  // Visualization
  visualization: {
    dashboards: Grafana;
    logs: Kibana;
    traces: JaegerUI;
    analytics: Metabase;
  };
}
```

## =� Metrics Collection

### Prometheus Configuration
```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'production'
    region: 'us-east-1'

scrape_configs:
  # Application metrics
  - job_name: 'api-server'
    kubernetes_sd_configs:
      - role: pod
        namespaces:
          names: ['default']
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
    
  # Node metrics
  - job_name: 'node-exporter'
    kubernetes_sd_configs:
      - role: node
    relabel_configs:
      - action: labelmap
        regex: __meta_kubernetes_node_label_(.+)
      
  # Database metrics
  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']
    
  # Redis metrics
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

# Alerting rules
rule_files:
  - '/etc/prometheus/rules/*.yml'

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

### Application Metrics
```typescript
// Custom metrics implementation
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

export class MetricsService {
  private registry: Registry;
  
  // Business metrics
  private dealCreatedCounter: Counter;
  private emailSentCounter: Counter;
  private aiRequestCounter: Counter;
  
  // Performance metrics
  private apiResponseTime: Histogram;
  private databaseQueryTime: Histogram;
  private cacheHitRate: Gauge;
  
  // System metrics
  private activeUsers: Gauge;
  private queueLength: Gauge;
  private errorRate: Gauge;
  
  constructor() {
    this.registry = new Registry();
    this.initializeMetrics();
  }
  
  private initializeMetrics() {
    // Business metrics
    this.dealCreatedCounter = new Counter({
      name: 'hastecrm_deals_created_total',
      help: 'Total number of deals created',
      labelNames: ['pipeline', 'stage', 'owner'],
      registers: [this.registry]
    });
    
    this.emailSentCounter = new Counter({
      name: 'hastecrm_emails_sent_total',
      help: 'Total number of emails sent',
      labelNames: ['type', 'campaign', 'status'],
      registers: [this.registry]
    });
    
    this.aiRequestCounter = new Counter({
      name: 'hastecrm_ai_requests_total',
      help: 'Total AI API requests',
      labelNames: ['provider', 'model', 'operation', 'status'],
      registers: [this.registry]
    });
    
    // Performance metrics
    this.apiResponseTime = new Histogram({
      name: 'hastecrm_api_response_duration_seconds',
      help: 'API response time in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5],
      registers: [this.registry]
    });
    
    this.databaseQueryTime = new Histogram({
      name: 'hastecrm_database_query_duration_seconds',
      help: 'Database query execution time',
      labelNames: ['operation', 'table'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.registry]
    });
    
    this.cacheHitRate = new Gauge({
      name: 'hastecrm_cache_hit_rate',
      help: 'Cache hit rate percentage',
      labelNames: ['cache_type'],
      registers: [this.registry]
    });
  }
  
  // Record business events
  recordDealCreated(pipeline: string, stage: string, owner: string) {
    this.dealCreatedCounter.inc({ pipeline, stage, owner });
  }
  
  recordEmailSent(type: string, campaign: string, status: string) {
    this.emailSentCounter.inc({ type, campaign, status });
  }
  
  recordAIRequest(provider: string, model: string, operation: string, status: string) {
    this.aiRequestCounter.inc({ provider, model, operation, status });
  }
  
  // Record performance metrics
  recordApiResponse(method: string, route: string, status: number, duration: number) {
    this.apiResponseTime.observe({ method, route, status: status.toString() }, duration);
  }
  
  recordDatabaseQuery(operation: string, table: string, duration: number) {
    this.databaseQueryTime.observe({ operation, table }, duration);
  }
}
```

### Custom Business Metrics
```typescript
// Key business metrics to track
const businessMetrics = {
  // Revenue metrics
  mrr: new Gauge({
    name: 'hastecrm_monthly_recurring_revenue',
    help: 'Monthly recurring revenue in cents',
    labelNames: ['currency', 'plan']
  }),
  
  // User engagement
  dailyActiveUsers: new Gauge({
    name: 'hastecrm_daily_active_users',
    help: 'Number of daily active users',
    labelNames: ['workspace', 'role']
  }),
  
  // Pipeline metrics
  pipelineVelocity: new Histogram({
    name: 'hastecrm_pipeline_velocity_days',
    help: 'Time spent in pipeline stages',
    labelNames: ['pipeline', 'stage'],
    buckets: [1, 3, 7, 14, 30, 60, 90]
  }),
  
  // AI usage
  aiTokenUsage: new Counter({
    name: 'hastecrm_ai_tokens_used_total',
    help: 'Total AI tokens consumed',
    labelNames: ['provider', 'model', 'feature']
  }),
  
  // Email deliverability
  emailDeliveryRate: new Gauge({
    name: 'hastecrm_email_delivery_rate',
    help: 'Email delivery success rate',
    labelNames: ['domain', 'provider']
  })
};
```

## = Application Performance Monitoring

### Datadog APM Configuration
```typescript
// datadog.config.ts
import tracer from 'dd-trace';

tracer.init({
  hostname: process.env.DD_AGENT_HOST || 'localhost',
  port: 8126,
  env: process.env.NODE_ENV,
  service: 'hastecrm-api',
  version: process.env.APP_VERSION,
  
  // Sampling rules
  sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Tags
  tags: {
    team: 'platform',
    component: 'api',
    region: process.env.AWS_REGION
  },
  
  // Integrations
  plugins: {
    http: {
      headers: ['x-request-id', 'x-user-id']
    },
    graphql: {
      signature: true,
      variables: true
    },
    redis: true,
    pg: true,
    elasticsearch: true
  },
  
  // Performance
  runtimeMetrics: true,
  profiling: true
});

export default tracer;
```

### Custom APM Instrumentation
```typescript
// Custom spans for business operations
class APMService {
  // Instrument deal operations
  async trackDealOperation(operation: string, dealId: string, fn: Function) {
    const span = tracer.startSpan('deal.operation', {
      tags: {
        'deal.id': dealId,
        'deal.operation': operation
      }
    });
    
    try {
      const result = await fn();
      span.setTag('deal.success', true);
      return result;
    } catch (error) {
      span.setTag('deal.success', false);
      span.setTag('error', true);
      span.setTag('error.message', error.message);
      throw error;
    } finally {
      span.finish();
    }
  }
  
  // Track AI operations
  async trackAIOperation(provider: string, model: string, operation: string, fn: Function) {
    const span = tracer.startSpan('ai.request', {
      tags: {
        'ai.provider': provider,
        'ai.model': model,
        'ai.operation': operation
      }
    });
    
    const startTime = Date.now();
    
    try {
      const result = await fn();
      
      // Track token usage
      if (result.usage) {
        span.setTag('ai.tokens.prompt', result.usage.prompt_tokens);
        span.setTag('ai.tokens.completion', result.usage.completion_tokens);
        span.setTag('ai.tokens.total', result.usage.total_tokens);
      }
      
      span.setTag('ai.duration_ms', Date.now() - startTime);
      span.setTag('ai.success', true);
      
      return result;
    } catch (error) {
      span.setTag('ai.success', false);
      span.setTag('error', true);
      span.setTag('error.message', error.message);
      throw error;
    } finally {
      span.finish();
    }
  }
}
```

### Performance Profiling
```typescript
// Continuous profiling configuration
import { Profiler } from '@datadog/pprof';

const profiler = new Profiler({
  service: 'hastecrm-api',
  version: process.env.APP_VERSION,
  env: process.env.NODE_ENV,
  
  // Profile types
  types: ['cpu', 'heap', 'heap_live_objects'],
  
  // Sampling
  period: 60, // seconds
  
  // Upload configuration
  uploadTimeout: 30000,
  
  // Tags
  tags: {
    team: 'platform',
    component: 'api'
  }
});

// Start profiling
if (process.env.NODE_ENV === 'production') {
  profiler.start();
}
```

## =� Infrastructure Monitoring

### Kubernetes Monitoring
```yaml
# ServiceMonitor for Prometheus Operator
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: hastecrm-api
  labels:
    app: hastecrm
spec:
  selector:
    matchLabels:
      app: hastecrm-api
  endpoints:
    - port: metrics
      interval: 30s
      path: /metrics
      
---
# PodMonitor for detailed pod metrics
apiVersion: monitoring.coreos.com/v1
kind: PodMonitor
metadata:
  name: hastecrm-pods
spec:
  selector:
    matchLabels:
      app.kubernetes.io/part-of: hastecrm
  podMetricsEndpoints:
    - port: metrics
      interval: 30s
```

### Node and Container Metrics
```typescript
// Node metrics collection
const nodeMetrics = {
  // CPU metrics
  cpuUsage: new Gauge({
    name: 'node_cpu_usage_percent',
    help: 'CPU usage percentage',
    labelNames: ['node', 'cpu']
  }),
  
  // Memory metrics
  memoryUsage: new Gauge({
    name: 'node_memory_usage_bytes',
    help: 'Memory usage in bytes',
    labelNames: ['node', 'type']
  }),
  
  // Disk metrics
  diskUsage: new Gauge({
    name: 'node_disk_usage_bytes',
    help: 'Disk usage in bytes',
    labelNames: ['node', 'device', 'mountpoint']
  }),
  
  // Network metrics
  networkThroughput: new Counter({
    name: 'node_network_bytes_total',
    help: 'Network throughput in bytes',
    labelNames: ['node', 'interface', 'direction']
  })
};

// Container metrics
const containerMetrics = {
  // Resource limits
  cpuLimit: new Gauge({
    name: 'container_cpu_limit',
    help: 'CPU limit for container',
    labelNames: ['pod', 'container', 'namespace']
  }),
  
  memoryLimit: new Gauge({
    name: 'container_memory_limit_bytes',
    help: 'Memory limit for container',
    labelNames: ['pod', 'container', 'namespace']
  }),
  
  // Restart counts
  restartCount: new Counter({
    name: 'container_restart_count_total',
    help: 'Container restart count',
    labelNames: ['pod', 'container', 'namespace', 'reason']
  })
};
```

### Database Monitoring
```sql
-- PostgreSQL monitoring views
CREATE OR REPLACE VIEW monitoring.database_metrics AS
SELECT 
  -- Connection metrics
  COUNT(*) FILTER (WHERE state = 'active') as active_connections,
  COUNT(*) FILTER (WHERE state = 'idle') as idle_connections,
  COUNT(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
  
  -- Query performance
  COUNT(*) FILTER (WHERE wait_event_type IS NOT NULL) as queries_waiting,
  MAX(EXTRACT(EPOCH FROM (NOW() - query_start))) as longest_query_seconds,
  
  -- Database size
  pg_database_size(current_database()) as database_size_bytes,
  
  -- Cache hit ratio
  sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) as cache_hit_ratio
FROM pg_stat_activity
CROSS JOIN pg_stat_database
WHERE datname = current_database();

-- Slow query monitoring
CREATE OR REPLACE VIEW monitoring.slow_queries AS
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  stddev_time,
  rows
FROM pg_stat_statements
WHERE mean_time > 100 -- milliseconds
ORDER BY mean_time DESC
LIMIT 50;
```

## =� Log Management

### Centralized Logging Architecture
```yaml
# Fluentd configuration
<source>
  @type tail
  path /var/log/containers/*.log
  pos_file /var/log/fluentd-containers.log.pos
  tag kubernetes.*
  <parse>
    @type json
    time_format %Y-%m-%dT%H:%M:%S.%NZ
  </parse>
</source>

# Add metadata
<filter kubernetes.**>
  @type kubernetes_metadata
  @log_level info
</filter>

# Parse application logs
<filter kubernetes.**>
  @type parser
  key_name log
  reserve_data true
  <parse>
    @type json
  </parse>
</filter>

# Add custom fields
<filter kubernetes.**>
  @type record_transformer
  <record>
    environment ${ENV}
    cluster ${CLUSTER_NAME}
    region ${AWS_REGION}
  </record>
</filter>

# Output to Elasticsearch
<match kubernetes.**>
  @type elasticsearch
  host elasticsearch.monitoring.svc.cluster.local
  port 9200
  logstash_format true
  logstash_prefix hastecrm-logs
  <buffer>
    @type file
    path /var/log/fluentd-buffers/kubernetes.system.buffer
    flush_mode interval
    flush_interval 5s
    flush_thread_count 2
    chunk_limit_size 2M
    queue_limit_length 8
    overflow_action drop_oldest_chunk
  </buffer>
</match>
```

### Structured Logging
```typescript
// Logger configuration
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
    service: 'hastecrm-api',
    environment: process.env.NODE_ENV,
    version: process.env.APP_VERSION
  },
  transports: [
    // Console output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    
    // Elasticsearch
    new ElasticsearchTransport({
      index: 'hastecrm-logs',
      clientOpts: {
        node: process.env.ELASTICSEARCH_URL,
        auth: {
          username: process.env.ELASTICSEARCH_USER,
          password: process.env.ELASTICSEARCH_PASSWORD
        }
      }
    })
  ]
});

// Log context middleware
export const logContext = (req: Request, res: Response, next: NextFunction) => {
  const context = {
    requestId: req.id,
    userId: req.user?.id,
    workspaceId: req.user?.workspaceId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  };
  
  // Add context to all logs in this request
  req.log = logger.child(context);
  
  next();
};
```

### Log Aggregation Queries
```json
// Elasticsearch queries for log analysis
{
  // Error rate by service
  "error_rate": {
    "size": 0,
    "query": {
      "range": {
        "@timestamp": {
          "gte": "now-1h"
        }
      }
    },
    "aggs": {
      "by_service": {
        "terms": {
          "field": "service.keyword"
        },
        "aggs": {
          "error_count": {
            "filter": {
              "term": {
                "level": "error"
              }
            }
          },
          "error_rate": {
            "bucket_script": {
              "buckets_path": {
                "errors": "error_count._count",
                "total": "_count"
              },
              "script": "params.errors / params.total * 100"
            }
          }
        }
      }
    }
  },
  
  // Top errors
  "top_errors": {
    "size": 0,
    "query": {
      "bool": {
        "filter": [
          { "term": { "level": "error" } },
          { "range": { "@timestamp": { "gte": "now-24h" } } }
        ]
      }
    },
    "aggs": {
      "by_error": {
        "terms": {
          "field": "error.message.keyword",
          "size": 20
        },
        "aggs": {
          "sample_stack": {
            "top_hits": {
              "size": 1,
              "_source": ["error.stack"]
            }
          }
        }
      }
    }
  }
}
```

## = Distributed Tracing

### OpenTelemetry Configuration
```typescript
// OpenTelemetry setup
import { NodeSDK } from '@opentelemetry/sdk-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const jaegerExporter = new JaegerExporter({
  endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
  serviceName: 'hastecrm-api'
});

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'hastecrm-api',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.APP_VERSION,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV
  }),
  traceExporter: jaegerExporter,
  
  // Sampling configuration
  sampler: {
    shouldSample: (context) => {
      // Sample all errors
      if (context.attributes?.['error']) return { decision: true };
      
      // Sample slow requests
      if (context.attributes?.['http.duration'] > 1000) return { decision: true };
      
      // Sample 10% of normal traffic
      return { decision: Math.random() < 0.1 };
    }
  }
});

sdk.start();
```

### Custom Trace Instrumentation
```typescript
// Trace business operations
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('hastecrm-api');

export class TracingService {
  // Trace email sending
  async traceEmailOperation(emailId: string, operation: string, fn: Function) {
    const span = tracer.startSpan(`email.${operation}`, {
      attributes: {
        'email.id': emailId,
        'email.operation': operation
      }
    });
    
    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        const result = await fn();
        
        // Add result attributes
        if (result.messageId) {
          span.setAttribute('email.message_id', result.messageId);
        }
        if (result.recipientCount) {
          span.setAttribute('email.recipient_count', result.recipientCount);
        }
        
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }
  
  // Trace AI pipeline
  async traceAIPipeline(request: AIRequest) {
    const span = tracer.startSpan('ai.pipeline', {
      attributes: {
        'ai.provider': request.provider,
        'ai.model': request.model,
        'ai.feature': request.feature
      }
    });
    
    return context.with(trace.setSpan(context.active(), span), async () => {
      // Pre-processing
      const preprocessSpan = tracer.startSpan('ai.preprocess');
      const processed = await this.preprocess(request);
      preprocessSpan.end();
      
      // AI call
      const aiSpan = tracer.startSpan('ai.inference');
      const result = await this.callAI(processed);
      aiSpan.setAttribute('ai.tokens_used', result.tokens);
      aiSpan.setAttribute('ai.latency_ms', result.latency);
      aiSpan.end();
      
      // Post-processing
      const postprocessSpan = tracer.startSpan('ai.postprocess');
      const final = await this.postprocess(result);
      postprocessSpan.end();
      
      span.end();
      return final;
    });
  }
}
```

## =� Alerting & Incident Response

### Alert Rules Configuration
```yaml
# Prometheus alert rules
groups:
  - name: api_alerts
    interval: 30s
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: |
          (sum(rate(http_requests_total{status=~"5.."}[5m])) by (service)
           /
           sum(rate(http_requests_total[5m])) by (service)) > 0.05
        for: 5m
        labels:
          severity: critical
          team: platform
        annotations:
          summary: "High error rate on {{ $labels.service }}"
          description: "Error rate is {{ $value | humanizePercentage }} for {{ $labels.service }}"
          
      # API latency
      - alert: HighAPILatency
        expr: |
          histogram_quantile(0.95,
            sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service)
          ) > 2
        for: 10m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "High API latency on {{ $labels.service }}"
          description: "95th percentile latency is {{ $value }}s"
          
      # Database connection pool
      - alert: DatabaseConnectionPoolExhausted
        expr: |
          (pg_stat_database_numbackends / pg_settings_max_connections) > 0.8
        for: 5m
        labels:
          severity: critical
          team: database
        annotations:
          summary: "Database connection pool nearly exhausted"
          description: "{{ $value | humanizePercentage }} of connections in use"
          
      # AI service errors
      - alert: AIServiceFailures
        expr: |
          sum(rate(hastecrm_ai_requests_total{status="error"}[5m])) by (provider) > 0.1
        for: 5m
        labels:
          severity: warning
          team: ai
        annotations:
          summary: "AI service {{ $labels.provider }} experiencing failures"
          description: "Error rate: {{ $value }} errors/sec"
          
      # Email delivery issues
      - alert: LowEmailDeliveryRate
        expr: |
          hastecrm_email_delivery_rate < 0.95
        for: 15m
        labels:
          severity: warning
          team: email
        annotations:
          summary: "Email delivery rate below threshold"
          description: "Delivery rate: {{ $value | humanizePercentage }}"
```

### Incident Response Automation
```typescript
// Incident response orchestration
interface IncidentResponse {
  id: string;
  alert: Alert;
  status: 'triggered' | 'acknowledged' | 'investigating' | 'resolved';
  assignee?: string;
  timeline: IncidentEvent[];
  runbooks: Runbook[];
  actions: AutomatedAction[];
}

class IncidentOrchestrator {
  async handleAlert(alert: Alert): Promise<IncidentResponse> {
    const incident = await this.createIncident(alert);
    
    // Execute automated responses
    switch (alert.name) {
      case 'HighErrorRate':
        await this.handleHighErrorRate(incident);
        break;
        
      case 'DatabaseConnectionPoolExhausted':
        await this.handleDatabasePoolExhaustion(incident);
        break;
        
      case 'AIServiceFailures':
        await this.handleAIServiceFailure(incident);
        break;
    }
    
    // Notify on-call
    await this.notifyOnCall(incident);
    
    return incident;
  }
  
  private async handleHighErrorRate(incident: IncidentResponse) {
    // Automated actions
    const actions = [
      // Increase logging
      this.increaseLogLevel(incident.alert.labels.service),
      
      // Enable debug mode
      this.enableDebugMode(incident.alert.labels.service),
      
      // Capture heap dump
      this.captureHeapDump(incident.alert.labels.service),
      
      // Check recent deployments
      this.checkRecentDeployments(incident.alert.labels.service)
    ];
    
    const results = await Promise.all(actions);
    
    incident.actions.push(...results);
    incident.timeline.push({
      timestamp: new Date(),
      action: 'automated_response',
      details: 'Executed high error rate response playbook'
    });
  }
  
  private async handleDatabasePoolExhaustion(incident: IncidentResponse) {
    // Kill idle connections
    await this.killIdleConnections();
    
    // Scale read replicas
    await this.scaleReadReplicas(2);
    
    // Alert DBA team
    await this.notifyTeam('database', incident);
    
    incident.timeline.push({
      timestamp: new Date(),
      action: 'automated_response',
      details: 'Killed idle connections and scaled read replicas'
    });
  }
}
```

### On-Call Integration
```typescript
// PagerDuty integration
class OnCallService {
  private pagerduty: PagerDutyClient;
  
  async createIncident(alert: Alert): Promise<PagerDutyIncident> {
    const incident = await this.pagerduty.createIncident({
      title: alert.annotations.summary,
      service: this.getServiceId(alert.labels.team),
      urgency: this.getUrgency(alert.labels.severity),
      details: {
        alert: alert.name,
        description: alert.annotations.description,
        labels: alert.labels,
        metrics: await this.gatherMetrics(alert),
        runbook: this.getRunbookUrl(alert.name)
      }
    });
    
    return incident;
  }
  
  private getUrgency(severity: string): 'high' | 'low' {
    return severity === 'critical' ? 'high' : 'low';
  }
  
  private async gatherMetrics(alert: Alert): Promise<any> {
    // Gather relevant metrics for the alert
    const queries = this.getMetricQueries(alert.name);
    const results = await Promise.all(
      queries.map(q => this.prometheus.query(q))
    );
    
    return results;
  }
}
```

## =� Custom Dashboards

### Grafana Dashboard Configuration
```json
{
  "dashboard": {
    "title": "hastehasteCRM Platform Overview",
    "panels": [
      {
        "title": "API Request Rate",
        "targets": [
          {
            "expr": "sum(rate(http_requests_total[5m])) by (service)",
            "legendFormat": "{{ service }}"
          }
        ],
        "type": "graph",
        "yaxis": {
          "format": "reqps"
        }
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "(sum(rate(http_requests_total{status=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m]))) * 100",
            "legendFormat": "Error %"
          }
        ],
        "type": "gauge",
        "thresholds": {
          "mode": "absolute",
          "steps": [
            { "color": "green", "value": null },
            { "color": "yellow", "value": 1 },
            { "color": "red", "value": 5 }
          ]
        }
      },
      {
        "title": "AI Token Usage",
        "targets": [
          {
            "expr": "sum(rate(crm_ai_tokens_used_total[1h])) by (provider, model)",
            "legendFormat": "{{ provider }} - {{ model }}"
          }
        ],
        "type": "stat"
      },
      {
        "title": "Active Deals by Stage",
        "targets": [
          {
            "expr": "sum(crm_deals_by_stage) by (pipeline, stage)",
            "legendFormat": "{{ pipeline }} - {{ stage }}"
          }
        ],
        "type": "piechart"
      }
    ]
  }
}
```

### Business Metrics Dashboard
```typescript
// Real-time business metrics
const businessDashboard = {
  panels: [
    // Revenue metrics
    {
      id: 'revenue_metrics',
      title: 'Revenue Overview',
      queries: [
        'sum(crm_monthly_recurring_revenue) by (currency)',
        'sum(rate(crm_new_revenue_total[30d]))',
        'sum(crm_churn_revenue_total[30d])'
      ]
    },
    
    // Sales pipeline
    {
      id: 'pipeline_health',
      title: 'Pipeline Health',
      queries: [
        'sum(crm_pipeline_value) by (pipeline, stage)',
        'histogram_quantile(0.5, crm_pipeline_velocity_days)',
        'sum(rate(crm_deals_created_total[1d])) by (pipeline)'
      ]
    },
    
    // Email performance
    {
      id: 'email_metrics',
      title: 'Email Performance',
      queries: [
        'avg(crm_email_delivery_rate) by (domain)',
        'sum(rate(crm_emails_sent_total[1h])) by (type)',
        'avg(crm_email_open_rate) by (campaign)'
      ]
    },
    
    // AI usage
    {
      id: 'ai_usage',
      title: 'AI Service Usage',
      queries: [
        'sum(rate(crm_ai_requests_total[1h])) by (provider, operation)',
        'sum(crm_ai_tokens_used_total) by (model)',
        'avg(crm_ai_response_time) by (provider)'
      ]
    }
  ]
};
```

## <� Health Checks & Probes

### Kubernetes Health Probes
```yaml
# Deployment health checks
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hastecrm-api
spec:
  template:
    spec:
      containers:
        - name: api
          livenessProbe:
            httpGet:
              path: /health/live
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
            
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3
            
          startupProbe:
            httpGet:
              path: /health/startup
              port: 3000
            initialDelaySeconds: 0
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 30
```

### Health Check Implementation
```typescript
// Comprehensive health checks
interface HealthCheck {
  name: string;
  check: () => Promise<HealthStatus>;
  critical: boolean;
  timeout: number;
}

class HealthCheckService {
  private checks: HealthCheck[] = [
    {
      name: 'database',
      check: this.checkDatabase.bind(this),
      critical: true,
      timeout: 5000
    },
    {
      name: 'redis',
      check: this.checkRedis.bind(this),
      critical: true,
      timeout: 3000
    },
    {
      name: 'elasticsearch',
      check: this.checkElasticsearch.bind(this),
      critical: false,
      timeout: 5000
    },
    {
      name: 'ai_services',
      check: this.checkAIServices.bind(this),
      critical: false,
      timeout: 10000
    },
    {
      name: 'email_service',
      check: this.checkEmailService.bind(this),
      critical: false,
      timeout: 5000
    }
  ];
  
  async checkHealth(type: 'live' | 'ready' | 'startup'): Promise<HealthResponse> {
    const checks = this.getChecksForType(type);
    const results = await Promise.allSettled(
      checks.map(check => this.runCheck(check))
    );
    
    const health: HealthResponse = {
      status: 'healthy',
      timestamp: new Date(),
      checks: {},
      version: process.env.APP_VERSION,
      uptime: process.uptime()
    };
    
    results.forEach((result, index) => {
      const check = checks[index];
      
      if (result.status === 'fulfilled') {
        health.checks[check.name] = result.value;
        
        if (result.value.status === 'unhealthy' && check.critical) {
          health.status = 'unhealthy';
        }
      } else {
        health.checks[check.name] = {
          status: 'unhealthy',
          message: result.reason.message,
          duration: 0
        };
        
        if (check.critical) {
          health.status = 'unhealthy';
        }
      }
    });
    
    return health;
  }
  
  private async checkDatabase(): Promise<HealthStatus> {
    const start = Date.now();
    
    try {
      await prisma.$queryRaw`SELECT 1`;
      
      // Check connection pool
      const poolStats = await this.getDatabasePoolStats();
      
      return {
        status: poolStats.activeConnections < poolStats.maxConnections * 0.9 ? 'healthy' : 'degraded',
        duration: Date.now() - start,
        details: poolStats
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        duration: Date.now() - start,
        message: error.message
      };
    }
  }
  
  private async checkRedis(): Promise<HealthStatus> {
    const start = Date.now();
    
    try {
      await redis.ping();
      
      const info = await redis.info();
      const memory = this.parseRedisInfo(info);
      
      return {
        status: memory.used_memory < memory.maxmemory * 0.9 ? 'healthy' : 'degraded',
        duration: Date.now() - start,
        details: {
          memory_usage: memory.used_memory_human,
          connected_clients: memory.connected_clients,
          uptime_days: memory.uptime_in_days
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        duration: Date.now() - start,
        message: error.message
      };
    }
  }
}
```

## � Performance Optimization

### Performance Monitoring
```typescript
// Performance tracking
class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  
  // Track operation performance
  async trackOperation<T>(
    name: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const timer = this.startTimer(name);
    
    try {
      const result = await operation();
      timer.success();
      
      // Record additional metrics
      if (metadata) {
        this.recordMetadata(name, metadata);
      }
      
      return result;
    } catch (error) {
      timer.failure();
      throw error;
    }
  }
  
  // Resource usage monitoring
  async monitorResourceUsage() {
    setInterval(() => {
      const usage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      // Memory metrics
      this.gauge('process_memory_heap_used', usage.heapUsed);
      this.gauge('process_memory_heap_total', usage.heapTotal);
      this.gauge('process_memory_rss', usage.rss);
      this.gauge('process_memory_external', usage.external);
      
      // CPU metrics
      this.gauge('process_cpu_user', cpuUsage.user);
      this.gauge('process_cpu_system', cpuUsage.system);
      
      // Event loop lag
      const lagStart = process.hrtime();
      setImmediate(() => {
        const lag = process.hrtime(lagStart);
        const lagMs = lag[0] * 1000 + lag[1] / 1000000;
        this.gauge('process_event_loop_lag_ms', lagMs);
      });
    }, 5000);
  }
  
  // Database query performance
  async trackDatabaseQuery(query: string, operation: () => Promise<any>) {
    const queryType = this.parseQueryType(query);
    const timer = this.startTimer(`db_query_${queryType}`);
    
    try {
      const result = await operation();
      timer.success();
      
      // Analyze query plan
      if (process.env.NODE_ENV === 'development') {
        const plan = await this.explainQuery(query);
        if (plan.cost > 1000) {
          logger.warn('Expensive query detected', { query, plan });
        }
      }
      
      return result;
    } catch (error) {
      timer.failure();
      throw error;
    }
  }
}
```

### Performance Optimization Rules
```typescript
// Automated performance optimization
class PerformanceOptimizer {
  private rules: OptimizationRule[] = [
    {
      name: 'cache_slow_queries',
      condition: (metrics) => metrics.db_query_duration_p95 > 100,
      action: async () => {
        // Enable query result caching
        await this.enableQueryCache();
        
        // Increase cache TTL for slow queries
        await this.updateCacheTTL('slow_queries', 300);
      }
    },
    {
      name: 'scale_workers',
      condition: (metrics) => metrics.queue_length > 1000,
      action: async () => {
        // Scale worker pods
        await this.scaleDeployment('workers', 5);
        
        // Increase concurrency
        await this.updateWorkerConcurrency(10);
      }
    },
    {
      name: 'optimize_memory',
      condition: (metrics) => metrics.memory_usage_percent > 80,
      action: async () => {
        // Trigger garbage collection
        if (global.gc) {
          global.gc();
        }
        
        // Clear caches
        await this.clearLRUCaches();
        
        // Reduce batch sizes
        await this.reduceBatchSizes();
      }
    }
  ];
  
  async optimizePerformance() {
    const metrics = await this.gatherMetrics();
    
    for (const rule of this.rules) {
      if (rule.condition(metrics)) {
        logger.info(`Applying optimization rule: ${rule.name}`);
        
        try {
          await rule.action();
          
          // Record optimization
          this.recordOptimization(rule.name, metrics);
        } catch (error) {
          logger.error(`Failed to apply optimization: ${rule.name}`, error);
        }
      }
    }
  }
}
```

## <� Best Practices

### Monitoring Best Practices
1. **Define SLIs/SLOs**: Clear service level indicators and objectives
2. **Monitor Business Metrics**: Track what matters to the business
3. **Use Structured Logging**: Consistent, queryable log formats
4. **Implement Tracing**: End-to-end request tracing
5. **Alert on Symptoms**: Alert on user impact, not just metrics

### Alerting Best Practices
1. **Reduce Alert Fatigue**: Only alert on actionable issues
2. **Include Context**: Provide runbooks and relevant metrics
3. **Test Alerts**: Regular alert testing and validation
4. **Escalation Paths**: Clear on-call procedures
5. **Post-Mortems**: Learn from incidents

### Performance Best Practices
1. **Baseline Performance**: Establish normal performance metrics
2. **Monitor Trends**: Track performance over time
3. **Resource Limits**: Set and monitor resource constraints
4. **Optimize Queries**: Regular query performance review
5. **Capacity Planning**: Proactive scaling based on trends

### Dashboard Best Practices
```typescript
// Effective dashboard design
const dashboardPrinciples = {
  // Focus on key metrics
  keepItSimple: 'Show only what matters',
  
  // Use appropriate visualizations
  rightVisualization: {
    timeSeries: ['rates', 'counts', 'latencies'],
    gauges: ['percentages', 'ratios', 'scores'],
    heatmaps: ['distributions', 'patterns'],
    tables: ['top_n', 'details', 'logs']
  },
  
  // Provide context
  includeContext: {
    timeComparisons: 'week-over-week',
    thresholds: 'SLO boundaries',
    annotations: 'deployments, incidents'
  },
  
  // Make it actionable
  actionable: {
    drillDown: 'Link to detailed views',
    runbooks: 'Include troubleshooting guides',
    alerts: 'Show alert status'
  }
};
```

## = Troubleshooting Guide

### Common Monitoring Issues

#### Missing Metrics
1. Check Prometheus targets
2. Verify service discovery
3. Check metric endpoints
4. Review firewall rules

#### High Cardinality
1. Identify high-cardinality labels
2. Implement label dropping
3. Use recording rules
4. Adjust retention policies

#### Log Volume Issues
1. Implement log sampling
2. Adjust log levels dynamically
3. Use log aggregation
4. Archive old logs

#### Trace Sampling
1. Adjust sampling rates
2. Implement adaptive sampling
3. Use head-based sampling
4. Configure tail-based sampling

---

*Monitoring & Observability Guide v1.0*  
*Last Updated: January 2024*