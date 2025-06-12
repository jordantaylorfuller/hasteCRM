# Monitoring & Observability Setup Guide

## Table of Contents
1. [Overview](#overview)
2. [Metrics Collection](#metrics-collection)
3. [Distributed Tracing](#distributed-tracing)
4. [Logging Infrastructure](#logging-infrastructure)
5. [Application Performance Monitoring](#application-performance-monitoring)
6. [Infrastructure Monitoring](#infrastructure-monitoring)
7. [Alerting Configuration](#alerting-configuration)
8. [Dashboard Setup](#dashboard-setup)
9. [Debugging Tools](#debugging-tools)
10. [Cost Monitoring](#cost-monitoring)

## Overview

This guide provides complete implementation for monitoring and observability in hasteCRM, ensuring visibility into system health, performance, and user experience.

## Metrics Collection

### Prometheus Metrics Setup

```typescript
// packages/monitoring/src/metrics/metrics.module.ts
import { Module, Global } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { MetricsService } from './metrics.service';
import { CustomMetrics } from './custom-metrics';
import { MetricsController } from './metrics.controller';

@Global()
@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
        config: {
          prefix: 'hastecrm_',
        },
      },
    }),
  ],
  providers: [MetricsService, CustomMetrics],
  controllers: [MetricsController],
  exports: [MetricsService],
})
export class MetricsModule {}
```

### Custom Metrics Implementation

```typescript
// packages/monitoring/src/metrics/custom-metrics.ts
import { Injectable } from '@nestjs/common';
import { 
  Counter, 
  Histogram, 
  Gauge, 
  Summary,
  register 
} from 'prom-client';

@Injectable()
export class CustomMetrics {
  // Business Metrics
  public readonly userSignups: Counter;
  public readonly contactsCreated: Counter;
  public readonly dealsCreated: Counter;
  public readonly emailsSent: Counter;
  public readonly aiRequestsTotal: Counter;
  
  // Performance Metrics
  public readonly httpRequestDuration: Histogram;
  public readonly databaseQueryDuration: Histogram;
  public readonly cacheHitRate: Gauge;
  public readonly queueJobDuration: Histogram;
  
  // System Metrics
  public readonly activeUsers: Gauge;
  public readonly webSocketConnections: Gauge;
  public readonly queueLength: Gauge;
  public readonly errorRate: Counter;

  constructor() {
    // Business Metrics
    this.userSignups = new Counter({
      name: 'hastecrm_user_signups_total',
      help: 'Total number of user signups',
      labelNames: ['plan', 'source'],
    });

    this.contactsCreated = new Counter({
      name: 'hastecrm_contacts_created_total',
      help: 'Total number of contacts created',
      labelNames: ['workspace_id', 'source'],
    });

    this.dealsCreated = new Counter({
      name: 'hastecrm_deals_created_total',
      help: 'Total number of deals created',
      labelNames: ['workspace_id', 'pipeline_id', 'stage'],
    });

    this.emailsSent = new Counter({
      name: 'hastecrm_emails_sent_total',
      help: 'Total number of emails sent',
      labelNames: ['workspace_id', 'type', 'provider'],
    });

    this.aiRequestsTotal = new Counter({
      name: 'hastecrm_ai_requests_total',
      help: 'Total number of AI API requests',
      labelNames: ['provider', 'model', 'purpose', 'status'],
    });

    // Performance Metrics
    this.httpRequestDuration = new Histogram({
      name: 'hastecrm_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
    });

    this.databaseQueryDuration = new Histogram({
      name: 'hastecrm_database_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['operation', 'table', 'status'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
    });

    this.cacheHitRate = new Gauge({
      name: 'hastecrm_cache_hit_rate',
      help: 'Cache hit rate percentage',
      labelNames: ['cache_type'],
    });

    this.queueJobDuration = new Histogram({
      name: 'hastecrm_queue_job_duration_seconds',
      help: 'Duration of queue job processing in seconds',
      labelNames: ['queue_name', 'job_type', 'status'],
      buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 300],
    });

    // System Metrics
    this.activeUsers = new Gauge({
      name: 'hastecrm_active_users',
      help: 'Number of active users',
      labelNames: ['workspace_id', 'time_window'],
    });

    this.webSocketConnections = new Gauge({
      name: 'hastecrm_websocket_connections',
      help: 'Number of active WebSocket connections',
      labelNames: ['namespace'],
    });

    this.queueLength = new Gauge({
      name: 'hastecrm_queue_length',
      help: 'Number of jobs in queue',
      labelNames: ['queue_name', 'status'],
    });

    this.errorRate = new Counter({
      name: 'hastecrm_errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'code', 'service'],
    });

    // Register all metrics
    register.registerMetric(this.userSignups);
    register.registerMetric(this.contactsCreated);
    register.registerMetric(this.dealsCreated);
    register.registerMetric(this.emailsSent);
    register.registerMetric(this.aiRequestsTotal);
    register.registerMetric(this.httpRequestDuration);
    register.registerMetric(this.databaseQueryDuration);
    register.registerMetric(this.cacheHitRate);
    register.registerMetric(this.queueJobDuration);
    register.registerMetric(this.activeUsers);
    register.registerMetric(this.webSocketConnections);
    register.registerMetric(this.queueLength);
    register.registerMetric(this.errorRate);
  }
}
```

### Metrics Service

```typescript
// packages/monitoring/src/metrics/metrics.service.ts
import { Injectable } from '@nestjs/common';
import { CustomMetrics } from './custom-metrics';

@Injectable()
export class MetricsService {
  constructor(private readonly metrics: CustomMetrics) {}

  // Business Metrics
  recordUserSignup(plan: string, source: string) {
    this.metrics.userSignups.inc({ plan, source });
  }

  recordContactCreated(workspaceId: string, source: string) {
    this.metrics.contactsCreated.inc({ workspace_id: workspaceId, source });
  }

  recordDealCreated(workspaceId: string, pipelineId: string, stage: string) {
    this.metrics.dealsCreated.inc({
      workspace_id: workspaceId,
      pipeline_id: pipelineId,
      stage,
    });
  }

  recordEmailSent(workspaceId: string, type: string, provider: string) {
    this.metrics.emailsSent.inc({
      workspace_id: workspaceId,
      type,
      provider,
    });
  }

  recordAIRequest(
    provider: string,
    model: string,
    purpose: string,
    status: 'success' | 'error'
  ) {
    this.metrics.aiRequestsTotal.inc({ provider, model, purpose, status });
  }

  // Performance Metrics
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number) {
    this.metrics.httpRequestDuration.observe(
      { method, route, status_code: statusCode.toString() },
      duration / 1000 // Convert to seconds
    );
  }

  recordDatabaseQuery(operation: string, table: string, duration: number, status: 'success' | 'error') {
    this.metrics.databaseQueryDuration.observe(
      { operation, table, status },
      duration / 1000
    );
  }

  updateCacheHitRate(cacheType: string, hitRate: number) {
    this.metrics.cacheHitRate.set({ cache_type: cacheType }, hitRate);
  }

  recordQueueJob(
    queueName: string,
    jobType: string,
    duration: number,
    status: 'completed' | 'failed'
  ) {
    this.metrics.queueJobDuration.observe(
      { queue_name: queueName, job_type: jobType, status },
      duration / 1000
    );
  }

  // System Metrics
  updateActiveUsers(workspaceId: string, timeWindow: string, count: number) {
    this.metrics.activeUsers.set(
      { workspace_id: workspaceId, time_window: timeWindow },
      count
    );
  }

  updateWebSocketConnections(namespace: string, count: number) {
    this.metrics.webSocketConnections.set({ namespace }, count);
  }

  updateQueueLength(queueName: string, status: string, length: number) {
    this.metrics.queueLength.set({ queue_name: queueName, status }, length);
  }

  recordError(type: string, code: string, service: string) {
    this.metrics.errorRate.inc({ type, code, service });
  }
}
```

### Metrics Middleware

```typescript
// packages/monitoring/src/middleware/metrics.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    
    // Normalize route for metrics
    const route = this.normalizeRoute(req.route?.path || req.path);
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      this.metricsService.recordHttpRequest(
        req.method,
        route,
        res.statusCode,
        duration
      );
    });

    next();
  }

  private normalizeRoute(path: string): string {
    // Replace IDs with placeholders
    return path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+/g, '/:id');
  }
}
```

## Distributed Tracing

### OpenTelemetry Setup

```typescript
// packages/monitoring/src/tracing/tracing.module.ts
import { Module } from '@nestjs/common';
import { OpenTelemetryModule } from 'nestjs-otel';
import { TracingService } from './tracing.service';

const OpenTelemetryModuleConfig = OpenTelemetryModule.forRoot({
  metrics: {
    hostMetrics: true,
    apiMetrics: {
      enable: true,
      ignoreRoutes: ['/metrics', '/health'],
      ignoreUndefinedRoutes: false,
    },
  },
  nodeSDKConfiguration: {
    spanProcessor: 'batch',
    contextManager: 'async_hooks',
    instrumentations: [
      '@opentelemetry/instrumentation-express',
      '@opentelemetry/instrumentation-http',
      '@opentelemetry/instrumentation-nestjs-core',
      '@opentelemetry/instrumentation-ioredis',
      '@opentelemetry/instrumentation-grpc',
    ],
  },
});

@Module({
  imports: [OpenTelemetryModuleConfig],
  providers: [TracingService],
  exports: [TracingService],
})
export class TracingModule {}
```

### Tracing Service

```typescript
// packages/monitoring/src/tracing/tracing.service.ts
import { Injectable } from '@nestjs/common';
import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { SemanticAttributes } from '@opentelemetry/semantic-conventions';

@Injectable()
export class TracingService {
  private tracer = trace.getTracer('hastecrm-api', '1.0.0');

  async traceOperation<T>(
    operationName: string,
    fn: () => Promise<T>,
    attributes?: Record<string, any>
  ): Promise<T> {
    const span = this.tracer.startSpan(operationName, {
      kind: SpanKind.INTERNAL,
      attributes,
    });

    try {
      const result = await context.with(
        trace.setSpan(context.active(), span),
        fn
      );
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }

  async traceDatabaseQuery<T>(
    query: string,
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return this.traceOperation(`db.${operation}`, fn, {
      [SemanticAttributes.DB_SYSTEM]: 'postgresql',
      [SemanticAttributes.DB_OPERATION]: operation,
      [SemanticAttributes.DB_STATEMENT]: query,
    });
  }

  async traceHttpRequest<T>(
    method: string,
    url: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return this.traceOperation('http.request', fn, {
      [SemanticAttributes.HTTP_METHOD]: method,
      [SemanticAttributes.HTTP_URL]: url,
      [SemanticAttributes.HTTP_TARGET]: new URL(url).pathname,
    });
  }

  async traceAIRequest<T>(
    provider: string,
    model: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return this.traceOperation(`ai.${provider}.request`, fn, {
      'ai.provider': provider,
      'ai.model': model,
      'ai.request.type': 'completion',
    });
  }

  createSpan(name: string, attributes?: Record<string, any>) {
    return this.tracer.startSpan(name, {
      kind: SpanKind.INTERNAL,
      attributes,
    });
  }

  getCurrentSpan() {
    return trace.getSpan(context.active());
  }

  addSpanEvent(name: string, attributes?: Record<string, any>) {
    const span = this.getCurrentSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  setSpanAttribute(key: string, value: any) {
    const span = this.getCurrentSpan();
    if (span) {
      span.setAttribute(key, value);
    }
  }
}
```

### Jaeger Configuration

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  jaeger:
    image: jaegertracing/all-in-one:1.50
    environment:
      - COLLECTOR_OTLP_ENABLED=true
      - SPAN_STORAGE_TYPE=elasticsearch
      - ES_SERVER_URLS=http://elasticsearch:9200
    ports:
      - "16686:16686"  # Jaeger UI
      - "4317:4317"    # OTLP gRPC
      - "4318:4318"    # OTLP HTTP
    depends_on:
      - elasticsearch

  otel-collector:
    image: otel/opentelemetry-collector-contrib:0.88.0
    command: ["--config=/etc/otel-collector-config.yaml"]
    volumes:
      - ./otel-collector-config.yaml:/etc/otel-collector-config.yaml
    ports:
      - "8888:8888"   # Prometheus metrics
      - "8889:8889"   # Prometheus exporter metrics
      - "13133:13133" # Health check
      - "55679:55679" # ZPages
```

### OpenTelemetry Collector Config

```yaml
# otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 1s
    send_batch_size: 1024
  
  memory_limiter:
    check_interval: 1s
    limit_mib: 512
    spike_limit_mib: 128
  
  attributes:
    actions:
      - key: environment
        value: production
        action: upsert
      - key: service.namespace
        value: hastecrm
        action: upsert

exporters:
  jaeger:
    endpoint: jaeger:14250
    tls:
      insecure: true
  
  prometheus:
    endpoint: "0.0.0.0:8889"
  
  logging:
    loglevel: info

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch, attributes]
      exporters: [jaeger, logging]
    
    metrics:
      receivers: [otlp]
      processors: [memory_limiter, batch, attributes]
      exporters: [prometheus]
```

## Logging Infrastructure

### Structured Logging

```typescript
// packages/monitoring/src/logging/logger.service.ts
import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';

@Injectable()
export class LoggerService implements NestLoggerService {
  private logger: winston.Logger;

  constructor() {
    const esTransportOpts = {
      level: 'info',
      clientOpts: {
        node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
        auth: {
          username: process.env.ELASTICSEARCH_USERNAME,
          password: process.env.ELASTICSEARCH_PASSWORD,
        },
      },
      index: 'hastecrm-logs',
      dataStream: true,
    };

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.metadata(),
        winston.format.json()
      ),
      defaultMeta: {
        service: 'hastecrm-api',
        environment: process.env.NODE_ENV,
        version: process.env.APP_VERSION,
      },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              return `${timestamp} [${level}]: ${message} ${
                Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
              }`;
            })
          ),
        }),
        new ElasticsearchTransport(esTransportOpts),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 10485760, // 10MB
          maxFiles: 5,
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          maxsize: 10485760, // 10MB
          maxFiles: 10,
        }),
      ],
    });
  }

  log(message: string, context?: any) {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: any) {
    this.logger.error(message, { trace, context });
  }

  warn(message: string, context?: any) {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: any) {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: any) {
    this.logger.verbose(message, { context });
  }

  // Custom logging methods
  logApiRequest(req: any, res: any, responseTime: number) {
    this.logger.info('API Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime,
      userAgent: req.get('user-agent'),
      ip: req.ip,
      userId: req.user?.id,
    });
  }

  logDatabaseQuery(query: string, params: any[], duration: number) {
    this.logger.debug('Database Query', {
      query,
      params: process.env.NODE_ENV === 'production' ? undefined : params,
      duration,
    });
  }

  logAIRequest(provider: string, model: string, tokens: number, cost: number) {
    this.logger.info('AI Request', {
      provider,
      model,
      tokens,
      cost,
    });
  }

  logSecurityEvent(event: string, userId?: string, details?: any) {
    this.logger.warn('Security Event', {
      event,
      userId,
      details,
      timestamp: new Date().toISOString(),
    });
  }
}
```

### Log Aggregation with ELK Stack

```yaml
# docker-compose.elk.yml
version: '3.8'

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms1g -Xmx1g"
      - xpack.security.enabled=false
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"

  logstash:
    image: docker.elastic.co/logstash/logstash:8.11.0
    volumes:
      - ./logstash/pipeline:/usr/share/logstash/pipeline
    ports:
      - "5000:5000"
      - "5044:5044"
    environment:
      - "LS_JAVA_OPTS=-Xmx256m -Xms256m"
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    environment:
      - ELASTICSEARCH_URL=http://elasticsearch:9200
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch

