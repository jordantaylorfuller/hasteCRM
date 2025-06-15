# Backup and Recovery Guide

## Overview

hasteCRM implements a comprehensive backup strategy that includes:

- Automated daily backups of PostgreSQL and Redis
- Compression and encryption of backup files
- S3 storage for offsite backup retention
- Point-in-time recovery capabilities
- Automated backup verification and monitoring

## Backup Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ PostgreSQL  │────▶│   Backup    │────▶│    Local    │
│  Database   │     │   Script    │     │   Storage   │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
┌─────────────┐     ┌─────────────┐           │
│    Redis    │────▶│   Backup    │───────────┤
│    Cache    │     │   Script    │           │
└─────────────┘     └─────────────┘           ▼
                                         ┌─────────────┐
                                         │   AWS S3    │
                                         │   Storage   │
                                         └─────────────┘
```

## Quick Start

### Manual Backup

Run a manual backup immediately:

```bash
./scripts/run-backup.sh
```

### Automated Backups

Set up automated daily backups:

```bash
./scripts/backup/backup-cron.sh
```

## Configuration

### Environment Variables

Create a `.env` file with:

```bash
# PostgreSQL
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=crm_dev
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# AWS S3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_DEFAULT_REGION=us-east-1
S3_BACKUP_BUCKET=your-backup-bucket
S3_PREFIX=hastecrm-backups
```

### S3 Bucket Setup

1. Create an S3 bucket:

   ```bash
   aws s3 mb s3://your-backup-bucket
   ```

2. Enable versioning:

   ```bash
   aws s3api put-bucket-versioning \
     --bucket your-backup-bucket \
     --versioning-configuration Status=Enabled
   ```

3. Set up lifecycle policy for cost optimization:
   ```json
   {
     "Rules": [
       {
         "Id": "backup-lifecycle",
         "Status": "Enabled",
         "Transitions": [
           {
             "Days": 30,
             "StorageClass": "STANDARD_IA"
           },
           {
             "Days": 90,
             "StorageClass": "GLACIER"
           }
         ],
         "Expiration": {
           "Days": 365
         }
       }
     ]
   }
   ```

## Backup Process

### PostgreSQL Backup

1. **Full Database Dump**: Creates a complete SQL dump
2. **Compression**: Gzip compression reduces size by ~80%
3. **Consistency**: Uses pg_dump with transaction isolation
4. **Metadata**: Includes schema and data

### Redis Backup

1. **RDB Snapshot**: Uses BGSAVE for non-blocking backup
2. **Point-in-Time**: Captures exact state at backup time
3. **Compression**: Gzip compression of RDB file
4. **AOF Support**: Can be configured for append-only file

## Recovery Procedures

### PostgreSQL Recovery

#### From Latest Backup

```bash
# Stop the application
docker-compose down

# Restore from latest backup
docker-compose -f docker-compose.backup.yml run --rm postgres-backup \
  bash -c "gunzip -c /backups/postgres/postgres_latest.sql.gz | \
  psql -h postgres -U postgres -d crm_dev"

# Start the application
docker-compose up -d
```

#### From Specific Date

```bash
# List available backups
ls -la backups/postgres/

# Restore specific backup
docker-compose -f docker-compose.backup.yml run --rm postgres-backup \
  bash -c "gunzip -c /backups/postgres/postgres_crm_dev_20240115_020000.sql.gz | \
  psql -h postgres -U postgres -d crm_dev"
```

#### From S3

```bash
# Download backup from S3
aws s3 cp s3://your-backup-bucket/hastecrm-backups/postgres/postgres_crm_dev_20240115_020000.sql.gz \
  backups/postgres/

# Restore as above
```

### Redis Recovery

#### From Latest Backup

```bash
# Stop Redis
docker-compose stop redis

# Copy backup file
docker-compose -f docker-compose.backup.yml run --rm redis-backup \
  bash -c "gunzip -c /backups/redis/redis_latest.rdb.gz > /data/dump.rdb"

# Start Redis
docker-compose start redis
```

## Backup Verification

### Automated Verification

The backup process includes automatic verification:

1. **File Integrity**: Checks backup file exists and size > 0
2. **Compression Test**: Verifies gzip integrity
3. **S3 Upload**: Confirms successful upload

### Manual Verification

```bash
# Test PostgreSQL backup
gunzip -t backups/postgres/postgres_latest.sql.gz

