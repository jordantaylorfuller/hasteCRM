#!/bin/bash

echo "🔄 PostgreSQL Database Restore Tool"
echo ""

# Configuration
BACKUP_DIR="./backups/postgres"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5433}"
DB_NAME="${POSTGRES_DB:-crm_dev}"
DB_USER="${POSTGRES_USER:-postgres}"

# Check if backup directory exists
if [ ! -d "${BACKUP_DIR}" ]; then
    echo "❌ Backup directory not found: ${BACKUP_DIR}"
    exit 1
fi

# List available backups
echo "📦 Available backups:"
echo ""
ls -la ${BACKUP_DIR}/*.gz 2>/dev/null | tail -10
echo ""

# Check if latest backup exists
if [ ! -f "${BACKUP_DIR}/postgres_latest.sql.gz" ]; then
    echo "❌ No latest backup found!"
    echo "Please specify a backup file or run a backup first."
    exit 1
fi

# Get backup file
if [ -n "$1" ]; then
    BACKUP_FILE="$1"
else
    BACKUP_FILE="${BACKUP_DIR}/postgres_latest.sql.gz"
fi

# Verify backup file exists
if [ ! -f "${BACKUP_FILE}" ]; then
    echo "❌ Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

echo "📄 Selected backup: ${BACKUP_FILE}"
echo "📊 Backup size: $(ls -lh ${BACKUP_FILE} | awk '{print $5}')"
echo "📅 Backup date: $(ls -la ${BACKUP_FILE} | awk '{print $6, $7, $8}')"
echo ""

# Confirm restoration
echo "⚠️  WARNING: This will replace all data in the ${DB_NAME} database!"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
    echo "❌ Restore cancelled."
    exit 0
fi

echo ""
echo "🚀 Starting database restore..."

# Check if database is running
if ! docker-compose ps | grep -q "crm-postgres.*Up"; then
    echo "⚠️  PostgreSQL is not running. Starting it now..."
    docker-compose up -d postgres
    sleep 5
fi

# Create a backup of current database before restore
echo "💾 Creating safety backup of current database..."
SAFETY_BACKUP="./backups/postgres/safety_backup_$(date +%Y%m%d_%H%M%S).sql.gz"
docker exec crm-postgres pg_dump -U ${DB_USER} ${DB_NAME} | gzip > ${SAFETY_BACKUP}
echo "✅ Safety backup created: ${SAFETY_BACKUP}"

# Stop application containers (keep database running)
echo "🛑 Stopping application containers..."
docker-compose stop api web

# Drop existing connections
echo "🔌 Dropping existing database connections..."
docker exec crm-postgres psql -U ${DB_USER} -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();" > /dev/null 2>&1

# Restore the database
echo "📥 Restoring database from backup..."
gunzip -c ${BACKUP_FILE} | docker exec -i crm-postgres psql -U ${DB_USER} -d ${DB_NAME}

if [ $? -eq 0 ]; then
    echo "✅ Database restored successfully!"
    
    # Run any necessary migrations
    echo "🔧 Running database migrations..."
    docker-compose run --rm api pnpm prisma migrate deploy
    
    # Start application containers
    echo "🚀 Starting application containers..."
    docker-compose up -d
    
    echo ""
    echo "✅ Restore completed successfully!"
    echo ""
    echo "📊 Database status:"
    docker exec crm-postgres psql -U ${DB_USER} -d ${DB_NAME} -c "SELECT COUNT(*) as tables FROM information_schema.tables WHERE table_schema = 'public';"
else
    echo "❌ Restore failed!"
    echo ""
    echo "💡 To restore the safety backup, run:"
    echo "   ./scripts/restore-postgres.sh ${SAFETY_BACKUP}"
    exit 1
fi