volumes:
  elasticsearch_data:
```

### Logstash Pipeline Config

```ruby
# logstash/pipeline/logstash.conf
input {
  tcp {
    port => 5000
    codec => json_lines
  }
  
  beats {
    port => 5044
  }
}

filter {
  if [service] == "hastecrm-api" {
    mutate {
      add_field => { "[@metadata][target_index]" => "hastecrm-api-%{+YYYY.MM.dd}" }
    }
  }
  
  if [service] == "hastecrm-worker" {
    mutate {
      add_field => { "[@metadata][target_index]" => "hastecrm-worker-%{+YYYY.MM.dd}" }
    }
  }
  
  # Parse user agent for API requests
  if [userAgent] {
    useragent {
      source => "userAgent"
      target => "user_agent"
    }
  }
  
  # GeoIP enrichment
  if [ip] {
    geoip {
      source => "ip"
      target => "geoip"
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "%{[@metadata][target_index]}"
  }
  
  # Alert on errors
  if [level] == "error" {
    email {
      to => "alerts@haste.nyc"
      subject => "Error in %{service}"
      body => "Error: %{message}\nStack: %{trace}"
    }
  }
}
```

## Application Performance Monitoring

### Sentry Integration

```typescript
// packages/monitoring/src/apm/sentry.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import { CaptureContext } from '@sentry/types';

@Injectable()
export class SentryService implements OnModuleInit {
  onModuleInit() {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      release: process.env.APP_VERSION,
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({ 
          app: true,
          router: true,
        }),
        new ProfilingIntegration(),
      ],
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      profilesSampleRate: 0.1,
      beforeSend(event, hint) {
        // Filter out sensitive data
        if (event.request?.cookies) {
          delete event.request.cookies;
        }
        if (event.user?.email) {
          event.user.email = '[REDACTED]';
        }
        return event;
      },
      ignoreErrors: [
        'Non-Error promise rejection captured',
        'Network request failed',
      ],
    });
  }

  captureException(error: Error, context?: CaptureContext): string {
    return Sentry.captureException(error, context);
  }

  captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): string {
    return Sentry.captureMessage(message, level);
  }

  setUser(user: { id: string; email?: string; username?: string }) {
    Sentry.setUser(user);
  }

  setContext(key: string, context: any) {
    Sentry.setContext(key, context);
  }

  addBreadcrumb(breadcrumb: Sentry.Breadcrumb) {
    Sentry.addBreadcrumb(breadcrumb);
  }

  startTransaction(name: string, op: string) {
    return Sentry.startTransaction({ name, op });
  }

  async profileFunction<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const transaction = this.startTransaction(name, 'function');
    
    try {
      const result = await fn();
      transaction.setStatus('ok');
      return result;
    } catch (error) {
      transaction.setStatus('internal_error');
      throw error;
    } finally {
      transaction.finish();
    }
  }
}
```

### Performance Monitoring Service

```typescript
// packages/monitoring/src/apm/performance.service.ts
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MetricsService } from '../metrics/metrics.service';

interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  tags?: Record<string, string>;
}

@Injectable()
export class PerformanceService {
  private thresholds = {
    apiResponseTime: 200, // ms
    databaseQueryTime: 50, // ms
    cacheResponseTime: 10, // ms
    queueProcessingTime: 5000, // ms
  };

  constructor(
    private readonly metricsService: MetricsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async measureApiEndpoint<T>(
    endpoint: string,
    method: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = process.hrtime.bigint();
    let success = true;

    try {
      const result = await fn();
      return result;
    } catch (error) {
      success = false;
      throw error;
    } finally {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1e6; // Convert to ms

      this.recordPerformanceMetric({
        name: 'api_response_time',
        value: duration,
        unit: 'ms',
        tags: { endpoint, method, success: success.toString() },
      });

      if (duration > this.thresholds.apiResponseTime) {
        this.eventEmitter.emit('performance.slow_api', {
          endpoint,
          method,
          duration,
          threshold: this.thresholds.apiResponseTime,
        });
      }
    }
  }

  async measureDatabaseQuery<T>(
    query: string,
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = process.hrtime.bigint();
    let success = true;

    try {
      const result = await fn();
      return result;
    } catch (error) {
      success = false;
      throw error;
    } finally {
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1e6;

      this.recordPerformanceMetric({
        name: 'database_query_time',
        value: duration,
        unit: 'ms',
        tags: { operation, success: success.toString() },
      });

      if (duration > this.thresholds.databaseQueryTime) {
        this.eventEmitter.emit('performance.slow_query', {
          query,
          operation,
          duration,
          threshold: this.thresholds.databaseQueryTime,
        });
      }
    }
  }

  private recordPerformanceMetric(metric: PerformanceMetric) {
    // Send to metrics service
    if (metric.name === 'api_response_time') {
      this.metricsService.recordHttpRequest(
        metric.tags.method,
        metric.tags.endpoint,
        metric.tags.success === 'true' ? 200 : 500,
        metric.value
      );
    } else if (metric.name === 'database_query_time') {
      this.metricsService.recordDatabaseQuery(
        metric.tags.operation,
        'unknown',
        metric.value,
        metric.tags.success === 'true' ? 'success' : 'error'
      );
    }
  }

  getPerformanceReport(): any {
    return {
      thresholds: this.thresholds,
      recommendations: this.generateRecommendations(),
    };
  }

  private generateRecommendations(): string[] {
    const recommendations = [];

    // Add recommendations based on performance data
    recommendations.push('Consider implementing request caching for frequently accessed endpoints');
    recommendations.push('Optimize database queries with proper indexing');
    recommendations.push('Use connection pooling for external services');

    return recommendations;
  }
}
```

## Infrastructure Monitoring

### Kubernetes Monitoring Stack

```yaml
# k8s/monitoring/prometheus-operator.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: monitoring
---
apiVersion: helm.toolkit.fluxcd.io/v2beta1
kind: HelmRelease
metadata:
  name: kube-prometheus-stack
  namespace: monitoring
spec:
  interval: 10m
  chart:
    spec:
      chart: kube-prometheus-stack
      version: "51.3.0"
      sourceRef:
        kind: HelmRepository
        name: prometheus-community
        namespace: flux-system
  values:
    alertmanager:
      enabled: true
      config:
        global:
          resolve_timeout: 5m
          slack_api_url: ${SLACK_WEBHOOK_URL}
        route:
          group_by: ['alertname', 'cluster', 'service']
          group_wait: 10s
          group_interval: 10s
          repeat_interval: 12h
          receiver: 'default'
          routes:
          - match:
              severity: critical
            receiver: pagerduty
        receivers:
        - name: 'default'
          slack_configs:
          - channel: '#alerts'
            title: 'hasteCRM Alert'
            text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
        - name: 'pagerduty'
          pagerduty_configs:
          - service_key: ${PAGERDUTY_SERVICE_KEY}
    
