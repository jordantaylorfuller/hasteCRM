#!/bin/bash
# hasteCRM Production Deployment Script

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.production.yml"
ENV_FILE=".env.production"
BACKUP_DIR="./backups"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check environment file
    if [ ! -f "$ENV_FILE" ]; then
        log_error "Environment file $ENV_FILE not found"
        log_info "Copy .env.production.example to .env.production and configure it"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

backup_database() {
    log_info "Creating database backup..."
    
    mkdir -p "$BACKUP_DIR"
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/hasteCRM_backup_$TIMESTAMP.sql"
    
    docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U postgres hasteCRM > "$BACKUP_FILE" 2>/dev/null || {
        log_warn "No existing database to backup (this is normal for first deployment)"
        return 0
    }
    
    if [ -f "$BACKUP_FILE" ]; then
        gzip "$BACKUP_FILE"
        log_info "Database backed up to $BACKUP_FILE.gz"
    fi
}

pull_latest_images() {
    log_info "Pulling latest images..."
    docker-compose -f "$COMPOSE_FILE" pull
}

build_images() {
    log_info "Building application images..."
    docker-compose -f "$COMPOSE_FILE" build --no-cache
}

run_migrations() {
    log_info "Running database migrations..."
    
    # Start only postgres and redis for migrations
    docker-compose -f "$COMPOSE_FILE" up -d postgres redis
    
    # Wait for postgres to be ready
    log_info "Waiting for database to be ready..."
    sleep 10
    
    # Run migrations
    docker-compose -f "$COMPOSE_FILE" run --rm api npx prisma migrate deploy
    
    log_info "Migrations completed"
}

deploy_services() {
    log_info "Deploying services..."
    
    # Start all services
    docker-compose -f "$COMPOSE_FILE" up -d
    
    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    sleep 30
    
    # Check health
    check_health
}

check_health() {
    log_info "Checking service health..."
    
    # Check API health
    if curl -f http://localhost:4000/health > /dev/null 2>&1; then
        log_info "API is healthy"
    else
        log_error "API health check failed"
        return 1
    fi
    
    # Check Web health
    if curl -f http://localhost:3000/health.json > /dev/null 2>&1; then
        log_info "Web app is healthy"
    else
        log_error "Web app health check failed"
        return 1
    fi
    
    # Show running containers
    docker-compose -f "$COMPOSE_FILE" ps
}

cleanup_old_images() {
    log_info "Cleaning up old images..."
    docker image prune -f
}

show_logs() {
    log_info "Showing recent logs..."
    docker-compose -f "$COMPOSE_FILE" logs --tail=50
}

# Main deployment flow
main() {
    log_info "Starting hasteCRM deployment..."
    
    check_prerequisites
    
    # Ask for confirmation
    echo -e "${YELLOW}This will deploy hasteCRM to production. Continue? (y/N)${NC}"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        log_info "Deployment cancelled"
        exit 0
    fi
    
    # Deployment steps
    backup_database
    pull_latest_images
    build_images
    run_migrations
    deploy_services
    cleanup_old_images
    
    log_info "Deployment completed successfully!"
    log_info "Access the application at:"
    log_info "  - Web: http://localhost:3000"
    log_info "  - API: http://localhost:4000"
    log_info "  - GraphQL: http://localhost:4000/graphql"
    
    echo -e "${YELLOW}To view logs, run: docker-compose -f $COMPOSE_FILE logs -f${NC}"
}

# Handle different commands
case "${1:-deploy}" in
    deploy)
        main
        ;;
    rollback)
        log_info "Rolling back to previous version..."
        docker-compose -f "$COMPOSE_FILE" down
        # Restore from backup logic here
        ;;
    logs)
        docker-compose -f "$COMPOSE_FILE" logs -f ${2}
        ;;
    status)
        check_health
        ;;
    stop)
        log_info "Stopping services..."
        docker-compose -f "$COMPOSE_FILE" down
        ;;
    restart)
        log_info "Restarting services..."
        docker-compose -f "$COMPOSE_FILE" restart
        ;;
    backup)
        backup_database
        ;;
    *)
        echo "Usage: $0 {deploy|rollback|logs|status|stop|restart|backup}"
        exit 1
        ;;
esac