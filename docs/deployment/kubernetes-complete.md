# Complete Kubernetes Deployment Guide

## Table of Contents
1. [Overview](#overview)
2. [Namespace Configuration](#namespace-configuration)
3. [ConfigMaps and Secrets](#configmaps-and-secrets)
4. [Database Deployment](#database-deployment)
5. [Redis Deployment](#redis-deployment)
6. [Application Deployments](#application-deployments)
7. [Service Definitions](#service-definitions)
8. [Ingress Configuration](#ingress-configuration)
9. [Horizontal Pod Autoscaling](#horizontal-pod-autoscaling)
10. [Monitoring Stack](#monitoring-stack)
11. [Production Checklist](#production-checklist)

## Overview

This guide contains complete Kubernetes configurations for deploying hasteCRM to production.

## Namespace Configuration

```yaml
# k8s/base/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: hastecrm-production
  labels:
    name: hastecrm-production
    environment: production
---
apiVersion: v1
kind: Namespace
metadata:
  name: hastecrm-staging
  labels:
    name: hastecrm-staging
    environment: staging
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: compute-quota
  namespace: hastecrm-production
spec:
  hard:
    requests.cpu: "100"
    requests.memory: 200Gi
    limits.cpu: "200"
    limits.memory: 400Gi
    persistentvolumeclaims: "10"
    services.loadbalancers: "2"
```

## ConfigMaps and Secrets

```yaml
# k8s/base/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: crm-config
  namespace: hastecrm-production
data:
  NODE_ENV: "production"
  PORT: "3000"
  LOG_LEVEL: "info"
  REDIS_HOST: "redis-service"
  REDIS_PORT: "6379"
  DATABASE_HOST: "postgres-service"
  DATABASE_PORT: "5432"
  DATABASE_NAME: "hastecrm"
  CORS_ORIGINS: "https://app.haste.nyc,https://api.haste.nyc"
  SESSION_COOKIE_DOMAIN: ".haste.nyc"
  UPLOAD_MAX_FILE_SIZE: "52428800" # 50MB
  AI_PRIMARY_PROVIDER: "claude"
  AI_FALLBACK_PROVIDERS: "openai,perplexity"
  METRICS_ENABLED: "true"
  TRACING_ENABLED: "true"
---
# k8s/base/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: crm-secrets
  namespace: hastecrm-production
type: Opaque
stringData:
  DATABASE_URL: "postgresql://hastecrm:CHANGE_ME@postgres-service:5432/hastecrm?sslmode=require"
  REDIS_URL: "redis://:CHANGE_ME@redis-service:6379"
  JWT_SECRET: "CHANGE_ME_TO_SECURE_SECRET"
  JWT_REFRESH_SECRET: "CHANGE_ME_TO_ANOTHER_SECURE_SECRET"
  SESSION_SECRET: "CHANGE_ME_TO_SESSION_SECRET"
  ENCRYPTION_KEY: "CHANGE_ME_TO_32_BYTE_KEY"
  GOOGLE_CLIENT_ID: "your-google-client-id"
  GOOGLE_CLIENT_SECRET: "your-google-client-secret"
  GOOGLE_OAUTH_REDIRECT_URI: "https://api.haste.nyc/v1/auth/google/callback"
  AI_CLAUDE_API_KEY: "your-claude-api-key"
  AI_OPENAI_API_KEY: "your-openai-api-key"
  AI_PERPLEXITY_API_KEY: "your-perplexity-api-key"
  SENDGRID_API_KEY: "your-sendgrid-api-key"
  STRIPE_SECRET_KEY: "your-stripe-secret-key"
  STRIPE_WEBHOOK_SECRET: "your-stripe-webhook-secret"
  SENTRY_DSN: "your-sentry-dsn"
  S3_ACCESS_KEY_ID: "your-s3-access-key"
  S3_SECRET_ACCESS_KEY: "your-s3-secret-key"
  S3_BUCKET_NAME: "hastecrm-uploads"
  S3_REGION: "us-east-1"
```

## Database Deployment

```yaml
# k8s/database/postgres-deployment.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: hastecrm-production
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi
  storageClassName: gp3
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: hastecrm-production
spec:
  serviceName: postgres-service
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          value: hastecrm
        - name: POSTGRES_USER
          value: hastecrm
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        - name: postgres-config
          mountPath: /etc/postgresql/postgresql.conf
          subPath: postgresql.conf
        - name: init-scripts
          mountPath: /docker-entrypoint-initdb.d
        resources:
          requests:
            memory: "4Gi"
            cpu: "2"
          limits:
            memory: "8Gi"
            cpu: "4"
        livenessProbe:
          exec:
            command:
              - pg_isready
              - -U
              - hastecrm
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
              - pg_isready
              - -U
              - hastecrm
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
      - name: postgres-config
        configMap:
          name: postgres-config
      - name: init-scripts
        configMap:
          name: postgres-init
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-config
  namespace: hastecrm-production
data:
  postgresql.conf: |
    # Connection settings
    listen_addresses = '*'
    max_connections = 200
    
    # Memory settings
    shared_buffers = 2GB
    effective_cache_size = 6GB
    maintenance_work_mem = 512MB
    work_mem = 10MB
    
    # Checkpoint settings
    checkpoint_completion_target = 0.9
    wal_buffers = 16MB
    min_wal_size = 1GB
    max_wal_size = 4GB
    
    # Query tuning
    random_page_cost = 1.1
    effective_io_concurrency = 200
    
    # Logging
    log_statement = 'mod'
    log_duration = on
    log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
    log_checkpoints = on
    log_connections = on
    log_disconnections = on
    log_lock_waits = on
    log_temp_files = 0
    
    # Extensions
    shared_preload_libraries = 'pg_stat_statements,pgvector'
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-init
  namespace: hastecrm-production
data:
  01-extensions.sql: |
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pgvector";
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";
    CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
  02-users.sql: |
    -- Create read-only user for analytics
    CREATE USER analytics WITH PASSWORD 'CHANGE_ME';
    GRANT CONNECT ON DATABASE hastecrm TO analytics;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO analytics;
---
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
  namespace: hastecrm-production
spec:
  selector:
    app: postgres
  ports:
    - port: 5432
      targetPort: 5432
  clusterIP: None
```

## Redis Deployment

```yaml
# k8s/redis/redis-deployment.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: redis-config
  namespace: hastecrm-production
data:
  redis.conf: |
    maxmemory 2gb
    maxmemory-policy allkeys-lru
    save 900 1
    save 300 10
    save 60 10000
    appendonly yes
    appendfsync everysec
    tcp-backlog 511
    timeout 0
    tcp-keepalive 300
    supervised no
    loglevel notice
    databases 16
    requirepass CHANGE_ME
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: redis
  namespace: hastecrm-production
spec:
  serviceName: redis-service
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        command:
          - redis-server
          - /usr/local/etc/redis/redis.conf
        ports:
        - containerPort: 6379
        volumeMounts:
        - name: redis-config
          mountPath: /usr/local/etc/redis
        - name: redis-data
          mountPath: /data
        resources:
          requests:
            memory: "2Gi"
            cpu: "1"
          limits:
            memory: "4Gi"
            cpu: "2"
        livenessProbe:
          tcpSocket:
            port: 6379
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: redis-config
        configMap:
          name: redis-config
      - name: redis-data
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: redis-service
  namespace: hastecrm-production
spec:
  selector:
    app: redis
  ports:
    - port: 6379
      targetPort: 6379
  clusterIP: None
```

## Application Deployments

### API Server Deployment

```yaml
# k8s/api/api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crm-api
  namespace: hastecrm-production
  labels:
    app: crm-api
    version: v1
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
        version: v1
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3000"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: crm-api
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      containers:
      - name: api
        image: hastecrm/api:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 3000
          name: http
        - containerPort: 9090
          name: metrics
        envFrom:
        - configMapRef:
            name: crm-config
        - secretRef:
            name: crm-secrets
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
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          successThreshold: 1
          failureThreshold: 3
        startupProbe:
          httpGet:
            path: /startup
            port: 3000
          initialDelaySeconds: 0
          periodSeconds: 10
          timeoutSeconds: 3
          failureThreshold: 30
        volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: uploads
          mountPath: /app/uploads
      volumes:
      - name: tmp
        emptyDir: {}
      - name: uploads
        persistentVolumeClaim:
          claimName: uploads-pvc
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - crm-api
              topologyKey: kubernetes.io/hostname
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: crm-api
  namespace: hastecrm-production
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: uploads-pvc
  namespace: hastecrm-production
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 50Gi
  storageClassName: efs
```

### Worker Deployment

```yaml
# k8s/worker/worker-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crm-worker
  namespace: hastecrm-production
  labels:
    app: crm-worker
spec:
  replicas: 2
  selector:
    matchLabels:
      app: crm-worker
  template:
    metadata:
      labels:
        app: crm-worker
    spec:
      serviceAccountName: crm-worker
      containers:
      - name: worker
        image: hastecrm/worker:latest
        imagePullPolicy: Always
        command: ["node", "dist/worker.js"]
        envFrom:
        - configMapRef:
            name: crm-config
        - secretRef:
            name: crm-secrets
        env:
        - name: WORKER_CONCURRENCY
          value: "10"
        - name: WORKER_QUEUE_NAMES
          value: "email,ai,export,import,webhook"
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          exec:
            command:
            - node
            - -e
            - "require('./dist/health-check.js')"
          initialDelaySeconds: 30
          periodSeconds: 30
        volumeMounts:
        - name: tmp
          mountPath: /tmp
      volumes:
      - name: tmp
        emptyDir: {}
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: crm-worker
  namespace: hastecrm-production
```

### WebSocket Server Deployment

```yaml
# k8s/websocket/websocket-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crm-websocket
  namespace: hastecrm-production
  labels:
    app: crm-websocket
spec:
  replicas: 2
  selector:
    matchLabels:
      app: crm-websocket
  template:
    metadata:
      labels:
        app: crm-websocket
    spec:
      containers:
      - name: websocket
        image: hastecrm/websocket:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 3001
          name: ws
        envFrom:
        - configMapRef:
            name: crm-config
        - secretRef:
            name: crm-secrets
        env:
        - name: WS_PORT
          value: "3001"
        - name: WS_PATH
          value: "/socket.io"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5
```

## Service Definitions

```yaml
# k8s/services/services.yaml
apiVersion: v1
kind: Service
metadata:
  name: crm-api-service
  namespace: hastecrm-production
  labels:
    app: crm-api
spec:
  type: ClusterIP
  selector:
    app: crm-api
  ports:
    - name: http
      port: 80
      targetPort: 3000
    - name: metrics
      port: 9090
      targetPort: 9090
---
apiVersion: v1
kind: Service
metadata:
  name: crm-websocket-service
  namespace: hastecrm-production
  labels:
    app: crm-websocket
spec:
  type: ClusterIP
  selector:
    app: crm-websocket
  sessionAffinity: ClientIP
  sessionAffinityConfig:
    clientIP:
      timeoutSeconds: 3600
  ports:
    - name: ws
      port: 80
      targetPort: 3001
```

## Ingress Configuration

```yaml
# k8s/ingress/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: crm-ingress
  namespace: hastecrm-production
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "600"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "600"
    nginx.ingress.kubernetes.io/enable-cors: "true"
    nginx.ingress.kubernetes.io/cors-allow-origin: "https://app.haste.nyc"
    nginx.ingress.kubernetes.io/cors-allow-methods: "GET, POST, PUT, DELETE, OPTIONS"
    nginx.ingress.kubernetes.io/cors-allow-headers: "DNT,X-CustomHeader,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Authorization"
spec:
  tls:
  - hosts:
    - api.haste.nyc
    secretName: api-haste-nyc-tls
  - hosts:
    - ws.haste.nyc
    secretName: ws-haste-nyc-tls
  rules:
  - host: api.haste.nyc
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: crm-api-service
            port:
              number: 80
  - host: ws.haste.nyc
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: crm-websocket-service
            port:
              number: 80
---
# WebSocket-specific ingress for sticky sessions
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: crm-websocket-ingress
  namespace: hastecrm-production
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/affinity: "cookie"
    nginx.ingress.kubernetes.io/affinity-mode: "persistent"
    nginx.ingress.kubernetes.io/session-cookie-name: "ws-route"
    nginx.ingress.kubernetes.io/session-cookie-expires: "86400"
    nginx.ingress.kubernetes.io/session-cookie-max-age: "86400"
    nginx.ingress.kubernetes.io/websocket-services: "crm-websocket-service"
    nginx.ingress.kubernetes.io/proxy-http-version: "1.1"
    nginx.ingress.kubernetes.io/configuration-snippet: |
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
spec:
  tls:
  - hosts:
    - ws.haste.nyc
    secretName: ws-haste-nyc-tls
  rules:
  - host: ws.haste.nyc
    http:
      paths:
      - path: /socket.io
        pathType: Prefix
        backend:
          service:
            name: crm-websocket-service
            port:
              number: 80
```

## Horizontal Pod Autoscaling

```yaml
# k8s/autoscaling/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: crm-api-hpa
  namespace: hastecrm-production
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
kind: HorizontalPodAutoscaler
metadata:
  name: crm-worker-hpa
  namespace: hastecrm-production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: crm-worker
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: External
    external:
      metric:
        name: redis_queue_length
        selector:
          matchLabels:
            queue_name: "all"
      target:
        type: AverageValue
        averageValue: "100"
```

## Monitoring Stack

```yaml
# k8s/monitoring/prometheus-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: hastecrm-production
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s
    
    scrape_configs:
    - job_name: 'kubernetes-pods'
      kubernetes_sd_configs:
      - role: pod
        namespaces:
          names:
          - hastecrm-production
      relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      - source_labels: [__address__, __meta_kubernetes_pod_annotation_prometheus_io_port]
        action: replace
        regex: ([^:]+)(?::\d+)?;(\d+)
        replacement: $1:$2
        target_label: __address__
      - action: labelmap
        regex: __meta_kubernetes_pod_label_(.+)
      - source_labels: [__meta_kubernetes_namespace]
        action: replace
        target_label: kubernetes_namespace
      - source_labels: [__meta_kubernetes_pod_name]
        action: replace
        target_label: kubernetes_pod_name
    
    - job_name: 'node-exporter'
      kubernetes_sd_configs:
      - role: node
      relabel_configs:
      - source_labels: [__address__]
        regex: '(.*):10250'
        replacement: '${1}:9100'
        target_label: __address__
    
    alerting:
      alertmanagers:
      - static_configs:
        - targets:
          - alertmanager:9093
---
# k8s/monitoring/grafana-dashboards.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-dashboards
  namespace: hastecrm-production
data:
  crm-overview.json: |
    {
      "dashboard": {
        "title": "CRM Overview",
        "panels": [
          {
            "title": "Request Rate",
            "targets": [
              {
                "expr": "sum(rate(http_requests_total[5m])) by (service)"
              }
            ]
          },
          {
            "title": "Error Rate",
            "targets": [
              {
                "expr": "sum(rate(http_requests_total{status=~\"5..\"}[5m])) by (service)"
              }
            ]
          },
          {
            "title": "Response Time P95",
            "targets": [
              {
                "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service))"
              }
            ]
          },
          {
            "title": "Active Users",
            "targets": [
              {
                "expr": "sum(crm_active_users_total)"
              }
            ]
          },
          {
            "title": "Database Connections",
            "targets": [
              {
                "expr": "sum(pg_stat_database_numbackends) by (datname)"
              }
            ]
          },
          {
            "title": "Queue Length",
            "targets": [
              {
                "expr": "sum(redis_queue_length) by (queue_name)"
              }
            ]
          }
        ]
      }
    }
```

## Production Checklist

```yaml
# k8s/production-checklist.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: production-checklist
  namespace: hastecrm-production
data:
  checklist.md: |
    # Production Deployment Checklist
    
    ## Pre-deployment
    - [ ] All secrets are updated with production values
    - [ ] Database backup strategy is configured
    - [ ] SSL certificates are provisioned
    - [ ] Resource limits are properly set
    - [ ] HPA is configured for all deployments
    - [ ] Network policies are in place
    - [ ] Pod security policies are applied
    - [ ] RBAC roles are configured
    - [ ] Monitoring alerts are set up
    - [ ] Log aggregation is configured
    
    ## Deployment
    - [ ] Run database migrations
    - [ ] Deploy in this order: Database → Redis → API → Workers → WebSocket
    - [ ] Verify health checks pass
    - [ ] Run smoke tests
    - [ ] Check monitoring dashboards
    
    ## Post-deployment
    - [ ] Verify all endpoints are accessible
    - [ ] Check application logs for errors
    - [ ] Confirm metrics are being collected
    - [ ] Test critical user flows
    - [ ] Update status page
    - [ ] Notify team of deployment status
    
    ## Rollback Plan
    - [ ] Document current version
    - [ ] Have rollback commands ready
    - [ ] Know how to restore database
    - [ ] Have previous images tagged
```

### Network Policies

```yaml
# k8s/network/network-policies.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-network-policy
  namespace: hastecrm-production
spec:
  podSelector:
    matchLabels:
      app: crm-api
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    - podSelector:
        matchLabels:
          app: crm-websocket
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
  - to:
    - namespaceSelector: {}
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53
  - to:
    - cidr: 0.0.0.0/0
    ports:
    - protocol: TCP
      port: 443 # For external APIs
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: database-network-policy
  namespace: hastecrm-production
spec:
  podSelector:
    matchLabels:
      app: postgres
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: crm-api
    - podSelector:
        matchLabels:
          app: crm-worker
    ports:
    - protocol: TCP
      port: 5432
```

### Pod Disruption Budgets

```yaml
# k8s/pdb/pod-disruption-budgets.yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: crm-api-pdb
  namespace: hastecrm-production
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: crm-api
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: crm-worker-pdb
  namespace: hastecrm-production
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: crm-worker
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: postgres-pdb
  namespace: hastecrm-production
spec:
  maxUnavailable: 0
  selector:
    matchLabels:
      app: postgres
```

This complete Kubernetes configuration provides everything needed to deploy hasteCRM to production with high availability, monitoring, and security.