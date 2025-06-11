#!/bin/bash

# AI-CRM Platform - Project Initialization Script
# This script sets up the basic project structure based on Phase 1 documentation

set -e

echo "🚀 AI-CRM Platform - Project Initialization"
echo "==========================================="
echo ""

# Check prerequisites
check_prerequisites() {
    echo "📋 Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    # Check pnpm
    if ! command -v pnpm &> /dev/null; then
        echo "📦 Installing pnpm..."
        npm install -g pnpm@8
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo "⚠️  Docker is not installed. You'll need it for local development."
    fi
    
    echo "✅ Prerequisites checked"
    echo ""
}

# Initialize monorepo
init_monorepo() {
    echo "📁 Initializing monorepo structure..."
    
    # Create root package.json
    cat > package.json << 'EOF'
{
  "name": "hasteCRM",
  "version": "0.0.1",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "format": "prettier --write \"**/*.{ts,tsx,md,json}\"",
    "prepare": "husky install"
  },
  "devDependencies": {
    "turbo": "latest",
    "prettier": "^3.1.0",
    "husky": "^8.0.3",
    "lint-staged": "^15.0.0"
  },
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=8.0.0"
  }
}
EOF

    # Create turbo.json
    cat > turbo.json << 'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    },
    "dev": {
      "cache": false
    }
  }
}
EOF

    # Create .gitignore
    cat > .gitignore << 'EOF'
# Dependencies
node_modules
.pnp
.pnp.js

# Testing
coverage
.nyc_output

# Next.js
.next/
out/
build

# Production
dist

# Misc
.DS_Store
*.pem

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# Local env files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Turbo
.turbo

# Vercel
.vercel

# Typescript
*.tsbuildinfo
EOF

    echo "✅ Monorepo initialized"
    echo ""
}

# Create directory structure
create_structure() {
    echo "🏗️  Creating project structure..."
    
    # Create directories
    mkdir -p apps/web
    mkdir -p apps/api
    mkdir -p apps/worker
    mkdir -p packages/database
    mkdir -p packages/ui
    mkdir -p packages/types
    mkdir -p packages/utils
    mkdir -p infrastructure/docker
    mkdir -p infrastructure/kubernetes
    
    echo "✅ Directory structure created"
    echo ""
}

# Initialize web app
init_web_app() {
    echo "🌐 Initializing web application..."
    
    cd apps/web
    
    cat > package.json << 'EOF'
{
  "name": "@ai-crm/web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "jest"
  },
  "dependencies": {
    "next": "14.0.4",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.3.0",
    "tailwindcss": "^3.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
EOF

    # Create basic Next.js structure
    mkdir -p src/app
    
    cat > src/app/page.tsx << 'EOF'
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">AI-CRM Platform</h1>
      <p className="mt-4 text-lg">Implementation starting soon...</p>
    </main>
  )
}
EOF

    cd ../..
    echo "✅ Web application initialized"
    echo ""
}

# Initialize API
init_api() {
    echo "🔌 Initializing API service..."
    
    cd apps/api
    
    cat > package.json << 'EOF'
{
  "name": "@ai-crm/api",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main",
    "lint": "eslint \"{src,apps,libs,test}/**/*.ts\"",
    "test": "jest"
  },
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/graphql": "^12.0.0",
    "@nestjs/apollo": "^12.0.0",
    "@apollo/server": "^4.9.0",
    "graphql": "^16.8.0",
    "reflect-metadata": "^0.1.13",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.0.0",
    "@nestjs/schematics": "^10.0.0",
    "@nestjs/testing": "^10.0.0",
    "@types/express": "^4.17.17",
    "@types/jest": "^29.5.2",
    "@types/node": "^20.3.1",
    "@typescript-eslint/eslint-plugin": "^5.59.11",
    "@typescript-eslint/parser": "^5.59.11",
    "eslint": "^8.42.0",
    "jest": "^29.5.0",
    "ts-jest": "^29.1.0",
    "ts-loader": "^9.4.3",
    "ts-node": "^10.9.1",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.1.3"
  }
}
EOF

    mkdir -p src
    
    cat > src/main.ts << 'EOF'
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(4000);
  console.log('🚀 API running on http://localhost:4000');
}
bootstrap();
EOF

    cat > src/app.module.ts << 'EOF'
import { Module } from '@nestjs/common';

@Module({
  imports: [],
  controllers: [],
  providers: [],
})
export class AppModule {}
EOF

    cd ../..
    echo "✅ API service initialized"
    echo ""
}

# Initialize database package
init_database() {
    echo "🗄️  Initializing database package..."
    
    cd packages/database
    
    cat > package.json << 'EOF'
{
  "name": "@ai-crm/database",
  "version": "0.0.1",
  "main": "./index.ts",
  "types": "./index.ts",
  "scripts": {
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "@prisma/client": "^5.7.0"
  },
  "devDependencies": {
    "prisma": "^5.7.0"
  }
}
EOF

    # Initialize Prisma
    npx prisma init --skip-generate

    cd ../..
    echo "✅ Database package initialized"
    echo ""
}

# Create Docker setup
create_docker_setup() {
    echo "🐳 Creating Docker configuration..."
    
    cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: crm-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: crm_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: crm-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  mailhog:
    image: mailhog/mailhog
    container_name: crm-mailhog
    ports:
      - "1025:1025"  # SMTP
      - "8025:8025"  # Web UI

volumes:
  postgres_data:
  redis_data:
EOF

    echo "✅ Docker configuration created"
    echo ""
}

# Create environment files
create_env_files() {
    echo "🔐 Creating environment files..."
    
    cat > .env.example << 'EOF'
# Application
NODE_ENV=development
APP_NAME=AI-CRM Platform

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/crm_dev

# Redis
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=change-me-in-production-min-32-chars
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Google OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# AI Services
ANTHROPIC_API_KEY=
OPENAI_API_KEY=

# Email (development)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
EOF

    cp .env.example .env
    
    echo "✅ Environment files created"
    echo ""
}

# Install dependencies
install_dependencies() {
    echo "📦 Installing dependencies..."
    pnpm install
    echo "✅ Dependencies installed"
    echo ""
}

# Setup Git hooks
setup_git_hooks() {
    echo "🪝 Setting up Git hooks..."
    
    # Create .husky directory
    npx husky install
    
    # Add pre-commit hook
    npx husky add .husky/pre-commit "pnpm lint-staged"
    
    # Create lint-staged config
    cat > .lintstagedrc.json << 'EOF'
{
  "*.{js,jsx,ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,yml,yaml}": ["prettier --write"]
}
EOF

    echo "✅ Git hooks configured"
    echo ""
}

# Main execution
main() {
    check_prerequisites
    init_monorepo
    create_structure
    init_web_app
    init_api
    init_database
    create_docker_setup
    create_env_files
    install_dependencies
    setup_git_hooks
    
    echo "🎉 Project initialization complete!"
    echo ""
    echo "📝 Next steps:"
    echo "1. Review and update .env file with your API keys"
    echo "2. Start Docker services: docker-compose up -d"
    echo "3. Run database migrations: cd packages/database && pnpm db:migrate"
    echo "4. Start development: pnpm dev"
    echo ""
    echo "📚 Documentation: ./docs/"
    echo "📊 Implementation status: ./IMPLEMENTATION_STATUS.md"
    echo ""
    echo "Happy coding! 🚀"
}

# Run main function
main