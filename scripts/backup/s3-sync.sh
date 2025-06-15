#!/bin/bash

# S3 Sync Script
# This script syncs local backups to Amazon S3

set -e

# Configuration
BACKUP_DIR="/backups"
S3_BUCKET="${S3_BUCKET}"
S3_PREFIX="${S3_PREFIX:-hastecrm-backups}"
DATE=$(date +%Y%m%d_%H%M%S)

# Check if S3 bucket is configured
if [ -z "${S3_BUCKET}" ]; then
    echo "[$(date)] ERROR: S3_BUCKET environment variable is not set!"
    exit 1
fi

echo "[$(date)] Starting S3 sync..."

# Check AWS credentials
if ! aws s3 ls s3://${S3_BUCKET} > /dev/null 2>&1; then
    echo "[$(date)] ERROR: Unable to access S3 bucket. Check AWS credentials and bucket permissions."
    exit 1
fi

# Sync PostgreSQL backups
if [ -d "${BACKUP_DIR}/postgres" ]; then
    echo "[$(date)] Syncing PostgreSQL backups..."
    aws s3 sync ${BACKUP_DIR}/postgres/ s3://${S3_BUCKET}/${S3_PREFIX}/postgres/ \
        --exclude "*.tmp" \
        --storage-class STANDARD_IA
    
    # Upload latest backup with metadata
    if [ -f "${BACKUP_DIR}/postgres/postgres_latest.sql.gz" ]; then
        aws s3 cp ${BACKUP_DIR}/postgres/postgres_latest.sql.gz \
            s3://${S3_BUCKET}/${S3_PREFIX}/postgres/latest.sql.gz \
            --metadata "backup-date=${DATE}"
    fi
fi

# Sync Redis backups
if [ -d "${BACKUP_DIR}/redis" ]; then
    echo "[$(date)] Syncing Redis backups..."
    aws s3 sync ${BACKUP_DIR}/redis/ s3://${S3_BUCKET}/${S3_PREFIX}/redis/ \
        --exclude "*.tmp" \
        --storage-class STANDARD_IA
    
    # Upload latest backup with metadata
    if [ -f "${BACKUP_DIR}/redis/redis_latest.rdb.gz" ]; then
        aws s3 cp ${BACKUP_DIR}/redis/redis_latest.rdb.gz \
            s3://${S3_BUCKET}/${S3_PREFIX}/redis/latest.rdb.gz \
            --metadata "backup-date=${DATE}"
    fi
fi

# List recent backups
echo "[$(date)] Recent backups in S3:"
aws s3 ls s3://${S3_BUCKET}/${S3_PREFIX}/ --recursive \
    | sort -r | head -20

# Apply lifecycle policy (optional - can be done via AWS Console)
echo "[$(date)] S3 sync completed successfully."

# Create backup manifest
cat > /tmp/backup-manifest.json <<EOF
{
  "timestamp": "${DATE}",
  "bucket": "${S3_BUCKET}",
  "prefix": "${S3_PREFIX}",
  "status": "success",
  "backups": {
    "postgres": $(ls -la ${BACKUP_DIR}/postgres/ 2>/dev/null | wc -l || echo 0),
    "redis": $(ls -la ${BACKUP_DIR}/redis/ 2>/dev/null | wc -l || echo 0)
  }
}
EOF

# Upload manifest
aws s3 cp /tmp/backup-manifest.json \
    s3://${S3_BUCKET}/${S3_PREFIX}/manifests/backup-${DATE}.json

echo "[$(date)] Backup manifest uploaded."