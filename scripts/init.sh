#!/bin/bash

set -e

echo "🚀 Initializing hasteCRM..."

# Check Node.js version
if ! node -v | grep -q "v18"; then
    echo "❌ Node.js 18+ required"
    exit 1
fi

# Install pnpm if needed
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm@8.14.0
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install --frozen-lockfile

# Setup environment
if [ ! -f ".env" ]; then
    echo "⚙️  Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please update .env with your API keys"
fi

# Start services
echo "🐳 Starting Docker services..."
docker-compose up -d postgres redis

# Wait for PostgreSQL
echo "⏳ Waiting for PostgreSQL..."
until docker exec hasteCRM-postgres pg_isready &>/dev/null; do
    sleep 2
done

# Run migrations
echo "🗄️  Setting up database..."
pnpm -F database prisma generate
pnpm -F database prisma migrate deploy

# Build packages
echo "🔨 Building packages..."
pnpm build:packages

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env with your API keys"
echo "2. Run 'pnpm dev' to start development"
echo "3. Open http://localhost:3000"