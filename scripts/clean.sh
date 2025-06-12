#!/bin/bash

# hasteCRM Clean Script
# Removes all generated files and dependencies

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_status "Starting hasteCRM cleanup..."

# Confirm before proceeding
read -p "This will remove all node_modules, build artifacts, and cache. Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Cleanup cancelled"
    exit 0
fi

# Stop Docker containers
if command -v docker &> /dev/null && docker info &> /dev/null 2>&1; then
    print_status "Stopping Docker containers..."
    docker-compose down || docker compose down || true
fi

# Remove node_modules
print_status "Removing node_modules..."
find . -name "node_modules" -type d -prune -exec rm -rf '{}' + 2>/dev/null || true

# Remove build artifacts
print_status "Removing build artifacts..."
find . -name "dist" -type d -prune -exec rm -rf '{}' + 2>/dev/null || true
find . -name ".next" -type d -prune -exec rm -rf '{}' + 2>/dev/null || true
find . -name "build" -type d -prune -exec rm -rf '{}' + 2>/dev/null || true
find . -name ".turbo" -type d -prune -exec rm -rf '{}' + 2>/dev/null || true

# Remove cache directories
print_status "Removing cache directories..."
rm -rf .parcel-cache 2>/dev/null || true
rm -rf .cache 2>/dev/null || true

# Remove lock files
print_status "Removing lock files..."
rm -f pnpm-lock.yaml 2>/dev/null || true
rm -f package-lock.json 2>/dev/null || true
rm -f yarn.lock 2>/dev/null || true

# Remove logs
print_status "Removing logs..."
rm -rf logs/* 2>/dev/null || true
find . -name "*.log" -type f -delete 2>/dev/null || true

# Remove temporary files
print_status "Removing temporary files..."
rm -rf tmp/* 2>/dev/null || true
rm -rf uploads/* 2>/dev/null || true

# Remove test coverage
print_status "Removing test coverage reports..."
find . -name "coverage" -type d -prune -exec rm -rf '{}' + 2>/dev/null || true
find . -name ".nyc_output" -type d -prune -exec rm -rf '{}' + 2>/dev/null || true

# Remove environment files (optional)
read -p "Remove .env files? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Removing .env files..."
    find . -name ".env*" -not -name ".env.example" -type f -delete 2>/dev/null || true
fi

# Remove database volumes (optional)
read -p "Remove Docker volumes (database data will be lost)? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v docker &> /dev/null && docker info &> /dev/null 2>&1; then
        print_status "Removing Docker volumes..."
        docker volume prune -f
    fi
fi

print_success "Cleanup complete!"
echo
echo "To reinstall:"
echo "  1. Run './scripts/init-project.sh'"
echo "  2. Or manually: 'pnpm install'"