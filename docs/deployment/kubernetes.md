# Kubernetes Deployment Guide

## Overview

This document provides comprehensive instructions for deploying the hasteCRM application on Kubernetes, including cluster setup, application deployment, scaling, monitoring, and maintenance.

## Architecture Overview

```
                                                                 
                        Kubernetes Cluster                        
                                                                 $
                                                         
     Ingress     Load Balancer     SSL/TLS               
   Controller      Service         Manager               
                                                         
                                                                 $
                                                              
                   Application Layer                            
               ,             ,                     $           
     Web App      API          Background                   
     (Next.js)    (Node.js)    Workers                      
               4             4                                
                                                                 $
                                                              
                    Data Layer                                  
               ,             ,                     $           
    PostgreSQL     Redis       Elasticsearch                
     (Primary)    Cluster        Cluster                    
               4             4                                
                                                                 $
                                                              
                Supporting Services                             
               ,             ,                     $           
   Prometheus     Grafana       Jaeger                      
                                (Tracing)                   
               4             4                                
                                                                 
```

## Prerequisites

### Required Tools

```bash
# Install required CLI tools
brew install kubectl helm helmfile k9s

# Verify installations
kubectl version --client
helm version
helmfile --version
k9s version
```

### Cluster Requirements

- Kubernetes 1.28+
- Minimum 3 nodes (production)
- 4 vCPUs, 16GB RAM per node
- 100GB SSD storage per node
- LoadBalancer support (or MetalLB)
- Persistent Volume provisioner

## Namespace Structure

```yaml
# namespaces/namespaces.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: hastecrm-production
  labels:
    app: hastecrm
    environment: production
---
apiVersion: v1
kind: Namespace
metadata:
  name: hastecrm-staging
  labels:
    app: hastecrm
    environment: staging
---
apiVersion: v1
kind: Namespace
metadata:
  name: hastecrm-monitoring
  labels:
    app: hastecrm
    purpose: monitoring
---
apiVersion: v1
kind: Namespace
metadata:
  name: hastecrm-data
  labels:
    app: hastecrm
    purpose: data
```

## Application Deployments

### 1. Web Application (Next.js)

```yaml
# deployments/web-app.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hastecrm-web
  namespace: hastecrm-production
  labels:
    app: hastecrm-web
    component: frontend
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: hastecrm-web
  template:
    metadata:
      labels:
        app: hastecrm-web
        component: frontend
    spec:
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
                  - hastecrm-web
              topologyKey: kubernetes.io/hostname
      containers:
      - name: web
        image: hastecrm/web:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: NODE_ENV
          value: "production"
        - name: API_URL
          value: "http://crm-api:4000"
        envFrom:
        - configMapRef:
            name: hastecrm-web-config
        - secretRef:
            name: hastecrm-web-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
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
        volumeMounts:
        - name: cache
          mountPath: /app/.next/cache
      volumes:
      - name: cache
        emptyDir:
          sizeLimit: 1Gi
---
apiVersion: v1
kind: Service
metadata:
  name: hastecrm-web
  namespace: hastecrm-production
spec:
  selector:
    app: hastecrm-web
  ports:
  - port: 80
    targetPort: 3000
    name: http
  type: ClusterIP
```

### 2. API Service (Node.js)

```yaml
# deployments/api.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hastecrm-api
  namespace: hastecrm-production
  labels:
    app: hastecrm-api
    component: backend
spec:
  replicas: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 2
      maxUnavailable: 1
  selector:
    matchLabels:
      app: hastecrm-api
  template:
    metadata:
      labels:
        app: hastecrm-api
        component: backend
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: crm-api
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector:
              matchExpressions:
              - key: app
                operator: In
                values:
                - hastecrm-api
            topologyKey: kubernetes.io/hostname
      containers:
      - name: api
        image: hastecrm/api:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 4000
          name: http
        - containerPort: 9090
          name: metrics
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "4000"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: hastecrm-database-secret
              key: url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: hastecrm-redis-secret
              key: url
        envFrom:
        - configMapRef:
            name: hastecrm-api-config
        - secretRef:
            name: hastecrm-api-secrets
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
            port: 4000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
        readinessProbe:
          httpGet:
            path: /ready
            port: 4000
          initialDelaySeconds: 10
          periodSeconds: 5
        startupProbe:
          httpGet:
            path: /startup
            port: 4000
          initialDelaySeconds: 0
          periodSeconds: 10
          failureThreshold: 30
        volumeMounts:
        - name: tmp
          mountPath: /tmp
        securityContext:
          runAsNonRoot: true
          runAsUser: 1000
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
      volumes:
      - name: tmp
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: hastecrm-api
  namespace: hastecrm-production
  labels:
    app: hastecrm-api
spec:
  selector:
    app: hastecrm-api
  ports:
  - port: 4000
    targetPort: 4000
    name: http
  - port: 9090
    targetPort: 9090
    name: metrics
  type: ClusterIP
```

### 3. Background Workers

