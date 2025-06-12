#!/bin/bash

# hasteCRM Development Helper Script
# Quick commands for common development tasks

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Help function
show_help() {
    echo "🚀 hasteCRM Development Helper"
    echo ""
    echo "Usage: ./scripts/dev.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start       - Start all services (Docker + Apps)"
    echo "  stop        - Stop all services"
    echo "  restart     - Restart all services"
    echo "  status      - Check system status"
    echo "  logs [app]  - Show logs (api/web/db/redis/all)"
    echo "  db:studio   - Open Prisma Studio"
    echo "  db:reset    - Reset database (WARNING: deletes data)"
    echo "  test        - Run all tests"
    echo "  build       - Build all packages"
    echo "  clean       - Clean all build artifacts"
    echo "  setup       - Run initial setup"
    echo "  check       - Run setup validation"
    echo "  mail        - Open Mailhog UI"
    echo "  psql        - Connect to PostgreSQL"
    echo "  redis-cli   - Connect to Redis"
    echo ""
}

# Check if Docker is running
check_docker() {
    if ! docker info &> /dev/null; then
        echo -e "${RED}Docker is not running. Please start Docker Desktop.${NC}"
        exit 1
    fi
}

# Main command handler
case "$1" in
    "start")
        echo -e "${BLUE}Starting hasteCRM...${NC}"
        check_docker
        docker-compose up -d
        echo -e "${GREEN}✓ Docker services started${NC}"
        pnpm run dev
        ;;
        
    "stop")
        echo -e "${BLUE}Stopping hasteCRM...${NC}"
        # Kill Node processes
        pkill -f "node" || true
        # Stop Docker
        docker-compose down
        echo -e "${GREEN}✓ All services stopped${NC}"
        ;;
        
    "restart")
        echo -e "${BLUE}Restarting hasteCRM...${NC}"
        $0 stop
        sleep 2
        $0 start
        ;;
        
    "status")
        echo -e "${BLUE}System Status:${NC}"
        echo ""
        # Check Node
        if command -v node &> /dev/null; then
            echo -e "${GREEN}✓ Node.js:${NC} $(node -v)"
        else
            echo -e "${RED}✗ Node.js: Not installed${NC}"
        fi
        
        # Check pnpm
        if command -v pnpm &> /dev/null; then
            echo -e "${GREEN}✓ pnpm:${NC} v$(pnpm -v)"
        else
            echo -e "${RED}✗ pnpm: Not installed${NC}"
        fi
        
        # Check Docker
        if docker info &> /dev/null; then
            echo -e "${GREEN}✓ Docker:${NC} Running"
            
            # Check containers
            echo ""
            echo "Containers:"
            docker ps --format "table {{.Names}}\t{{.Status}}" | grep hastecrm || echo "No hasteCRM containers running"
        else
            echo -e "${RED}✗ Docker: Not running${NC}"
        fi
        
        # Check ports
        echo ""
        echo "Port Status:"
        for port in 3000 4000 5432 6379 8025; do
            if lsof -i :$port &> /dev/null; then
                echo -e "${GREEN}✓ Port $port:${NC} In use"
            else
                echo -e "${YELLOW}○ Port $port:${NC} Available"
            fi
        done
        ;;
        
    "logs")
        case "$2" in
            "api")
                docker logs -f hastecrm-api 2>&1 | sed 's/^/[API] /'
                ;;
            "web")
                # Next.js logs are in the terminal running pnpm dev
                echo "Web logs are shown in the terminal running 'pnpm dev'"
                ;;
            "db"|"postgres")
                docker logs -f hastecrm-postgres 2>&1 | sed 's/^/[DB] /'
                ;;
            "redis")
                docker logs -f hastecrm-redis 2>&1 | sed 's/^/[REDIS] /'
                ;;
            "mail"|"mailhog")
                docker logs -f hastecrm-mailhog 2>&1 | sed 's/^/[MAIL] /'
                ;;
            *)
                echo "Showing all container logs..."
                docker-compose logs -f
                ;;
        esac
        ;;
        
    "db:studio")
        echo -e "${BLUE}Opening Prisma Studio...${NC}"
        cd packages/database && pnpm run db:studio
        ;;
        
    "db:reset")
        echo -e "${YELLOW}⚠️  This will delete all data in the database!${NC}"
        read -p "Are you sure? (y/N): " confirm
        if [ "$confirm" = "y" ]; then
            echo -e "${BLUE}Resetting database...${NC}"
            pnpm run db:push --force-reset
            echo -e "${GREEN}✓ Database reset complete${NC}"
        else
            echo "Cancelled"
        fi
        ;;
        
    "test")
        echo -e "${BLUE}Running tests...${NC}"
        pnpm test
        ;;
        
    "build")
        echo -e "${BLUE}Building all packages...${NC}"
        pnpm build
        ;;
        
    "clean")
        echo -e "${BLUE}Cleaning build artifacts...${NC}"
        pnpm clean
        rm -rf .turbo
        echo -e "${GREEN}✓ Clean complete${NC}"
        ;;
        
    "setup")
        echo -e "${BLUE}Running setup...${NC}"
        ./setup-wizard.sh
        ;;
        
    "check")
        node scripts/check-setup.js
        ;;
        
    "mail")
        echo -e "${BLUE}Opening Mailhog...${NC}"
        open http://localhost:8025 || xdg-open http://localhost:8025 || echo "Visit http://localhost:8025"
        ;;
        
    "psql")
        echo -e "${BLUE}Connecting to PostgreSQL...${NC}"
        docker exec -it hastecrm-postgres psql -U postgres -d hastecrm_dev
        ;;
        
    "redis-cli")
        echo -e "${BLUE}Connecting to Redis...${NC}"
        docker exec -it hastecrm-redis redis-cli
        ;;
        
    *)
        show_help
        ;;
esac