    grafana:
      enabled: true
      adminPassword: ${GRAFANA_ADMIN_PASSWORD}
      ingress:
        enabled: true
        hosts:
          - grafana.haste.nyc
        tls:
          - secretName: grafana-tls
            hosts:
              - grafana.haste.nyc
      additionalDataSources:
      - name: Loki
        type: loki
        url: http://loki:3100
      - name: Jaeger
        type: jaeger
        url: http://jaeger:16686
      
    prometheus:
      prometheusSpec:
        retention: 30d
        storageSpec:
          volumeClaimTemplate:
            spec:
              storageClassName: gp3
              accessModes: ["ReadWriteOnce"]
              resources:
                requests:
                  storage: 100Gi
        serviceMonitorSelectorNilUsesHelmValues: false
        podMonitorSelectorNilUsesHelmValues: false
        ruleSelectorNilUsesHelmValues: false
```

### Custom ServiceMonitor

```yaml
# k8s/monitoring/service-monitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: hastecrm-api
  namespace: hastecrm-production
  labels:
    app: hastecrm
spec:
  selector:
    matchLabels:
      app: crm-api
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
    honorLabels: true
    relabelings:
    - sourceLabels: [__meta_kubernetes_pod_name]
      targetLabel: pod
    - sourceLabels: [__meta_kubernetes_pod_node_name]
      targetLabel: node
---
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: hastecrm-websocket
  namespace: hastecrm-production
spec:
  selector:
    matchLabels:
      app: crm-websocket
  endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
```

### Node Exporter Configuration

```yaml
# k8s/monitoring/node-exporter.yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-exporter
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: node-exporter
  template:
    metadata:
      labels:
        app: node-exporter
    spec:
      hostNetwork: true
      hostPID: true
      hostIPC: true
      containers:
      - name: node-exporter
        image: prom/node-exporter:v1.6.1
        args:
          - --path.procfs=/host/proc
          - --path.sysfs=/host/sys
          - --path.rootfs=/host/root
          - --collector.filesystem.ignored-mount-points
          - ^/(dev|proc|sys|var/lib/docker/.+|var/lib/kubelet/pods/.+)($|/)
        ports:
        - containerPort: 9100
          hostPort: 9100
        volumeMounts:
        - name: proc
          mountPath: /host/proc
          readOnly: true
        - name: sys
          mountPath: /host/sys
          readOnly: true
        - name: root
          mountPath: /host/root
          mountPropagation: HostToContainer
          readOnly: true
      volumes:
      - name: proc
        hostPath:
          path: /proc
      - name: sys
        hostPath:
          path: /sys
      - name: root
        hostPath:
          path: /
```

## Alerting Configuration

### Prometheus Alert Rules

```yaml
# k8s/monitoring/alert-rules.yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: hastecrm-alerts
  namespace: hastecrm-production
spec:
  groups:
  - name: api
    interval: 30s
    rules:
    - alert: HighErrorRate
      expr: |
        rate(hastecrm_errors_total[5m]) > 0.05
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "High error rate detected"
        description: "Error rate is {{ $value }} errors per second"
    