```yaml
# deployments/workers.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hastecrm-worker-email
  namespace: hastecrm-production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: hastecrm-worker-email
  template:
    metadata:
      labels:
        app: hastecrm-worker-email
        component: worker
    spec:
      containers:
      - name: worker
        image: hastecrm/worker:latest
        command: ["node", "dist/workers/email.js"]
        env:
        - name: WORKER_TYPE
          value: "email"
        - name: WORKER_CONCURRENCY
          value: "10"
        envFrom:
        - configMapRef:
            name: hastecrm-worker-config
        - secretRef:
            name: hastecrm-worker-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hastecrm-worker-webhook
  namespace: hastecrm-production
spec:
  replicas: 2
  selector:
    matchLabels:
      app: hastecrm-worker-webhook
  template:
    metadata:
      labels:
        app: hastecrm-worker-webhook
        component: worker
    spec:
      containers:
      - name: worker
        image: hastecrm/worker:latest
        command: ["node", "dist/workers/webhook.js"]
        env:
        - name: WORKER_TYPE
          value: "webhook"
        - name: WORKER_CONCURRENCY
          value: "20"
        envFrom:
        - configMapRef:
            name: hastecrm-worker-config
        - secretRef:
            name: hastecrm-worker-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

## Data Layer

### 1. PostgreSQL (using CloudNativePG)

```yaml
# data/postgresql.yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: hastecrm-postgres
  namespace: hastecrm-data
spec:
  instances: 3
  primaryUpdateStrategy: unsupervised
  
  postgresql:
    parameters:
      max_connections: "400"
      shared_buffers: "1GB"
      effective_cache_size: "1GB"
      work_mem: "16MB"
      maintenance_work_mem: "128MB"
      random_page_cost: "1.1"
      effective_io_concurrency: "200"
      wal_compression: "on"
      
  bootstrap:
    initdb:
      database: crm_production
      owner: crm_user
      secret:
        name: hastecrm-postgres-credentials
      dataChecksums: true
      encoding: UTF8
      
  storage:
    size: 100Gi
    storageClass: fast-ssd
    
  monitoring:
    enabled: true
    customQueriesConfigMap:
      - name: hastecrm-postgres-queries
        key: queries.yaml
        
  backup:
    enabled: true
    retentionPolicy: "30d"
    target: "s3://hastecrm-backups/postgres"
    s3Credentials:
      accessKeyId:
        name: backup-credentials
        key: ACCESS_KEY_ID
      secretAccessKey:
        name: backup-credentials
        key: SECRET_ACCESS_KEY
```

### 2. Redis Cluster

```yaml
# data/redis.yaml
apiVersion: redis.redis.opstreelabs.in/v1beta1
kind: RedisCluster
metadata:
  name: hastecrm-redis
  namespace: hastecrm-data
spec:
  clusterSize: 6
  redisLeader:
    replicas: 3
  redisFollower:
    replicas: 3
  persistenceEnabled: true
  storage:
    volumeClaimTemplate:
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 10Gi
  redisConfig:
    maxmemory: "8gb"
    maxmemory-policy: "allkeys-lru"
    save: "900 1 300 10 60 10000"
  resources:
    requests:
      cpu: "100m"
      memory: "256Mi"
    limits:
      cpu: "500m"
      memory: "8Gi"
```

### 3. Elasticsearch

```yaml
# data/elasticsearch.yaml
apiVersion: elasticsearch.k8s.elastic.co/v1
kind: Elasticsearch
metadata:
  name: hastecrm-elasticsearch
  namespace: hastecrm-data
spec:
  version: 8.11.0
  nodeSets:
  - name: masters
    count: 3
    config:
      node.roles: ["master"]
    podTemplate:
      spec:
        containers:
        - name: elasticsearch
          resources:
            requests:
              memory: 2Gi
              cpu: 500m
            limits:
              memory: 2Gi
              cpu: 1
    volumeClaimTemplates:
    - metadata:
        name: elasticsearch-data
      spec:
        accessModes:
        - ReadWriteOnce
        resources:
          requests:
            storage: 10Gi
        storageClassName: fast-ssd
  - name: data
    count: 3
    config:
      node.roles: ["data", "ingest"]
    podTemplate:
      spec:
        containers:
        - name: elasticsearch
          resources:
            requests:
              memory: 4Gi
              cpu: 1
            limits:
              memory: 4Gi
              cpu: 2
    volumeClaimTemplates:
    - metadata:
        name: elasticsearch-data
      spec:
        accessModes:
        - ReadWriteOnce
        resources:
          requests:
            storage: 100Gi
        storageClassName: fast-ssd
```

## Ingress Configuration

### 1. Nginx Ingress

```yaml
# ingress/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: hastecrm-ingress
  namespace: hastecrm-production
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "60"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "60"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "60"
spec:
  tls:
  - hosts:
    - app.hastecrm.com
    - api.hastecrm.com
    secretName: hastecrm-tls-secret
  rules:
  - host: app.hastecrm.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: hastecrm-web
            port:
              number: 80
  - host: api.hastecrm.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: hastecrm-api
            port:
              number: 4000
```

### 2. SSL/TLS with cert-manager

```yaml
# ingress/cert-manager.yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: devops@hastecrm.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
---
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: hastecrm-tls-cert
  namespace: hastecrm-production
