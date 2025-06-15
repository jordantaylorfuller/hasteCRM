#!/bin/sh

# Redis Backup Script
# This script creates a backup of the Redis database

set -e

# Configuration
REDIS_HOST="${REDIS_HOST:-redis}"
REDIS_PORT="${REDIS_PORT:-6379}"
BACKUP_DIR="/backups/redis"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/redis_${DATE}.rdb"

# Create backup directory
mkdir -p ${BACKUP_DIR}

echo "[$(date)] Starting Redis backup..."

# Check if Redis is running
if ! redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} ping > /dev/null 2>&1; then
    echo "[$(date)] ERROR: Redis is not responding!"
    exit 1
fi

# Trigger BGSAVE
echo "[$(date)] Triggering Redis BGSAVE..."
redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} BGSAVE

# Wait for BGSAVE to complete
echo "[$(date)] Waiting for BGSAVE to complete..."
while [ $(redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} LASTSAVE) -eq $(redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} LASTSAVE) ]; do
    sleep 1
done

# Copy the dump file
echo "[$(date)] Copying Redis dump file..."
cp /data/dump.rdb ${BACKUP_FILE}

# Compress the backup
echo "[$(date)] Compressing backup..."
gzip ${BACKUP_FILE}
BACKUP_FILE="${BACKUP_FILE}.gz"

# Check if backup was successful
if [ -f ${BACKUP_FILE} ]; then
    BACKUP_SIZE=$(ls -lh ${BACKUP_FILE} | awk '{print $5}')
    echo "[$(date)] Backup completed successfully. Size: ${BACKUP_SIZE}"
    
    # Create a latest symlink
    ln -sf ${BACKUP_FILE} ${BACKUP_DIR}/redis_latest.rdb.gz
    
    # Clean up old backups (keep last 7 days)
    find ${BACKUP_DIR} -name "redis_*.rdb.gz" -mtime +7 -delete
    
    echo "[$(date)] Cleanup completed. Kept backups from last 7 days."
else
    echo "[$(date)] ERROR: Backup failed!"
    exit 1
fi

echo "[$(date)] Redis backup process completed."