    - alert: SlowAPIResponse
      expr: |
        histogram_quantile(0.95, rate(hastecrm_http_request_duration_seconds_bucket[5m])) > 0.5
      for: 10m
      labels:
        severity: warning
      annotations:
        summary: "Slow API response times"
        description: "95th percentile response time is {{ $value }}s"
    
    - alert: APIDown
      expr: up{job="hastecrm-api"} == 0
      for: 2m
      labels:
        severity: critical
      annotations:
        summary: "API is down"
        description: "API instance {{ $labels.instance }} is down"
  
  - name: database
    interval: 30s
    rules:
    - alert: DatabaseConnectionPoolExhausted
      expr: |
        hastecrm_database_connections_active / hastecrm_database_connections_max > 0.9
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Database connection pool nearly exhausted"
        description: "{{ $value | humanizePercentage }} of connections in use"
    
    - alert: SlowDatabaseQueries
      expr: |
        histogram_quantile(0.95, rate(hastecrm_database_query_duration_seconds_bucket[5m])) > 0.1
      for: 10m
      labels:
        severity: warning
      annotations:
        summary: "Slow database queries detected"
        description: "95th percentile query time is {{ $value }}s"
  
  - name: business
    interval: 1m
    rules:
    - alert: LowSignupRate
      expr: |
        rate(hastecrm_user_signups_total[1h]) < 0.1
      for: 2h
      labels:
        severity: info
      annotations:
        summary: "Low signup rate"
        description: "Less than 6 signups per hour"
    