spec:
  secretName: hastecrm-tls-secret
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  commonName: app.hastecrm.com
  dnsNames:
  - app.hastecrm.com
  - api.hastecrm.com
```

## Configuration Management

### 1. ConfigMaps

```yaml
# config/configmaps.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: hastecrm-api-config
  namespace: hastecrm-production
data:
  LOG_LEVEL: "info"
  NODE_ENV: "production"
  ENABLE_METRICS: "true"
  CACHE_TTL: "3600"
  SESSION_TIMEOUT: "86400"
  RATE_LIMIT_WINDOW: "900000"
  RATE_LIMIT_MAX: "1000"
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: hastecrm-web-config
  namespace: hastecrm-production
data:
  NEXT_PUBLIC_API_URL: "https://api.hastecrm.com"
  NEXT_PUBLIC_WEBSOCKET_URL: "wss://api.hastecrm.com"
  NEXT_PUBLIC_SENTRY_DSN: "https://public@sentry.io/project"
```

### 2. Secrets Management

```yaml
# config/sealed-secrets.yaml
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: hastecrm-api-secrets
  namespace: hastecrm-production
spec:
  encryptedData:
    JWT_SECRET: AgBvK5N1Z6YF...
    ENCRYPTION_KEY: AgCmL9X2P8RF...
    DATABASE_URL: AgDnM7Y3Q9SG...
```

### 3. External Secrets Operator

```yaml
# config/external-secrets.yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secretstore
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
---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: hastecrm-database-secret
  namespace: hastecrm-production
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secretstore
    kind: SecretStore
  target:
    name: hastecrm-database-secret
    creationPolicy: Owner
  data:
  - secretKey: url
    remoteRef:
      key: crm/production/database
      property: connection_string
```

## Autoscaling

### 1. Horizontal Pod Autoscaler

```yaml
# autoscaling/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: hastecrm-api-hpa
  namespace: hastecrm-production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: hastecrm-api
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
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
      - type: Pods
        value: 4
        periodSeconds: 15
      selectPolicy: Max
```

### 2. Vertical Pod Autoscaler

```yaml
# autoscaling/vpa.yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: hastecrm-api-vpa
  namespace: hastecrm-production
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: hastecrm-api
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
    - containerName: api
      minAllowed:
        cpu: 200m
        memory: 256Mi
      maxAllowed:
        cpu: 2
        memory: 4Gi
```

## Monitoring Stack

### 1. Prometheus

```yaml
# monitoring/prometheus.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: hastecrm-monitoring
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s
    
    scrape_configs:
    - job_name: 'kubernetes-pods'
      kubernetes_sd_configs:
      - role: pod
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
    
    - job_name: 'crm-api'
      kubernetes_sd_configs:
      - role: endpoints
        namespaces:
          names:
          - hastecrm-production
      relabel_configs:
      - source_labels: [__meta_kubernetes_service_name]
        action: keep
        regex: crm-api
```

### 2. Grafana Dashboards

```yaml
# monitoring/grafana-dashboard.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: hastecrm-dashboard
  namespace: hastecrm-monitoring
data:
  dashboard.json: |
    {
      "dashboard": {
        "title": "CRM Application Metrics",
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
            "title": "Response Time",
            "targets": [
              {
                "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"
              }
            ]
          }
        ]
      }
    }
```

## Security

### 1. Network Policies

```yaml
# security/network-policies.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: hastecrm-api-network-policy
  namespace: hastecrm-production
spec:
  podSelector:
    matchLabels:
      app: hastecrm-api
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: hastecrm-production
    - podSelector:
        matchLabels:
          app: hastecrm-web
    ports:
    - protocol: TCP
      port: 4000
  - from:
    - namespaceSelector:
        matchLabels:
          name: hastecrm-monitoring
    ports:
    - protocol: TCP
      port: 9090
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: hastecrm-data
    ports:
    - protocol: TCP
      port: 5432
    - protocol: TCP
      port: 6379
  - to:
    - podSelector: {}
    ports:
    - protocol: TCP
      port: 53
    - protocol: UDP
      port: 53
```

### 2. Pod Security Policies

```yaml
# security/pod-security.yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: hastecrm-restricted
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'downwardAPI'
    - 'persistentVolumeClaim'
  hostNetwork: false
  hostIPC: false
  hostPID: false
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  supplementalGroups:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'
  readOnlyRootFilesystem: true
```

### 3. RBAC Configuration

```yaml
# security/rbac.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: hastecrm-api
  namespace: hastecrm-production
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: hastecrm-api-role
  namespace: hastecrm-production
