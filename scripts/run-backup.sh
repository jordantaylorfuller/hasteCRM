#!/bin/bash

echo "🔄 Starting hasteCRM Backup Process..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check required environment variables for S3
if [ -z "${AWS_ACCESS_KEY_ID}" ] || [ -z "${AWS_SECRET_ACCESS_KEY}" ] || [ -z "${S3_BACKUP_BUCKET}" ]; then
    echo "⚠️  WARNING: AWS credentials or S3 bucket not configured."
    echo "   Backups will be created locally but not synced to S3."
    echo ""
    echo "   To enable S3 sync, set these environment variables:"
    echo "   - AWS_ACCESS_KEY_ID"
    echo "   - AWS_SECRET_ACCESS_KEY"
    echo "   - S3_BACKUP_BUCKET"
    echo ""
    SKIP_S3="true"
fi

# Create backup directories
mkdir -p backups/postgres backups/redis

echo "📦 Running database backups..."

# Run PostgreSQL backup
echo "🐘 Backing up PostgreSQL..."
docker-compose -f docker-compose.backup.yml run --rm postgres-backup

# Run Redis backup
echo "🔴 Backing up Redis..."
docker-compose -f docker-compose.backup.yml run --rm redis-backup

# Sync to S3 if configured
if [ "${SKIP_S3}" != "true" ]; then
    echo "☁️  Syncing backups to S3..."
    docker-compose -f docker-compose.backup.yml run --rm s3-sync
else
    echo "⏭️  Skipping S3 sync (credentials not configured)"
fi

echo ""
echo "✅ Backup process completed!"
echo ""
echo "📁 Local backups stored in:"
echo "   - PostgreSQL: ./backups/postgres/"
echo "   - Redis: ./backups/redis/"

if [ "${SKIP_S3}" != "true" ]; then
    echo ""
    echo "☁️  S3 backups stored in:"
    echo "   - Bucket: ${S3_BACKUP_BUCKET}"
    echo "   - Path: hastecrm-backups/"
fi