    - alert: HighAICosts
      expr: |
        increase(hastecrm_ai_costs_total[1h]) > 100
      for: 30m
      labels:
        severity: warning
      annotations:
        summary: "High AI API costs"
        description: "${{ $value }} spent in the last hour"
    
    - alert: QueueBacklog
      expr: |
        hastecrm_queue_length{status="waiting"} > 1000
      for: 15m
      labels:
        severity: warning
      annotations:
        summary: "Large queue backlog"
        description: "{{ $value }} jobs waiting in {{ $labels.queue_name }}"
```

### AlertManager Configuration

```yaml
# k8s/monitoring/alertmanager-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: alertmanager-config
  namespace: monitoring
data:
  alertmanager.yml: |
    global:
      resolve_timeout: 5m
      slack_api_url: '${SLACK_WEBHOOK_URL}'
      pagerduty_url: 'https://events.pagerduty.com/v2/enqueue'
    
    templates:
    - '/etc/alertmanager/templates/*.tmpl'
    
    route:
      group_by: ['alertname', 'cluster', 'service']
      group_wait: 10s
      group_interval: 10s
      repeat_interval: 12h
      receiver: 'default'
      routes:
      - match_re:
          severity: critical
        receiver: critical
        continue: true
      - match:
          severity: warning
        receiver: warning
      - match:
          severity: info
        receiver: info
    
    receivers:
    - name: 'default'
      slack_configs:
      - channel: '#alerts'
        send_resolved: true
        title: 'hasteCRM Alert'
        text: '{{ template "slack.default.text" . }}'
        actions:
        - type: button
          text: 'Runbook'
          url: '{{ (index .Alerts 0).Annotations.runbook_url }}'
        - type: button
          text: 'Dashboard'
          url: '{{ (index .Alerts 0).Annotations.dashboard_url }}'
    
    - name: 'critical'
      pagerduty_configs:
      - service_key: '${PAGERDUTY_SERVICE_KEY}'
        description: '{{ template "pagerduty.default.description" . }}'
      slack_configs:
      - channel: '#alerts-critical'
        send_resolved: true
        title: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'
        color: 'danger'
    
    - name: 'warning'
      slack_configs:
      - channel: '#alerts'
        send_resolved: true
        title: '⚠️ WARNING: {{ .GroupLabels.alertname }}'
        color: 'warning'
    
    - name: 'info'
      slack_configs:
      - channel: '#alerts-info'
        send_resolved: false
        title: 'ℹ️ INFO: {{ .GroupLabels.alertname }}'
        color: 'good'
```

## Dashboard Setup

### Grafana Dashboards

```json
// grafana/dashboards/crm-overview.json
{
  "dashboard": {
    "title": "hasteCRM Overview",
    "panels": [
      {
        "title": "Request Rate",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 },
        "targets": [
          {
            "expr": "sum(rate(hastecrm_http_request_duration_seconds_count[5m])) by (method)",
            "legendFormat": "{{ method }}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Error Rate",
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 0 },
        "targets": [
          {
            "expr": "sum(rate(hastecrm_errors_total[5m])) by (type)",
            "legendFormat": "{{ type }}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Response Time (p95)",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 8 },
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(hastecrm_http_request_duration_seconds_bucket[5m])) by (le, route))",
            "legendFormat": "{{ route }}"
          }
        ],
        "type": "graph"
      },
      {
        "title": "Active Users",
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 8 },
        "targets": [
          {
            "expr": "sum(hastecrm_active_users) by (time_window)",
            "legendFormat": "{{ time_window }}"
          }
        ],
        "type": "stat"
      },
      {
        "title": "AI API Usage",
        "gridPos": { "h": 8, "w": 12, "x": 0, "y": 16 },
        "targets": [
          {
            "expr": "sum(rate(hastecrm_ai_requests_total[1h])) by (provider)",
            "legendFormat": "{{ provider }}"
          }
        ],
        "type": "piechart"
      },
      {
        "title": "Database Performance",
        "gridPos": { "h": 8, "w": 12, "x": 12, "y": 16 },
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(hastecrm_database_query_duration_seconds_bucket[5m])) by (le, operation))",
            "legendFormat": "{{ operation }}"
          }
        ],
        "type": "graph"
      }
    ]
  }
}
```

### Custom Dashboard Generator

```typescript
// packages/monitoring/src/dashboards/dashboard-generator.ts
import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';

@Injectable()
export class DashboardGenerator {
  async generateDashboard(config: {
    title: string;
    metrics: Array<{
      name: string;
      query: string;
      type: 'graph' | 'stat' | 'table' | 'piechart';
      position: { x: number; y: number; w: number; h: number };
    }>;
  }): Promise<string> {
    const dashboard = {
      dashboard: {
        title: config.title,
        panels: config.metrics.map((metric, index) => ({
          id: index + 1,
          title: metric.name,
          type: metric.type,
          gridPos: metric.position,
          targets: [
            {
              expr: metric.query,
              refId: 'A',
            },
          ],
        })),
        time: {
          from: 'now-6h',
          to: 'now',
        },
        refresh: '30s',
      },
    };

    const json = JSON.stringify(dashboard, null, 2);
    await fs.writeFile(
      `./grafana/dashboards/${config.title.toLowerCase().replace(/\s+/g, '-')}.json`,
      json
    );

    return json;
  }