rules:
- apiGroups: [""]
  resources: ["configmaps", "secrets"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: hastecrm-api-rolebinding
  namespace: hastecrm-production
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: hastecrm-api-role
subjects:
- kind: ServiceAccount
  name: hastecrm-api
  namespace: hastecrm-production
```

## Backup and Disaster Recovery

### 1. Velero Configuration

```yaml
# backup/velero.yaml
apiVersion: velero.io/v1
kind: Schedule
metadata:
  name: hastecrm-daily-backup
  namespace: velero
spec:
  schedule: "0 2 * * *"
  template:
    includedNamespaces:
    - crm-production
    - crm-data
    ttl: 720h0m0s
    storageLocation: aws-backup
    volumeSnapshotLocations:
    - aws-volumes
    hooks:
      resources:
      - name: postgres-backup
        includedNamespaces:
        - hastecrm-data
        labelSelector:
          matchLabels:
            app: postgres
        pre:
        - exec:
            container: postgres
            command:
            - /bin/bash
            - -c
            - pg_dump -U $POSTGRES_USER $POSTGRES_DB > /backup/dump.sql
```

### 2. Disaster Recovery Plan

```yaml
# backup/restore-procedure.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: disaster-recovery-plan
  namespace: hastecrm-production
data:
  restore.sh: |
    #!/bin/bash
    set -e
    
    echo "Starting disaster recovery..."
    
    # 1. Restore Kubernetes resources
    velero restore create --from-backup crm-daily-backup-20240110
    
    # 2. Wait for pods to be ready
    kubectl wait --for=condition=ready pod -l app=crm-api -n hastecrm-production --timeout=300s
    
    # 3. Restore database
    kubectl exec -it hastecrm-postgres-0 -n hastecrm-data -- psql -U postgres -c "DROP DATABASE IF EXISTS crm_production;"
    kubectl exec -it hastecrm-postgres-0 -n hastecrm-data -- psql -U postgres -c "CREATE DATABASE crm_production;"
    kubectl exec -i crm-postgres-0 -n hastecrm-data -- psql -U postgres crm_production < backup/dump.sql
    
    # 4. Clear Redis cache
    kubectl exec -it crm-redis-0 -n hastecrm-data -- redis-cli FLUSHALL
    
    # 5. Verify services
    ./health-check.sh
    
    echo "Disaster recovery completed!"
```

## CI/CD Integration

### 1. GitOps with ArgoCD

```yaml
# gitops/argocd-app.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: hastecrm-production
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/company/hastecrm-k8s-config
    targetRevision: main
    path: environments/production
  destination:
    server: https://kubernetes.default.svc
    namespace: hastecrm-production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
    - CreateNamespace=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
```

### 2. GitHub Actions Deployment

```yaml
# .github/workflows/deploy-k8s.yml
name: Deploy to Kubernetes

on:
  push:
    branches: [main]
    paths:
    - 'k8s/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Configure kubectl
      uses: azure/setup-kubectl@v3
      with:
        version: 'v1.28.0'
    
    - name: Set up Kustomize
      uses: imranismail/setup-kustomize@v2
      with:
        kustomize-version: '5.0.0'
    
    - name: Deploy to staging
      env:
        KUBE_CONFIG: ${{ secrets.KUBE_CONFIG_STAGING }}
      run: |
        echo "$KUBE_CONFIG" | base64 -d > kubeconfig
        export KUBECONFIG=kubeconfig
        
        cd k8s/overlays/staging
        kustomize build . | kubectl apply -f -
        kubectl rollout status deployment/crm-api -n hastecrm-staging
        kubectl rollout status deployment/crm-web -n hastecrm-staging
```

## Troubleshooting

### Common Issues

1. **Pod CrashLoopBackOff**
```bash
# Check logs
kubectl logs -f pod-name -n namespace --previous

# Describe pod
kubectl describe pod pod-name -n namespace

# Check events
kubectl get events -n namespace --sort-by='.lastTimestamp'
```

2. **Service Discovery Issues**
```bash
# Test DNS resolution
kubectl run -it --rm debug --image=nicolaka/netshoot --restart=Never -- bash
nslookup crm-api.hastecrm-production.svc.cluster.local

# Check endpoints
kubectl get endpoints -n hastecrm-production
```

3. **Performance Issues**
```bash
# Check resource usage
kubectl top nodes
kubectl top pods -n hastecrm-production

# Check HPA status
kubectl get hpa -n hastecrm-production

# Review metrics
kubectl port-forward -n hastecrm-monitoring prometheus-0 9090:9090
```

### Debug Tools

```yaml
# debug/debug-pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: debug
  namespace: hastecrm-production
spec:
  containers:
  - name: debug
    image: nicolaka/netshoot
    command: ["/bin/bash"]
    args: ["-c", "while true; do sleep 30; done;"]
    resources:
      limits:
        memory: "128Mi"
        cpu: "100m"
```

## Maintenance

### Rolling Updates

```bash
# Update deployment image
kubectl set image deployment/hastecrm-api api=hastecrm/api:v2.0.0 -n hastecrm-production

# Check rollout status
kubectl rollout status deployment/hastecrm-api -n hastecrm-production

# Rollback if needed
kubectl rollout undo deployment/crm-api -n hastecrm-production
```

### Database Migrations

```yaml
# jobs/migration.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: hastecrm-db-migration-v2
  namespace: hastecrm-production
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: migration
        image: hastecrm/api:v2.0.0
        command: ["npm", "run", "db:migrate"]
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: hastecrm-database-secret
              key: url
```

## Cost Optimization

### Resource Recommendations

```yaml
# Set appropriate resource requests/limits
resources:
  requests:
    memory: "256Mi"  # Based on actual usage
    cpu: "100m"      # Based on actual usage
  limits:
    memory: "512Mi"  # 2x requests
    cpu: "500m"      # 5x requests for burst
```

### Node Autoscaling

```yaml
# cluster-autoscaler/config.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cluster-autoscaler
  namespace: kube-system
spec:
  template:
    spec:
      containers:
      - image: k8s.gcr.io/autoscaling/cluster-autoscaler:v1.28.0
        name: cluster-autoscaler
        command:
        - ./cluster-autoscaler
        - --v=4
        - --stderrthreshold=info
        - --cloud-provider=aws
        - --skip-nodes-with-local-storage=false
        - --expander=least-waste
        - --node-group-auto-discovery=asg:tag=k8s.io/cluster-autoscaler/enabled,k8s.io/cluster-autoscaler/crm-cluster
        - --scale-down-delay-after-add=10m
        - --scale-down-unneeded-time=10m
```

## Checklist

### Pre-deployment
- [ ] Cluster meets minimum requirements
- [ ] Namespaces created
- [ ] RBAC configured
- [ ] Secrets management configured
- [ ] Monitoring stack deployed
- [ ] Backup solution configured
- [ ] Network policies applied
- [ ] Ingress controller installed
- [ ] SSL certificates configured
- [ ] Resource limits set

### Post-deployment
- [ ] All pods running
- [ ] Health checks passing
- [ ] Metrics being collected
- [ ] Logs aggregated
- [ ] Backups scheduled
- [ ] Alerts configured
- [ ] Load testing completed
- [ ] Documentation updated
- [ ] Team access configured
- [ ] Runbook created# Kubernetes Deployment - Suggested Improvements

## Current Document Analysis

The Kubernetes deployment documentation is comprehensive and well-structured. However, there are several areas where it can be enhanced for better production readiness, security, and operational excellence.

## Suggested Improvements

### 1. **Architecture Diagram Issues**
The ASCII diagram is corrupted with special characters. Replace with a proper diagram or clean ASCII art:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Kubernetes Cluster                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   Ingress   │  │Load Balancer│  │   SSL/TLS   │            │
│  │ Controller  │  │  Service    │  │   Manager   │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
├─────────────────────────────────────────────────────────────────┤
│                    Application Layer                             │
│  ┌─────────────┬─────────────┬─────────────────────┐           │
│  │   Web App   │   API       │   Background        │           │
│  │   (Next.js) │   (Node.js) │   Workers           │           │
│  └─────────────┴─────────────┴─────────────────────┘           │
├─────────────────────────────────────────────────────────────────┤
│                     Data Layer                                   │
│  ┌─────────────┬─────────────┬─────────────────────┐           │
│  │  PostgreSQL │    Redis    │   Elasticsearch     │           │
│  │   (Primary) │   Cluster   │     Cluster         │           │
│  └─────────────┴─────────────┴─────────────────────┘           │
├─────────────────────────────────────────────────────────────────┤
│                  Supporting Services                             │
│  ┌─────────────┬─────────────┬─────────────────────┐           │
│  │ Prometheus  │   Grafana   │    Jaeger           │           │
│  │             │             │    (Tracing)        │           │
│  └─────────────┴─────────────┴─────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

### 2. **Missing Critical Components**

#### a. Service Mesh Configuration
Add Istio or Linkerd configuration for better observability and security:

```yaml
# service-mesh/istio-gateway.yaml
apiVersion: networking.istio.io/v1beta1
kind: Gateway
metadata:
  name: hastecrm-gateway
  namespace: hastecrm-production
spec:
  selector:
    istio: ingressgateway
  servers:
  - port:
      number: 443
      name: https
      protocol: HTTPS
    tls:
      mode: SIMPLE
      credentialName: crm-tls-cert
    hosts:
    - "*.crm.company.com"
---
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: hastecrm-routes
  namespace: hastecrm-production
spec:
  hosts:
  - app.crm.company.com
  - api.crm.company.com
  gateways:
  - crm-gateway
  http:
  - match:
    - uri:
        prefix: /api
    route:
    - destination:
        host: crm-api
        port:
          number: 4000
      timeout: 30s
      retries:
        attempts: 3
        perTryTimeout: 10s
```

#### b. Pod Disruption Budgets
Essential for maintaining availability during updates:

```yaml
# availability/pdb.yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: hastecrm-api-pdb
  namespace: hastecrm-production
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: hastecrm-api
---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: hastecrm-web-pdb
  namespace: hastecrm-production
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: hastecrm-web
```

#### c. Resource Quotas
Add namespace resource limits:

```yaml
# namespaces/resource-quotas.yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: hastecrm-production-quota
  namespace: hastecrm-production
spec:
  hard:
    requests.cpu: "100"
    requests.memory: "200Gi"
    limits.cpu: "200"
    limits.memory: "400Gi"
    persistentvolumeclaims: "20"
    services.loadbalancers: "2"
---
apiVersion: v1
kind: LimitRange
metadata:
  name: hastecrm-production-limits
  namespace: hastecrm-production
spec:
  limits:
  - default:
      cpu: "1"
      memory: "1Gi"
    defaultRequest:
      cpu: "100m"
      memory: "128Mi"
    type: Container
```

### 3. **Enhanced Security**

#### a. Pod Security Standards (replacing deprecated PSPs)
```yaml
# security/pod-security-standards.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: hastecrm-production
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

#### b. OPA Gatekeeper Policies
```yaml
# security/opa-policies.yaml
apiVersion: templates.gatekeeper.sh/v1beta1
kind: ConstraintTemplate
metadata:
  name: k8srequiredsecuritycontext
spec:
  crd:
    spec:
      names:
        kind: K8sRequiredSecurityContext
      validation:
        openAPIV3Schema:
          type: object
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package k8srequiredsecuritycontext
        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          not container.securityContext.runAsNonRoot
          msg := "Containers must run as non-root user"
        }
```

#### c. Secrets Encryption at Rest
```yaml
# encryption/encryption-config.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources:
      - secrets
    providers:
      - aescbc:
          keys:
            - name: key1
              secret: <base64-encoded-secret>
      - identity: {}
```

### 4. **Improved Observability**

#### a. OpenTelemetry Configuration
```yaml
# observability/opentelemetry.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: otel-collector-config
  namespace: hastecrm-monitoring
data:
  otel-collector-config.yaml: |
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
          http:
            endpoint: 0.0.0.0:4318
      prometheus:
        config:
          scrape_configs:
            - job_name: 'crm-metrics'
              kubernetes_sd_configs:
                - role: pod
    processors:
      batch:
        timeout: 10s
      memory_limiter:
        check_interval: 1s
        limit_mib: 512
    exporters:
      prometheus:
        endpoint: "0.0.0.0:8889"
      jaeger:
        endpoint: jaeger-collector:14250
        tls:
          insecure: true
    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [batch, memory_limiter]
          exporters: [jaeger]
        metrics:
          receivers: [otlp, prometheus]
          processors: [batch]
          exporters: [prometheus]
```

#### b. Logging Stack (EFK)
```yaml
# logging/fluentbit.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluent-bit-config
  namespace: hastecrm-monitoring
data:
  fluent-bit.conf: |
    [SERVICE]
        Flush         1
        Log_Level     info
        Daemon        off
        Parsers_File  parsers.conf
    
    [INPUT]
        Name              tail
        Tag               kube.*
        Path              /var/log/containers/*.log
        Parser            docker
        DB                /var/log/flb_kube.db
        Mem_Buf_Limit     50MB
        Skip_Long_Lines   On
    
    [FILTER]
        Name                kubernetes
        Match               kube.*
        Kube_URL            https://kubernetes.default.svc:443
        Kube_CA_File        /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
        Kube_Token_File     /var/run/secrets/kubernetes.io/serviceaccount/token
        Merge_Log           On
        K8S-Logging.Parser  On
        K8S-Logging.Exclude On
    
    [OUTPUT]
        Name            es
        Match           *
        Host            elasticsearch
        Port            9200
        Logstash_Format On
        Include_Tag_Key On
        Tag_Key         @log_name
```

### 5. **Advanced Deployment Strategies**

#### a. Canary Deployments with Flagger
```yaml
# deployments/canary.yaml
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
  progressDeadlineSeconds: 60
  service:
    port: 4000
    targetPort: 4000
    gateways:
    - public-gateway.istio-system.svc.cluster.local
    hosts:
    - api.crm.company.com
  analysis:
    interval: 30s
    threshold: 5
    maxWeight: 50
    stepWeight: 10
    metrics:
    - name: request-success-rate
      thresholdRange:
        min: 99
      interval: 30s
    - name: request-duration
      thresholdRange:
        max: 500
      interval: 30s
    webhooks:
    - name: load-test
      url: http://flagger-loadtester.test/
      timeout: 5s
      metadata:
        cmd: "hey -z 1m -q 10 -c 2 https://api.crm.company.com/health"
```

#### b. Blue-Green Deployments
```yaml
# deployments/blue-green.yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: hastecrm-api-rollout
  namespace: hastecrm-production
spec:
  replicas: 5
  strategy:
    blueGreen:
      activeService: crm-api-active
      previewService: crm-api-preview
      autoPromotionEnabled: false
      scaleDownDelaySeconds: 30
      prePromotionAnalysis:
        templates:
        - templateName: success-rate
        args:
        - name: service-name
          value: crm-api-preview
  selector:
    matchLabels:
      app: hastecrm-api
  template:
    metadata:
      labels:
        app: hastecrm-api
    spec:
      containers:
      - name: api
        image: hastecrm/api:latest
```

### 6. **Multi-Region Setup**

```yaml
# multi-region/federation.yaml
apiVersion: types.kubefed.io/v1beta1
kind: FederatedDeployment
metadata:
  name: hastecrm-api
  namespace: hastecrm-production
spec:
  template:
    metadata:
      labels:
        app: hastecrm-api
    spec:
      replicas: 5
      selector:
        matchLabels:
          app: hastecrm-api
      template:
        # ... deployment spec
  placement:
    clusters:
    - name: us-east-1
    - name: eu-west-1
    - name: ap-southeast-1
  overrides:
  - clusterName: us-east-1
    clusterOverrides:
    - path: "/spec/replicas"
      value: 10
  - clusterName: eu-west-1
    clusterOverrides:
    - path: "/spec/replicas"
      value: 7
  - clusterName: ap-southeast-1
    clusterOverrides:
    - path: "/spec/replicas"
      value: 5
```

### 7. **Cost Optimization Enhancements**

#### a. Karpenter for Node Autoscaling
```yaml
# autoscaling/karpenter.yaml
apiVersion: karpenter.sh/v1alpha5
kind: Provisioner
metadata:
  name: hastecrm-provisioner
spec:
  requirements:
    - key: karpenter.sh/capacity-type
      operator: In
      values: ["spot", "on-demand"]
    - key: node.kubernetes.io/instance-type
      operator: In
      values: 
        - m5.large
        - m5.xlarge
        - m5.2xlarge
        - c5.large
        - c5.xlarge
  limits:
    resources:
      cpu: 1000
      memory: 1000Gi
  provider:
    subnetSelector:
      karpenter.sh/discovery: "crm-cluster"
    securityGroupSelector:
      karpenter.sh/discovery: "crm-cluster"
    instanceStorePolicy: RAID0
  ttlSecondsAfterEmpty: 30
  ttlSecondsUntilExpired: 2592000 # 30 days
```

#### b. Goldilocks for Right-Sizing
```yaml
# cost-optimization/goldilocks.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: hastecrm-production
  labels:
    goldilocks.fairwinds.com/enabled: "true"
---
apiVersion: autoscaling/v1
kind: VerticalPodAutoscaler
metadata:
  name: goldilocks-crm-api
  namespace: hastecrm-production
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: hastecrm-api
  updatePolicy:
    updateMode: "Off"
```

### 8. **Disaster Recovery Improvements**

#### a. Cross-Region Backup
```yaml
# backup/cross-region-backup.yaml
apiVersion: velero.io/v1
kind: BackupStorageLocation
metadata:
  name: secondary-region
  namespace: velero
spec:
  provider: aws
  objectStorage:
    bucket: hastecrm-backup-secondary
  config:
    region: eu-west-1
    s3ForcePathStyle: "false"
    s3Url: https://s3.eu-west-1.amazonaws.com
---
apiVersion: velero.io/v1
kind: Schedule
metadata:
  name: hastecrm-cross-region-backup
  namespace: velero
spec:
  schedule: "0 */6 * * *"
  template:
    storageLocation: secondary-region
    includedNamespaces:
    - crm-production
    - crm-data
    ttl: 168h0m0s # 7 days
```

#### b. Automated DR Testing
```yaml
# backup/dr-test-job.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: dr-test
  namespace: velero
spec:
  schedule: "0 0 * * 0" # Weekly
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: dr-test
            image: hastecrm/dr-test:latest
            command:
            - /bin/bash
            - -c
            - |
              # Create test namespace
              kubectl create namespace dr-test
              
              # Restore latest backup
              velero restore create dr-test-restore \
                --from-backup $(velero backup get -o json | jq -r '.items[0].metadata.name') \
                --namespace-mappings crm-production:dr-test
              
              # Wait for restore
              sleep 300
              
              # Run smoke tests
              kubectl run smoke-test --image=crm/smoke-test:latest -n dr-test
              
              # Clean up
              kubectl delete namespace dr-test
```

### 9. **GitOps Improvements**

#### a. Multi-Environment Management
```yaml
# gitops/applicationset.yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: hastecrm-environments
  namespace: argocd
spec:
  generators:
  - list:
      elements:
      - env: dev
        namespace: hastecrm-development
        cluster: dev-cluster
      - env: staging
        namespace: hastecrm-staging
        cluster: staging-cluster
      - env: production
        namespace: hastecrm-production
        cluster: prod-cluster
  template:
    metadata:
      name: 'crm-{{env}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/company/hastecrm-k8s-config
        targetRevision: main
        path: 'environments/{{env}}'
      destination:
        server: '{{cluster}}'
        namespace: '{{namespace}}'
      syncPolicy:
        automated:
          prune: true
          selfHeal: true
        syncOptions:
        - CreateNamespace=true
```

### 10. **Additional Monitoring & Alerting**

#### a. Comprehensive Alerting Rules
```yaml
# monitoring/alerting-rules.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-alerts
  namespace: hastecrm-monitoring
data:
  alerts.yaml: |
    groups:
    - name: hastecrm-critical
      interval: 30s
      rules:
      - alert: APIHighErrorRate
        expr: |
          sum(rate(http_requests_total{job="crm-api",status=~"5.."}[5m])) 
          / sum(rate(http_requests_total{job="crm-api"}[5m])) > 0.05
        for: 5m
        labels:
          severity: critical
          team: backend
        annotations:
          summary: "High error rate on CRM API"
          description: "Error rate is {{ $value | humanizePercentage }} for the last 5 minutes"
      
      - alert: DatabaseConnectionPoolExhausted
        expr: |
          (pg_stat_database_numbackends{datname="hastecrm_production"} 
          / pg_settings_max_connections) > 0.8
        for: 5m
        labels:
          severity: warning
          team: backend
        annotations:
          summary: "Database connection pool nearly exhausted"
          description: "{{ $value | humanizePercentage }} of connections are in use"
      
      - alert: PodMemoryUsageHigh
        expr: |
          (container_memory_working_set_bytes{namespace="crm-production"} 
          / container_spec_memory_limit_bytes) > 0.9
        for: 5m
        labels:
          severity: warning
          team: devops
        annotations:
          summary: "Pod memory usage is high"
          description: "Pod {{ $labels.pod }} memory usage is at {{ $value | humanizePercentage }}"
      
      - alert: PersistentVolumeSpaceLow
        expr: |
          (kubelet_volume_stats_available_bytes 
          / kubelet_volume_stats_capacity_bytes) < 0.1
        for: 5m
        labels:
          severity: critical
          team: devops
        annotations:
          summary: "PV space is running low"
          description: "PV {{ $labels.persistentvolumeclaim }} has only {{ $value | humanizePercentage }} space left"
```

### 11. **Testing in Production**

#### a. Chaos Engineering
```yaml
# chaos/litmus-chaos.yaml
apiVersion: litmuschaos.io/v1alpha1
kind: ChaosEngine
metadata:
  name: hastecrm-chaos
  namespace: hastecrm-production
spec:
  appinfo:
    appns: crm-production
    applabel: "app=crm-api"
    appkind: deployment
  engineState: 'active'
  chaosServiceAccount: litmus-admin
  experiments:
  - name: pod-cpu-hog
    spec:
      components:
        env:
        - name: CPU_CORES
          value: '1'
        - name: TOTAL_CHAOS_DURATION
          value: '60' # seconds
        - name: CPU_LOAD
          value: '50' # percentage
  - name: pod-network-latency
    spec:
      components:
        env:
        - name: NETWORK_INTERFACE
          value: 'eth0'
        - name: NETWORK_LATENCY
          value: '200' # ms
        - name: TOTAL_CHAOS_DURATION
          value: '60'
```

### 12. **Documentation Additions**

#### a. Runbook Template
```markdown
## Service: hasteCRM API

### Critical Alerts

#### High Error Rate
**Alert**: APIHighErrorRate
**Severity**: Critical
**Threshold**: Error rate > 5% for 5 minutes

**Investigation Steps**:
1. Check recent deployments: `kubectl rollout history deployment/crm-api -n hastecrm-production`
2. View API logs: `kubectl logs -l app=hastecrm-api -n hastecrm-production --tail=100`
3. Check database connectivity: `kubectl exec -it deployment/crm-api -n hastecrm-production -- nc -zv crm-postgres 5432`
4. Review recent changes in git

**Mitigation Steps**:
1. If recent deployment: `kubectl rollout undo deployment/crm-api -n hastecrm-production`
2. Scale up if load-related: `kubectl scale deployment/crm-api --replicas=10 -n hastecrm-production`
3. Check and restart unhealthy pods: `kubectl delete pod -l app=crm-api,status.phase!=Running -n hastecrm-production`

**Escalation**:
- After 15 minutes: Page on-call engineer
- After 30 minutes: Page team lead
- After 1 hour: Incident commander
```

#### b. Deployment Playbook
```markdown
## Deployment Playbook

### Pre-deployment Checklist
- [ ] All tests passing in CI
- [ ] Security scan completed
- [ ] Database migrations reviewed
- [ ] Rollback plan documented
- [ ] Change approved by team lead
- [ ] Monitoring dashboard ready
- [ ] Communication sent to stakeholders

### Deployment Steps
1. **Create deployment branch**
   ```bash
   git checkout -b deploy/v2.1.0
   git tag v2.1.0
   git push origin v2.1.0
   ```

2. **Run database migrations**
   ```bash
   kubectl apply -f k8s/jobs/migration-v2.1.0.yaml
   kubectl wait --for=condition=complete job/migration-v2.1.0 -n hastecrm-production
   ```

3. **Deploy canary**
   ```bash
   kubectl apply -f k8s/deployments/canary/api-v2.1.0.yaml
   # Monitor for 30 minutes
   ```

4. **Promote to production**
   ```bash
   kubectl set image deployment/hastecrm-api api=hastecrm/api:v2.1.0 -n hastecrm-production
   kubectl rollout status deployment/hastecrm-api -n hastecrm-production
   ```

### Post-deployment Verification
- [ ] Health checks passing
- [ ] No increase in error rates
- [ ] Performance metrics normal
- [ ] Key user journeys tested
- [ ] Logs reviewed for errors
```

## Summary

These improvements enhance the Kubernetes deployment in several key areas:

1. **Security**: Pod Security Standards, OPA policies, secrets encryption
2. **Reliability**: PDBs, resource quotas, cross-region backups
3. **Observability**: OpenTelemetry, comprehensive alerting, distributed tracing
4. **Cost**: Karpenter for better node utilization, Goldilocks for right-sizing
5. **Operations**: Canary deployments, chaos engineering, detailed runbooks
6. **Multi-region**: Federation support, cross-region DR
7. **GitOps**: ApplicationSets for multi-environment management

The additions make the deployment more production-ready and enterprise-grade while maintaining clarity and usability.