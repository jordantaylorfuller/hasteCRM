# Deployment Guide

## Development

```bash
# Start all services
docker-compose up -d
pnpm dev

# Access
- Web: http://localhost:3000
- API: http://localhost:4000
```

## Production with Docker

### 1. Build Images

```bash
# Build all services
docker build -f apps/api/Dockerfile -t hastenyc/api .
docker build -f apps/web/Dockerfile -t hastenyc/web .
docker build -f apps/worker/Dockerfile -t hastenyc/worker .
```

### 2. Run with Docker Compose

```bash
# Start production stack
docker-compose -f docker-compose.production.yml up -d

# Check health
docker-compose ps
docker-compose logs -f
```

### 3. Environment Variables

```env
# Production .env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@postgres:5432/hasteCRM
REDIS_URL=redis://:password@redis:6379
JWT_SECRET=production-secret-min-32-chars
NEXT_PUBLIC_API_URL=https://api.haste.nyc
```

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (1.28+)
- kubectl configured
- Helm installed

### Deploy

```bash
# Create namespace
kubectl create namespace hasteCRM

# Create secrets
kubectl create secret generic api-secrets \
  --from-env-file=.env.production \
  -n hasteCRM

# Deploy with Helm
helm install hasteCRM ./kubernetes/helm/hasteCRM \
  --namespace hasteCRM \
  --values ./kubernetes/helm/hasteCRM/values.production.yaml

# Check deployment
kubectl get pods -n hasteCRM
kubectl get services -n hasteCRM
```

## Health Checks

### API Health

```bash
curl https://api.haste.nyc/health
```

### Database Health

```bash
kubectl exec -it postgres-0 -n hasteCRM -- pg_isready
```

### Queue Status

```bash
kubectl exec -it worker-0 -n hasteCRM -- npm run queue:stats
```

## Monitoring

### Metrics

- CPU/Memory usage via Kubernetes metrics
- Application metrics via Prometheus
- Custom business metrics

### Logs

```bash
# View logs
kubectl logs -l app=api -n hasteCRM --tail=100 -f

# Search errors
kubectl logs -l app=api -n hasteCRM | grep ERROR
```

### Alerts

Configure alerts for:

- API response time > 500ms
- Error rate > 5%
- Database connections > 80%
- Queue depth > 1000

## Scaling

### Horizontal Scaling

```bash
# Scale API pods
kubectl scale deployment api --replicas=5 -n hasteCRM

# Scale workers
kubectl scale deployment worker --replicas=3 -n hasteCRM
```

### Database Scaling

- Add read replicas for queries
- Use connection pooling
- Enable query caching

## Backup & Recovery

### Database Backup

```bash
# Manual backup
kubectl exec -it postgres-0 -n hasteCRM -- \
  pg_dump -U postgres hasteCRM > backup.sql

# Restore
kubectl exec -i postgres-0 -n hasteCRM -- \
  psql -U postgres hasteCRM < backup.sql
```

### Automated Backups

Configure daily backups with retention:

- Daily: 7 days
- Weekly: 4 weeks
- Monthly: 12 months

## SSL/TLS

### Certificate Management

```yaml
# Using cert-manager
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: hasteCRM-tls
spec:
  secretName: hasteCRM-tls
  issuerRef:
    name: letsencrypt-prod
  dnsNames:
    - api.haste.nyc
    - www.haste.nyc
```

## Rollback

### Quick Rollback

```bash
# Rollback deployment
kubectl rollout undo deployment/api -n hasteCRM

# Rollback to specific revision
kubectl rollout undo deployment/api --to-revision=2 -n hasteCRM
```

## Performance Tuning

### API Performance

- Enable response caching
- Optimize database queries
- Use CDN for static assets

### Database Performance

- Add appropriate indexes
- Enable query plan caching
- Regular VACUUM ANALYZE

### Redis Performance

- Set appropriate memory limits
- Configure eviction policy
- Monitor memory usage