  async generateBusinessDashboard() {
    return this.generateDashboard({
      title: 'Business Metrics',
      metrics: [
        {
          name: 'New Signups',
          query: 'sum(increase(hastecrm_user_signups_total[1d])) by (plan)',
          type: 'stat',
          position: { x: 0, y: 0, w: 6, h: 4 },
        },
        {
          name: 'Active Users by Plan',
          query: 'sum(hastecrm_active_users) by (plan)',
          type: 'piechart',
          position: { x: 6, y: 0, w: 6, h: 4 },
        },
        {
          name: 'Deals Created',
          query: 'sum(rate(hastecrm_deals_created_total[1h])) by (stage)',
          type: 'graph',
          position: { x: 12, y: 0, w: 12, h: 8 },
        },
        {
          name: 'Email Engagement',
          query: 'sum(rate(hastecrm_emails_sent_total[1h])) by (type)',
          type: 'graph',
          position: { x: 0, y: 8, w: 12, h: 8 },
        },
        {
          name: 'AI Usage by Purpose',
          query: 'sum(rate(hastecrm_ai_requests_total[1h])) by (purpose)',
          type: 'table',
          position: { x: 12, y: 8, w: 12, h: 8 },
        },
      ],
    });
  }
}
```

## Debugging Tools

### Debug Endpoint

```typescript
// packages/api/src/debug/debug.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../guards/admin.guard';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MetricsService } from '@hastecrm/monitoring';

