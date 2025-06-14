# Production Deployment Guide

## Overview

This guide covers deploying hasteCRM to production using Docker and Docker Compose.

## Prerequisites

- Docker 20.10+ installed
- Docker Compose 2.0+ installed
- Domain name configured
- SSL certificates (or use Let's Encrypt)
- Minimum 4GB RAM, 2 CPU cores
- 20GB disk space

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/hasteCRM.git
   cd hasteCRM
   ```

2. **Configure environment**
   ```bash
   cp .env.production.example .env.production
   # Edit .env.production with your values
   nano .env.production
   ```

3. **Deploy**
   ```bash
   ./scripts/deploy.sh
   ```

## Detailed Setup

### 1. Environment Configuration

Create `.env.production` from the template:

```bash
cp .env.production.example .env.production
```

**Required configurations:**

#### Database
```env
POSTGRES_PASSWORD=<strong-password>
```

#### Redis
```env
REDIS_PASSWORD=<strong-password>
```

#### Authentication
```env
JWT_SECRET=<32+ character secret>
JWT_REFRESH_SECRET=<different 32+ character secret>
```

Generate secrets:
```bash
# Generate JWT secret
openssl rand -base64 32

# Generate database password
openssl rand -base64 24
```

#### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI: `https://api.yourdomain.com/auth/google/callback`
4. Copy client ID and secret to `.env.production`

#### AI Features
Get API key from [Anthropic](https://www.anthropic.com/api)

### 2. SSL/TLS Setup

#### Option A: Let's Encrypt (Recommended)

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot

# Generate certificates
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./nginx/ssl/key.pem
```

#### Option B: Custom Certificates

Place your certificates in `./nginx/ssl/`:
- `cert.pem` - Certificate file
- `key.pem` - Private key file

### 3. Database Setup

#### Initial Setup
```bash
# Start only database service
docker-compose -f docker-compose.production.yml up -d postgres

# Run initial migrations
docker-compose -f docker-compose.production.yml run --rm api npx prisma migrate deploy

# Create initial admin user (optional)
docker-compose -f docker-compose.production.yml run --rm api npm run seed
```

#### Backups
Configure automated backups in `.env.production`:
```env
BACKUP_ENABLED=true
BACKUP_SCHEDULE="0 2 * * *"  # 2 AM daily
```

Manual backup:
```bash
./scripts/deploy.sh backup
```

### 4. Deployment

#### First Deployment
```bash
# Run the deployment script
./scripts/deploy.sh

# Or manually:
docker-compose -f docker-compose.production.yml up -d
```

#### Update Deployment
```bash
# Pull latest code
git pull origin main

# Deploy updates
./scripts/deploy.sh
```

### 5. Monitoring

#### Health Checks
- API: https://api.yourdomain.com/health
- Web: https://yourdomain.com/health.json
- Metrics: https://api.yourdomain.com/metrics

#### Logs
```bash
# View all logs
docker-compose -f docker-compose.production.yml logs -f

# View specific service
docker-compose -f docker-compose.production.yml logs -f api

# Last 100 lines
docker-compose -f docker-compose.production.yml logs --tail=100
```

#### Metrics
Access Prometheus-formatted metrics:
```bash
curl http://localhost:4000/metrics/prometheus
```

### 6. Scaling

#### Horizontal Scaling
```yaml
# docker-compose.production.yml
api:
  deploy:
    replicas: 3
```

#### Resource Limits
```yaml
api:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 2G
      reservations:
        cpus: '1'
        memory: 1G
```

### 7. Security

#### Firewall Rules
```bash
# Allow only necessary ports
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

#### Security Headers
Already configured in nginx.conf:
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection
- Strict-Transport-Security

### 8. Troubleshooting

#### Container Issues
```bash
# Check status
docker-compose -f docker-compose.production.yml ps

# Restart service
docker-compose -f docker-compose.production.yml restart api

# Check logs
docker-compose -f docker-compose.production.yml logs api
```

#### Database Connection
```bash
# Test connection
docker-compose -f docker-compose.production.yml exec postgres pg_isready

# Connect to database
docker-compose -f docker-compose.production.yml exec postgres psql -U postgres hasteCRM
```

#### Redis Connection
```bash
# Test connection
docker-compose -f docker-compose.production.yml exec redis redis-cli ping
```

### 9. Maintenance

#### Updates
```bash
# Stop services
docker-compose -f docker-compose.production.yml down

# Pull latest
git pull origin main

# Rebuild and deploy
./scripts/deploy.sh
```

#### Database Migrations
```bash
# Run pending migrations
docker-compose -f docker-compose.production.yml run --rm api npx prisma migrate deploy
```

#### Cleanup
```bash
# Remove unused images
docker image prune -f

# Remove unused volumes (careful!)
docker volume prune -f
```

### 10. Rollback

If deployment fails:

```bash
# Stop current deployment
docker-compose -f docker-compose.production.yml down

# Restore database from backup
gunzip -c backups/hasteCRM_backup_YYYYMMDD_HHMMSS.sql.gz | \
  docker-compose -f docker-compose.production.yml exec -T postgres psql -U postgres hasteCRM

# Start previous version
docker-compose -f docker-compose.production.yml up -d
```

## Performance Optimization

### 1. Enable Redis Persistence
```yaml
redis:
  command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
```

### 2. PostgreSQL Tuning
Create `postgres/postgresql.conf`:
```conf
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
```

### 3. Nginx Caching
Already configured for static assets in nginx.conf

## Monitoring Setup

### Prometheus Integration
```yaml
# docker-compose.production.yml
prometheus:
  image: prom/prometheus:latest
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
  ports:
    - "9090:9090"
```

### Grafana Dashboards
```yaml
grafana:
  image: grafana/grafana:latest
  ports:
    - "3001:3000"
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=admin
```

## Support

For issues or questions:
- Check logs: `docker-compose logs -f`
- Review [troubleshooting guide](./troubleshooting.md)
- Open an issue on GitHub