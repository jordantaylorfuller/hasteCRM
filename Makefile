# hasteCRM Development Makefile
# Quick commands: just type 'make' to see all options

.PHONY: help start stop restart status logs test build clean setup check db-studio db-reset mail psql redis

# Default - show help
help:
	@echo "🚀 hasteCRM Quick Commands"
	@echo ""
	@echo "Setup & Start:"
	@echo "  make setup      - Run initial setup wizard"
	@echo "  make start      - Start all services"
	@echo "  make stop       - Stop all services"
	@echo "  make restart    - Restart all services"
	@echo ""
	@echo "Development:"
	@echo "  make dev        - Start development (alias for start)"
	@echo "  make status     - Check system status"
	@echo "  make logs       - Show all logs"
	@echo "  make test       - Run tests"
	@echo "  make build      - Build all packages"
	@echo "  make clean      - Clean build artifacts"
	@echo ""
	@echo "Database:"
	@echo "  make db         - Open Prisma Studio"
	@echo "  make db-reset   - Reset database (WARNING: deletes data)"
	@echo "  make psql       - Connect to PostgreSQL"
	@echo "  make redis      - Connect to Redis CLI"
	@echo ""
	@echo "Utilities:"
	@echo "  make mail       - Open Mailhog UI"
	@echo "  make check      - Validate setup"
	@echo "  make fix        - Auto-fix common issues"

# Setup
setup:
	@./setup-wizard.sh

# Start everything
start:
	@./scripts/dev.sh start

# Alias for start
dev: start

# Stop everything
stop:
	@./scripts/dev.sh stop

# Restart everything
restart:
	@./scripts/dev.sh restart

# Check status
status:
	@./scripts/dev.sh status

# Show logs
logs:
	@./scripts/dev.sh logs all

# Run tests
test:
	@pnpm test

# Build all
build:
	@pnpm build

# Clean artifacts
clean:
	@./scripts/dev.sh clean

# Validation check
check:
	@node scripts/check-setup.js

# Database studio
db:
	@./scripts/dev.sh db:studio

db-studio: db

# Reset database
db-reset:
	@./scripts/dev.sh db:reset

# Open Mailhog
mail:
	@./scripts/dev.sh mail

# PostgreSQL CLI
psql:
	@./scripts/dev.sh psql

# Redis CLI
redis:
	@./scripts/dev.sh redis-cli

# Auto-fix common issues
fix:
	@echo "🔧 Auto-fixing common issues..."
	@# Kill processes on common ports
	@npx kill-port 3000 4000 5432 6379 8025 2>/dev/null || true
	@# Ensure Docker is running
	@docker info > /dev/null 2>&1 || (echo "Starting Docker..." && open -a Docker && sleep 10)
	@# Clean and reinstall if needed
	@[ -d "node_modules" ] || pnpm install
	@# Ensure .env exists
	@[ -f ".env" ] || node scripts/setup-env.js
	@# Start services
	@docker-compose up -d
	@echo "✅ Common issues fixed. Try 'make start' now."

# Quick reset (careful!)
reset:
	@echo "⚠️  This will reset everything to a clean state!"
	@echo "Press Ctrl+C to cancel, or Enter to continue..."
	@read confirm
	@make stop
	@make clean
	@docker-compose down -v
	@rm -rf node_modules .env
	@make setup