# Test Redis backup
gunzip -t backups/redis/redis_latest.rdb.gz

# Verify S3 upload
aws s3 ls s3://your-backup-bucket/hastecrm-backups/
```

## Monitoring

### Backup Status

Check recent backup status:

```bash
# View backup logs
tail -f logs/backup.log

# Check backup directory
ls -la backups/postgres/ | tail -10
ls -la backups/redis/ | tail -10

# Check S3 backups
aws s3 ls s3://your-backup-bucket/hastecrm-backups/ --recursive | tail -20
```

### Alerts

Configure alerts for backup failures:

1. **CloudWatch Alarms**: Monitor S3 upload failures
2. **Email Notifications**: Send alerts on backup errors
3. **Slack Integration**: Post to Slack channel

## Disaster Recovery Plan

### RTO and RPO Targets

- **Recovery Time Objective (RTO)**: < 1 hour
- **Recovery Point Objective (RPO)**: < 24 hours

### Recovery Scenarios

#### 1. Database Corruption

```bash
# Stop application
docker-compose down

# Drop corrupted database
docker exec -it crm-postgres psql -U postgres -c "DROP DATABASE crm_dev;"
docker exec -it crm-postgres psql -U postgres -c "CREATE DATABASE crm_dev;"

# Restore from backup
./scripts/restore-postgres.sh

# Start application
docker-compose up -d
```

#### 2. Complete System Failure

```bash
# On new system
git clone https://github.com/your-org/hasteCRM.git
cd hasteCRM

# Set up environment
cp .env.example .env
# Edit .env with production values

# Restore databases
./scripts/restore-all.sh

# Start application
docker-compose up -d
```

#### 3. Data Center Failure

1. Launch new infrastructure in different region
2. Download backups from S3
3. Follow complete system recovery procedure
4. Update DNS to point to new infrastructure

## Best Practices

### Backup Schedule

- **Daily**: Automated at 2:00 AM local time
- **Weekly**: Full backup with verification
- **Monthly**: Archive to Glacier storage

### Retention Policy

- **Local**: 7 days (auto-cleanup)
- **S3 Standard**: 30 days
- **S3 IA**: 90 days
- **S3 Glacier**: 365 days

### Security

1. **Encryption at Rest**: Enable S3 bucket encryption
2. **Encryption in Transit**: Use SSL/TLS for S3 uploads
3. **Access Control**: Restrict S3 bucket access with IAM
4. **Audit Logging**: Enable S3 access logging

### Testing

1. **Monthly Recovery Test**: Restore to staging environment
2. **Quarterly DR Drill**: Full disaster recovery simulation
3. **Annual Review**: Update procedures and documentation

## Troubleshooting

### Common Issues

#### Backup Fails with "Permission Denied"

```bash
# Fix permissions
chmod +x scripts/backup/*.sh
chmod +x scripts/run-backup.sh
```

#### S3 Upload Fails

```bash
# Check AWS credentials
aws sts get-caller-identity

# Test S3 access
aws s3 ls s3://your-backup-bucket/
```

#### Insufficient Disk Space

```bash
# Check disk usage
df -h

# Clean old backups
find backups/ -name "*.gz" -mtime +7 -delete
```

#### Restore Fails

```bash
# Check PostgreSQL connection
docker exec -it crm-postgres psql -U postgres -c "\l"

# Check Redis connection
docker exec -it crm-redis redis-cli ping
```

## Advanced Topics

### Incremental Backups

For large databases, consider WAL archiving:

```bash
# postgresql.conf
archive_mode = on
archive_command = 'aws s3 cp %p s3://bucket/wal/%f'
```

### Continuous Replication

Set up streaming replication for zero data loss:

```bash
# Primary server
wal_level = replica
max_wal_senders = 3
```

### Backup Encryption

Encrypt backups before uploading:

```bash
# Encrypt with GPG
gpg --encrypt --recipient backup@example.com backup.sql.gz
```

## Scripts Reference

- `scripts/run-backup.sh` - Main backup orchestration
- `scripts/backup/postgres-backup.sh` - PostgreSQL backup
- `scripts/backup/redis-backup.sh` - Redis backup
- `scripts/backup/s3-sync.sh` - S3 synchronization
- `scripts/backup/backup-cron.sh` - Cron job setup
