#!/bin/bash

echo "🔄 hasteCRM Complete System Restore"
echo "=================================="
echo ""

# Configuration
BACKUP_DIR="./backups"
S3_BUCKET="${S3_BACKUP_BUCKET}"
RESTORE_FROM_S3=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --from-s3)
            RESTORE_FROM_S3=true
            shift
            ;;
        --date)
            BACKUP_DATE="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--from-s3] [--date YYYYMMDD]"
            exit 1
            ;;
    esac
done

# Download from S3 if requested
if [ "${RESTORE_FROM_S3}" = true ]; then
    if [ -z "${S3_BUCKET}" ]; then
        echo "❌ S3_BACKUP_BUCKET environment variable not set!"
        exit 1
    fi
    
    echo "☁️  Downloading backups from S3..."
    mkdir -p ${BACKUP_DIR}/postgres ${BACKUP_DIR}/redis
    
    if [ -n "${BACKUP_DATE}" ]; then
        # Download specific date
        echo "📅 Looking for backups from date: ${BACKUP_DATE}"
        aws s3 sync s3://${S3_BUCKET}/hastecrm-backups/ ${BACKUP_DIR}/ \
            --exclude "*" \
            --include "*${BACKUP_DATE}*"
    else
        # Download latest
        echo "📥 Downloading latest backups..."
        aws s3 cp s3://${S3_BUCKET}/hastecrm-backups/postgres/latest.sql.gz \
            ${BACKUP_DIR}/postgres/postgres_latest.sql.gz
        aws s3 cp s3://${S3_BUCKET}/hastecrm-backups/redis/latest.rdb.gz \
            ${BACKUP_DIR}/redis/redis_latest.rdb.gz
    fi
fi

# Check if backups exist
echo ""
echo "🔍 Checking backup files..."

POSTGRES_BACKUP="${BACKUP_DIR}/postgres/postgres_latest.sql.gz"
REDIS_BACKUP="${BACKUP_DIR}/redis/redis_latest.rdb.gz"

if [ ! -f "${POSTGRES_BACKUP}" ]; then
    echo "❌ PostgreSQL backup not found: ${POSTGRES_BACKUP}"
    exit 1
fi

if [ ! -f "${REDIS_BACKUP}" ]; then
    echo "⚠️  Redis backup not found: ${REDIS_BACKUP}"
    echo "   Continuing without Redis restore..."
    SKIP_REDIS=true
fi

echo "✅ Found PostgreSQL backup: $(ls -lh ${POSTGRES_BACKUP} | awk '{print $5}')"
if [ "${SKIP_REDIS}" != true ]; then
    echo "✅ Found Redis backup: $(ls -lh ${REDIS_BACKUP} | awk '{print $5}')"
fi

# Confirm restoration
echo ""
echo "⚠️  WARNING: This will completely replace all data!"
echo "   - PostgreSQL database will be restored"
if [ "${SKIP_REDIS}" != true ]; then
    echo "   - Redis cache will be restored"
fi
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
    echo "❌ Restore cancelled."
    exit 0
fi

# Stop all services
echo ""
echo "🛑 Stopping all services..."
docker-compose down

# Start only database services
echo "🚀 Starting database services..."
docker-compose up -d postgres redis
sleep 10

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
until docker exec crm-postgres pg_isready -U postgres; do
    sleep 2
done

if [ "${SKIP_REDIS}" != true ]; then
    until docker exec crm-redis redis-cli ping > /dev/null 2>&1; do
        sleep 2
    done
fi

# Restore PostgreSQL
echo ""
echo "🐘 Restoring PostgreSQL database..."
docker exec crm-postgres psql -U postgres -c "DROP DATABASE IF EXISTS crm_dev;"
docker exec crm-postgres psql -U postgres -c "CREATE DATABASE crm_dev;"
gunzip -c ${POSTGRES_BACKUP} | docker exec -i crm-postgres psql -U postgres -d crm_dev

if [ $? -ne 0 ]; then
    echo "❌ PostgreSQL restore failed!"
    exit 1
fi
echo "✅ PostgreSQL restored successfully!"

# Restore Redis
if [ "${SKIP_REDIS}" != true ]; then
    echo ""
    echo "🔴 Restoring Redis cache..."
    docker-compose stop redis
    
    # Extract backup to Redis data directory
    docker run --rm -v crm_redis_data:/data -v $(pwd)/${BACKUP_DIR}/redis:/backup alpine \
        sh -c "gunzip -c /backup/redis_latest.rdb.gz > /data/dump.rdb && chmod 644 /data/dump.rdb"
    
    docker-compose start redis
    sleep 5
    
    if docker exec crm-redis redis-cli ping > /dev/null 2>&1; then
        echo "✅ Redis restored successfully!"
    else
        echo "❌ Redis restore failed!"
    fi
fi

# Run database migrations
echo ""
echo "🔧 Running database migrations..."
docker-compose run --rm api pnpm prisma migrate deploy

# Start all services
echo ""
echo "🚀 Starting all services..."
docker-compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Verify restoration
echo ""
echo "🔍 Verifying restoration..."

# Check PostgreSQL
PG_TABLES=$(docker exec crm-postgres psql -U postgres -d crm_dev -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo "✅ PostgreSQL: ${PG_TABLES} tables found"

# Check Redis
if [ "${SKIP_REDIS}" != true ]; then
    REDIS_KEYS=$(docker exec crm-redis redis-cli DBSIZE | awk '{print $1}')
    echo "✅ Redis: ${REDIS_KEYS} keys found"
fi

# Check API health
echo ""
echo "🏥 Checking API health..."
for i in {1..10}; do
    if curl -s http://localhost:3333/health | grep -q "ok"; then
        echo "✅ API is healthy!"
        break
    fi
    echo "⏳ Waiting for API to be ready... (${i}/10)"
    sleep 3
done

echo ""
echo "✅ System restore completed successfully!"
echo ""
echo "📊 Summary:"
echo "  - PostgreSQL: Restored"
if [ "${SKIP_REDIS}" != true ]; then
    echo "  - Redis: Restored"
else
    echo "  - Redis: Skipped (no backup found)"
fi
echo "  - API: Running"
echo "  - Web: Running"
echo ""
echo "🌐 Access points:"
echo "  - API: http://localhost:3333"
echo "  - GraphQL: http://localhost:3333/graphql"
echo "  - Web: http://localhost:3000"
echo ""
echo "💡 Next steps:"
echo "  1. Verify application functionality"
echo "  2. Check data integrity"
echo "  3. Update DNS if this is a disaster recovery"