#!/bin/bash

# PostgreSQL Backup Script
# This script creates a backup of the PostgreSQL database

set -e

# Configuration
DB_HOST="${POSTGRES_HOST:-postgres}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-crm_dev}"
DB_USER="${POSTGRES_USER:-postgres}"
BACKUP_DIR="/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/postgres_${DB_NAME}_${DATE}.sql.gz"

# Create backup directory
mkdir -p ${BACKUP_DIR}

echo "[$(date)] Starting PostgreSQL backup..."

# Wait for database to be ready
until pg_isready -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER}; do
  echo "Waiting for PostgreSQL to be ready..."
  sleep 2
done

# Create backup with compression
echo "[$(date)] Creating backup: ${BACKUP_FILE}"
pg_dump -h ${DB_HOST} -p ${DB_PORT} -U ${DB_USER} -d ${DB_NAME} \
  --no-owner \
  --clean \
  --if-exists \
  --verbose | gzip > ${BACKUP_FILE}

# Check if backup was successful
if [ -f ${BACKUP_FILE} ]; then
    BACKUP_SIZE=$(ls -lh ${BACKUP_FILE} | awk '{print $5}')
    echo "[$(date)] Backup completed successfully. Size: ${BACKUP_SIZE}"
    
    # Create a latest symlink
    ln -sf ${BACKUP_FILE} ${BACKUP_DIR}/postgres_latest.sql.gz
    
    # Clean up old backups (keep last 7 days)
    find ${BACKUP_DIR} -name "postgres_${DB_NAME}_*.sql.gz" -mtime +7 -delete
    
    echo "[$(date)] Cleanup completed. Kept backups from last 7 days."
else
    echo "[$(date)] ERROR: Backup failed!"
    exit 1
fi

echo "[$(date)] PostgreSQL backup process completed."