@Controller('debug')
@UseGuards(AdminGuard)
export class DebugController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly metrics: MetricsService,
  ) {}

  @Get('health/detailed')
  async detailedHealth() {
    const [dbHealth, redisHealth, queueHealth] = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkRedisHealth(),
      this.checkQueueHealth(),
    ]);

    return {
      timestamp: new Date(),
      services: {
        database: dbHealth,
        redis: redisHealth,
        queue: queueHealth,
      },
      metrics: await this.getMetricsSummary(),
    };
  }

  @Get('connections')
  async getConnections() {
    const dbConnections = await this.prisma.$queryRaw`
      SELECT 
        pid,
        usename,
        application_name,
        client_addr,
        state,
        query_start,
        state_change,
        query
      FROM pg_stat_activity
      WHERE state != 'idle'
      ORDER BY query_start DESC;
    `;

    const redisInfo = await this.redis.info();
    
    return {
      database: {
        active: dbConnections,
        total: await this.getDatabaseConnectionCount(),
      },
      redis: {
        clients: this.parseRedisClients(redisInfo),
      },
    };
  }

  @Get('slow-queries')
  async getSlowQueries() {
    const slowQueries = await this.prisma.$queryRaw`
      SELECT
        query,
        calls,
        total_time,
        mean_time,
        min_time,
        max_time,
        stddev_time
      FROM pg_stat_statements
      WHERE mean_time > 100
      ORDER BY mean_time DESC
      LIMIT 20;
    `;

    return {
      queries: slowQueries,
      recommendations: this.generateQueryRecommendations(slowQueries),
    };
  }

  @Get('cache-stats')
  async getCacheStats() {
    const info = await this.redis.info('stats');
    const dbsize = await this.redis.dbsize();
    
    return {
      size: dbsize,
      stats: this.parseRedisStats(info),
      hitRate: await this.calculateCacheHitRate(),
    };
  }

  private async checkDatabaseHealth() {
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;

      return {
        status: 'healthy',
        latency,
        connections: await this.getDatabaseConnectionCount(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  private async checkRedisHealth() {
    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;

      return {
        status: 'healthy',
        latency,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  private async checkQueueHealth() {
    // Implementation depends on your queue system
    return {
      status: 'healthy',
      queues: {
        email: { waiting: 0, active: 0, completed: 0, failed: 0 },
        ai: { waiting: 0, active: 0, completed: 0, failed: 0 },
      },
    };
  }

  private async getDatabaseConnectionCount(): Promise<number> {
    const result = await this.prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM pg_stat_activity;
    `;
    return Number(result[0].count);
  }

  private parseRedisClients(info: string): any {
    const lines = info.split('\r\n');
    const clients = {};
    
    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (key.includes('client')) {
          clients[key] = value;
        }
      }
    });
    
    return clients;
  }

  private parseRedisStats(info: string): any {
    const lines = info.split('\r\n');
    const stats = {};
    
    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        stats[key] = value;
      }
    });
    
    return stats;
  }

  private async calculateCacheHitRate(): Promise<number> {
    // Implementation depends on how you track cache hits/misses
    return 85.5; // Example
  }

  private async getMetricsSummary() {
    // Get key metrics from Prometheus
    return {
      requestRate: '1250 req/min',
      errorRate: '0.02%',
      avgResponseTime: '45ms',
      activeUsers: 523,
    };
  }

  private generateQueryRecommendations(slowQueries: any[]): string[] {
    const recommendations = [];
    
    slowQueries.forEach(query => {
      if (query.mean_time > 1000) {
        recommendations.push(`Consider adding index for query: ${query.query.substring(0, 50)}...`);
      }
    });
    
    return recommendations;
  }
}
```

## Cost Monitoring

### Cloud Cost Tracking

```typescript
// packages/monitoring/src/cost/cost-tracking.service.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as AWS from 'aws-sdk';

@Injectable()
export class CostTrackingService {
  private costExplorer: AWS.CostExplorer;
  private budgets: AWS.Budgets;

  constructor(private readonly eventEmitter: EventEmitter2) {
    this.costExplorer = new AWS.CostExplorer({
      region: 'us-east-1',
    });

    this.budgets = new AWS.Budgets({
      region: 'us-east-1',
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async trackDailyCosts() {
    const costs = await this.getDailyCosts();
    
    // Check against budgets
    const budgetStatus = await this.checkBudgets();
    
    // Send alerts if needed
    if (costs.total > 100) {
      this.eventEmitter.emit('cost.alert', {
        type: 'daily_exceeded',
        amount: costs.total,
        breakdown: costs.services,
      });
    }

    // Log to metrics
    this.logCostMetrics(costs);
  }

  async getDailyCosts() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1);

    const params = {
      TimePeriod: {
        Start: startDate.toISOString().split('T')[0],
        End: endDate.toISOString().split('T')[0],
      },
      Granularity: 'DAILY',
      Metrics: ['UnblendedCost'],
      GroupBy: [
        {
          Type: 'DIMENSION',
          Key: 'SERVICE',
        },
      ],
    };

    const result = await this.costExplorer.getCostAndUsage(params).promise();
    
    const services = {};
    let total = 0;

    result.ResultsByTime[0].Groups.forEach(group => {
      const service = group.Keys[0];
      const cost = parseFloat(group.Metrics.UnblendedCost.Amount);
      services[service] = cost;
      total += cost;
    });

    return { total, services, date: startDate };
  }

  async getMonthToDateCosts() {
    const endDate = new Date();
    const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    const params = {
      TimePeriod: {
        Start: startDate.toISOString().split('T')[0],
        End: endDate.toISOString().split('T')[0],
      },
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost'],
    };

    const result = await this.costExplorer.getCostAndUsage(params).promise();
    return parseFloat(result.ResultsByTime[0].Total.UnblendedCost.Amount);
  }

  async checkBudgets() {
    const params = {
      AccountId: process.env.AWS_ACCOUNT_ID,
    };

    const budgets = await this.budgets.describeBudgets(params).promise();
    
    return budgets.Budgets.map(budget => ({
      name: budget.BudgetName,
      limit: budget.BudgetLimit.Amount,
      current: budget.CalculatedSpend.ActualSpend.Amount,
      percentage: (parseFloat(budget.CalculatedSpend.ActualSpend.Amount) / 
                  parseFloat(budget.BudgetLimit.Amount)) * 100,
    }));
  }

  private logCostMetrics(costs: any) {
    // Log to your metrics system
    console.log('Daily costs:', costs);
  }

  async getCostForecast() {
    const params = {
      TimePeriod: {
        Start: new Date().toISOString().split('T')[0],
        End: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
      Metric: 'UNBLENDED_COST',
      Granularity: 'MONTHLY',
      PredictionIntervalLevel: 80,
    };

    const forecast = await this.costExplorer.getCostForecast(params).promise();
    
    return {
      mean: parseFloat(forecast.Total.Amount),
      lowerBound: parseFloat(forecast.ForecastResultsByTime[0].LowerBound),
      upperBound: parseFloat(forecast.ForecastResultsByTime[0].UpperBound),
    };
  }
}
```

### Cost Optimization Recommendations

```typescript
// packages/monitoring/src/cost/cost-optimizer.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class CostOptimizerService {
  async generateRecommendations(): Promise<any[]> {
    const recommendations = [];

    // Check for unused resources
    const unusedResources = await this.findUnusedResources();
    if (unusedResources.length > 0) {
      recommendations.push({
        type: 'unused_resources',
        severity: 'high',
        estimatedSavings: this.calculateSavings(unusedResources),
        resources: unusedResources,
        action: 'Delete or stop unused resources',
      });
    }

    // Check for oversized instances
    const oversizedInstances = await this.findOversizedInstances();
    if (oversizedInstances.length > 0) {
      recommendations.push({
        type: 'rightsizing',
        severity: 'medium',
        estimatedSavings: this.calculateRightsizingSavings(oversizedInstances),
        instances: oversizedInstances,
        action: 'Downsize underutilized instances',
      });
    }

    // Check for reserved instance opportunities
    const riOpportunities = await this.findReservedInstanceOpportunities();
    if (riOpportunities.length > 0) {
      recommendations.push({
        type: 'reserved_instances',
        severity: 'low',
        estimatedSavings: this.calculateRISavings(riOpportunities),
        opportunities: riOpportunities,
        action: 'Purchase reserved instances for steady-state workloads',
      });
    }

    return recommendations;
  }

  private async findUnusedResources(): Promise<any[]> {
    // Implementation to find unused EBS volumes, load balancers, etc.
    return [];
  }

  private async findOversizedInstances(): Promise<any[]> {
    // Implementation to find instances with low CPU/memory utilization
    return [];
  }

  private async findReservedInstanceOpportunities(): Promise<any[]> {
    // Implementation to identify RI purchase opportunities
    return [];
  }

  private calculateSavings(resources: any[]): number {
    return resources.reduce((total, resource) => total + resource.monthlyCost, 0);
  }

  private calculateRightsizingSavings(instances: any[]): number {
    return instances.reduce((total, instance) => {
      const currentCost = instance.monthlyCost;
      const recommendedCost = instance.recommendedInstance.monthlyCost;
      return total + (currentCost - recommendedCost);
    }, 0);
  }

  private calculateRISavings(opportunities: any[]): number {
    return opportunities.reduce((total, opp) => {
      const onDemandCost = opp.onDemandMonthlyCost;
      const riCost = opp.reservedInstanceMonthlyCost;
      return total + (onDemandCost - riCost);
    }, 0);
  }
}
```

This comprehensive monitoring and observability setup provides complete visibility into hasteCRM's health, performance, and costs.