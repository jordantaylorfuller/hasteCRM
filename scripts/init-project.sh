#!/bin/bash

# hasteCRM Project Initialization Script
# This script sets up the complete development environment

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if running from project root
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the project root directory"
    exit 1
fi

print_status "Starting hasteCRM project initialization..."

# 1. Check Node.js version
print_status "Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d 'v' -f 2)
REQUIRED_NODE="18.19.0"

if [ "$(printf '%s\n' "$REQUIRED_NODE" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_NODE" ]; then
    print_error "Node.js version $REQUIRED_NODE or higher is required. Current version: $NODE_VERSION"
    exit 1
fi
print_success "Node.js version check passed"

# 2. Check pnpm installation
print_status "Checking pnpm installation..."
if ! command -v pnpm &> /dev/null; then
    print_warning "pnpm not found. Installing pnpm..."
    npm install -g pnpm@8.14.0
fi
print_success "pnpm is installed"

# 3. Install dependencies
print_status "Installing project dependencies..."
pnpm install --frozen-lockfile
print_success "Dependencies installed"

# 4. Copy environment file
print_status "Setting up environment configuration..."
if [ ! -f ".env" ]; then
    cp .env.example .env
    print_warning "Created .env file from .env.example - Please update with your actual values"
else
    print_warning ".env file already exists - skipping"
fi

# 5. Check Docker installation
print_status "Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker Desktop from https://www.docker.com/products/docker-desktop"
    exit 1
fi

if ! docker info &> /dev/null; then
    print_error "Docker daemon is not running. Please start Docker Desktop"
    exit 1
fi
print_success "Docker is installed and running"

# 6. Check Docker Compose installation
print_status "Checking Docker Compose installation..."
if ! command -v docker-compose &> /dev/null; then
    print_warning "docker-compose command not found, checking docker compose..."
    if ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi
print_success "Docker Compose is installed"

# 7. Start local services
print_status "Starting local development services..."
$COMPOSE_CMD up -d postgres redis
print_status "Waiting for services to be healthy..."
sleep 10

# Wait for PostgreSQL to be ready
until docker exec hasteCRM-postgres pg_isready -U postgres > /dev/null 2>&1; do
    print_status "Waiting for PostgreSQL to be ready..."
    sleep 2
done
print_success "PostgreSQL is ready"

# Wait for Redis to be ready
until docker exec hasteCRM-redis redis-cli ping > /dev/null 2>&1; do
    print_status "Waiting for Redis to be ready..."
    sleep 2
done
print_success "Redis is ready"

# 8. Run database migrations
print_status "Running database migrations..."
pnpm -F database prisma generate
pnpm -F database prisma migrate deploy
print_success "Database migrations completed"

# 9. Seed initial data (optional)
read -p "Do you want to seed the database with sample data? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Seeding database..."
    pnpm -F database prisma db seed
    print_success "Database seeded"
fi

# 10. Build packages
print_status "Building shared packages..."
pnpm build:packages
print_success "Packages built"

# 11. Type checking
print_status "Running type checks..."
if pnpm typecheck; then
    print_success "Type checking passed"
else
    print_warning "Type checking failed - please fix type errors"
fi

# 12. Linting
print_status "Running linters..."
if pnpm lint; then
    print_success "Linting passed"
else
    print_warning "Linting failed - please fix linting errors"
fi

# 13. Git hooks setup
print_status "Setting up Git hooks..."
pnpm prepare
print_success "Git hooks configured"

# 14. Create necessary directories
print_status "Creating necessary directories..."
mkdir -p logs
mkdir -p uploads
mkdir -p tmp
print_success "Directories created"

# 15. Google Cloud setup reminder
print_warning "Don't forget to set up Google Cloud credentials:"
echo "  1. Create a Google Cloud project"
echo "  2. Enable Gmail API"
echo "  3. Create OAuth 2.0 credentials"
echo "  4. Download service account key"
echo "  5. Update .env with your Google Cloud settings"

# 16. API keys reminder
print_warning "Remember to add your API keys to .env:"
echo "  - ANTHROPIC_API_KEY"
echo "  - OPENAI_API_KEY (optional)"
echo "  - SENDGRID_API_KEY"
echo "  - SENTRY_DSN (optional)"

print_success "Project initialization complete!"
echo
echo "Next steps:"
echo "  1. Update .env with your configuration"
echo "  2. Run 'pnpm dev' to start the development servers"
echo "  3. Visit http://localhost:3000 for the web app"
echo "  4. Visit http://localhost:4000/graphql for the API playground"
echo
echo "For more information, see docs/development/setup.md"