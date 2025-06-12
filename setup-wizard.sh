#!/bin/bash

# hasteCRM Setup Wizard
# This script will get you from 0 to 100% ready for Claude Code development

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_header() {
    echo -e "\n${BLUE}===================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}===================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if running in correct directory
if [ ! -f "docs/MASTER-CONFIG.md" ]; then
    print_error "Please run this script from the CRM root directory"
    exit 1
fi

# CRITICAL: Check for exposed secrets
if [ -f "secrets.json" ] || [ -f "secrets.JSON" ]; then
    print_error "SECURITY ALERT: Found secrets.json file!"
    print_error "This file contains sensitive API keys and should NEVER be committed."
    echo ""
    print_warning "Please:"
    print_warning "1. Move all secrets to .env file"
    print_warning "2. Delete secrets.json"
    print_warning "3. Read SECURITY-ALERT.md for immediate actions"
    echo ""
    read -p "Have you secured your secrets? (yes/no): " secured
    if [ "$secured" != "yes" ]; then
        print_error "Please secure your secrets before continuing."
        print_info "See docs/SECRETS-MANAGEMENT.md for guidance."
        exit 1
    fi
fi

print_header "🚀 hasteCRM Setup Wizard"
echo "This wizard will set up everything you need for Claude Code development"
echo "Estimated time: 5-10 minutes"
echo ""
read -p "Press Enter to continue..."

# Step 1: Check Prerequisites
print_header "Step 1: Checking Prerequisites"

check_command() {
    if command -v $1 &> /dev/null; then
        print_success "$1 is installed"
        return 0
    else
        print_error "$1 is not installed"
        return 1
    fi
}

MISSING_DEPS=0

# Check Node.js
if check_command node; then
    NODE_VERSION=$(node -v | cut -d'v' -f2)
    REQUIRED_VERSION="18.0.0"
    if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then
        print_success "Node.js version $NODE_VERSION meets requirements"
    else
        print_error "Node.js version $NODE_VERSION is too old (need 18+)"
        MISSING_DEPS=1
    fi
else
    MISSING_DEPS=1
fi

# Check other dependencies
check_command pnpm || MISSING_DEPS=1
check_command docker || MISSING_DEPS=1
check_command git || MISSING_DEPS=1

if [ $MISSING_DEPS -eq 1 ]; then
    print_error "Missing prerequisites. Please install them first:"
    echo ""
    echo "  • Node.js 18+: https://nodejs.org/"
    echo "  • pnpm: npm install -g pnpm"
    echo "  • Docker: https://www.docker.com/get-started"
    echo "  • Git: https://git-scm.com/"
    echo ""
    exit 1
fi

# Check Docker is running
if docker info &> /dev/null; then
    print_success "Docker is running"
else
    print_error "Docker is not running. Please start Docker Desktop."
    exit 1
fi

# Step 2: Create Project Structure
print_header "Step 2: Creating Project Structure"

create_dir() {
    if [ ! -d "$1" ]; then
        mkdir -p "$1"
        print_success "Created $1"
    else
        print_info "$1 already exists"
    fi
}

# Create all necessary directories
create_dir "apps/web"
create_dir "apps/api"
create_dir "apps/workers"
create_dir "packages/database"
create_dir "packages/types"
create_dir "packages/ui"
create_dir "packages/shared"
create_dir "packages/config"
create_dir "scripts"
create_dir "docker"
create_dir ".github/workflows"

# Step 3: Generate Configuration Files
print_header "Step 3: Generating Configuration Files"

# Create root package.json
cat > package.json << 'EOF'
{
  "name": "hastecrm",
  "version": "1.0.0",
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
    "type-check": "turbo run type-check",
    "clean": "turbo run clean && rm -rf node_modules",
    "db:generate": "turbo run db:generate",
    "db:push": "turbo run db:push",
    "db:migrate": "turbo run db:migrate",
    "db:studio": "turbo run db:studio",
    "setup": "pnpm install && pnpm run setup:env && pnpm run setup:db",
    "setup:env": "node scripts/setup-env.js",
    "setup:db": "docker-compose up -d && sleep 5 && pnpm run db:push",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down",
    "docker:reset": "docker-compose down -v && docker-compose up -d"
  },
  "devDependencies": {
    "@types/node": "^18.19.0",
    "turbo": "^1.11.0",
    "typescript": "^5.3.0"
  },
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=8.0.0"
  },
  "packageManager": "pnpm@8.14.0"
}
EOF
print_success "Created package.json"

# Create pnpm-workspace.yaml
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - "apps/*"
  - "packages/*"
EOF
print_success "Created pnpm-workspace.yaml"

# Create turbo.json
cat > turbo.json << 'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"],
      "cache": false
    },
    "lint": {
      "outputs": []
    },
    "type-check": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "clean": {
      "cache": false
    },
    "db:generate": {
      "cache": false
    },
    "db:push": {
      "cache": false
    },
    "db:migrate": {
      "cache": false
    },
    "db:studio": {
      "cache": false,
      "persistent": true
    }
  }
}
EOF
print_success "Created turbo.json"

# Create .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules
.pnp
.pnp.js

# Testing
coverage
*.lcov
.nyc_output

# Next.js
.next/
out/
build
dist

# Misc
.DS_Store
*.pem
.vscode/*
!.vscode/extensions.json
.idea

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# Env files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Turbo
.turbo

# Vercel
.vercel

# TypeScript
*.tsbuildinfo
next-env.d.ts

# Database
*.db
*.db-journal
prisma/migrations/dev

# Uploads
uploads/
temp/
EOF
print_success "Created .gitignore"

# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: hastecrm-postgres
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: hastecrm_dev
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: hastecrm-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  mailhog:
    image: mailhog/mailhog:latest
    container_name: hastecrm-mailhog
    restart: unless-stopped
    ports:
      - "1025:1025" # SMTP server
      - "8025:8025" # Web UI
    environment:
      MH_STORAGE: memory

volumes:
  postgres_data:
  redis_data:
EOF
print_success "Created docker-compose.yml"

# Create .env.example
cat > .env.example << 'EOF'
# Environment
NODE_ENV=development
APP_URL=http://localhost:3000
API_URL=http://localhost:4000

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/hastecrm_dev

# Redis
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=change-me-to-a-random-32-character-string
JWT_ALGORITHM=RS256
JWT_ACCESS_TOKEN_EXPIRES_IN=15m
JWT_REFRESH_TOKEN_EXPIRES_IN=7d
SESSION_SECRET=change-me-to-another-random-32-char-string
ENCRYPTION_KEY=change-me-to-yet-another-random-32-string

# Email (Development - Mailhog)
EMAIL_PROVIDER=smtp
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
FROM_EMAIL=noreply@hastecrm.local
FROM_NAME=hasteCRM

# Google OAuth (Optional for development)
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:4000/auth/google/callback

# AI Services (Use mock in development)
USE_MOCK_AI=true
OPENAI_API_KEY=mock-key-for-development
ANTHROPIC_API_KEY=mock-key-for-development
PERPLEXITY_API_KEY=mock-key-for-development

# File Storage (Local in development)
STORAGE_TYPE=local
STORAGE_LOCAL_PATH=./uploads
STORAGE_PUBLIC_URL=http://localhost:4000/uploads

# Feature Flags
ENABLE_DEBUG_MODE=true
ENABLE_API_DOCS=true
ENABLE_QUERY_LOGGING=true
LOG_LEVEL=debug

# Rate Limiting
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_GRAPHQL_AUTH=1000
RATE_LIMIT_GRAPHQL_UNAUTH=100
RATE_LIMIT_REST_AUTH=500
RATE_LIMIT_REST_UNAUTH=50

# Monitoring (Optional)
SENTRY_DSN=
DATADOG_API_KEY=
EOF
print_success "Created .env.example"

# Create TypeScript config
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "commonjs",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "incremental": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@hastecrm/database": ["./packages/database/src"],
      "@hastecrm/types": ["./packages/types/src"],
      "@hastecrm/ui": ["./packages/ui/src"],
      "@hastecrm/shared": ["./packages/shared/src"],
      "@hastecrm/config": ["./packages/config/src"]
    }
  },
  "exclude": ["node_modules", "dist", ".next", ".turbo"]
}
EOF
print_success "Created tsconfig.json"

# Create ESLint config
cat > .eslintrc.js << 'EOF'
module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  ignorePatterns: ['dist', '.next', 'node_modules', '.turbo'],
};
EOF
print_success "Created .eslintrc.js"

# Create Prettier config
cat > .prettierrc << 'EOF'
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
EOF
print_success "Created .prettierrc"

# Create .nvmrc
cat > .nvmrc << 'EOF'
18.19.0
EOF
print_success "Created .nvmrc"

# Create VS Code settings
create_dir ".vscode"
cat > .vscode/settings.json << 'EOF'
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "files.exclude": {
    "**/.turbo": true,
    "**/dist": true,
    "**/.next": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/.turbo": true,
    "**/dist": true,
    "**/.next": true
  }
}
EOF
print_success "Created VS Code settings"

# Create VS Code extensions recommendations
cat > .vscode/extensions.json << 'EOF'
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "prisma.prisma",
    "bradlc.vscode-tailwindcss",
    "ms-azuretools.vscode-docker",
    "GitHub.copilot",
    "usernamehw.errorlens",
    "mikestead.dotenv"
  ]
}
EOF
print_success "Created VS Code extensions recommendations"

# Step 4: Create Initial Package Files
print_header "Step 4: Creating Package Structure"

# Create database package
cat > packages/database/package.json << 'EOF'
{
  "name": "@hastecrm/database",
  "version": "1.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio",
    "build": "tsc",
    "clean": "rm -rf dist .turbo"
  },
  "dependencies": {
    "@prisma/client": "^5.7.0"
  },
  "devDependencies": {
    "prisma": "^5.7.0",
    "typescript": "^5.3.0"
  }
}
EOF
print_success "Created packages/database/package.json"

# Create Prisma schema
create_dir "packages/database/prisma"
cat > packages/database/prisma/schema.prisma << 'EOF'
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Workspace {
  id        String   @id @default(uuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  users     User[]
}

model User {
  id            String    @id @default(uuid())
  email         String    @unique
  passwordHash  String?
  firstName     String?
  lastName      String?
  emailVerified Boolean   @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  workspaceId   String
  workspace     Workspace @relation(fields: [workspaceId], references: [id])
}
EOF
print_success "Created Prisma schema"

# Create database index file
create_dir "packages/database/src"
cat > packages/database/src/index.ts << 'EOF'
export * from '@prisma/client';
export { PrismaClient } from '@prisma/client';

// Re-export Prisma types for convenience
export type { Prisma } from '@prisma/client';
EOF
print_success "Created database index"

# Create types package
cat > packages/types/package.json << 'EOF'
{
  "name": "@hastecrm/types",
  "version": "1.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist .turbo"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
EOF
print_success "Created packages/types/package.json"

# Create types index
create_dir "packages/types/src"
cat > packages/types/src/index.ts << 'EOF'
// Common types used across the application

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  workspaceId: string;
}

export interface JWTPayload {
  sub: string;
  email: string;
  workspaceId: string;
  iat: number;
  exp: number;
}
EOF
print_success "Created types index"

# Step 5: Create Setup Scripts
print_header "Step 5: Creating Setup Scripts"

# Create environment setup script
cat > scripts/setup-env.js << 'EOF'
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

if (fs.existsSync(envPath)) {
  console.log('✓ .env file already exists');
  process.exit(0);
}

if (!fs.existsSync(envExamplePath)) {
  console.error('✗ .env.example file not found');
  process.exit(1);
}

// Copy .env.example to .env
const envContent = fs.readFileSync(envExamplePath, 'utf8');

// Generate random secrets
const generateSecret = () => crypto.randomBytes(32).toString('hex');

const updatedContent = envContent
  .replace('change-me-to-a-random-32-character-string', generateSecret())
  .replace('change-me-to-another-random-32-char-string', generateSecret())
  .replace('change-me-to-yet-another-random-32-string', generateSecret());

fs.writeFileSync(envPath, updatedContent);

console.log('✓ Created .env file with generated secrets');
console.log('ℹ Please update the .env file with your API keys if needed');
EOF
print_success "Created setup-env.js"

chmod +x scripts/setup-env.js

# Create initialization checker
cat > scripts/check-setup.js << 'EOF'
#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

console.log('\n🔍 Checking hasteCRM setup...\n');

let errors = 0;

// Check Node version
try {
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.split('.')[0].substring(1));
  if (major >= 18) {
    console.log('✓ Node.js version:', nodeVersion);
  } else {
    console.log('✗ Node.js version too old:', nodeVersion, '(need 18+)');
    errors++;
  }
} catch (e) {
  console.log('✗ Could not check Node.js version');
  errors++;
}

// Check pnpm
try {
  const pnpmVersion = execSync('pnpm --version', { encoding: 'utf8' }).trim();
  console.log('✓ pnpm version:', pnpmVersion);
} catch (e) {
  console.log('✗ pnpm is not installed');
  errors++;
}

// Check Docker
try {
  execSync('docker info', { stdio: 'ignore' });
  console.log('✓ Docker is running');
} catch (e) {
  console.log('✗ Docker is not running');
  errors++;
}

// Check .env file
if (fs.existsSync('.env')) {
  console.log('✓ .env file exists');
} else {
  console.log('✗ .env file missing (run: pnpm run setup:env)');
  errors++;
}

// Check node_modules
if (fs.existsSync('node_modules')) {
  console.log('✓ Dependencies installed');
} else {
  console.log('✗ Dependencies not installed (run: pnpm install)');
  errors++;
}

// Check Docker containers
try {
  const containers = execSync('docker ps --format "{{.Names}}"', { encoding: 'utf8' });
  const requiredContainers = ['hastecrm-postgres', 'hastecrm-redis', 'hastecrm-mailhog'];
  const runningContainers = containers.split('\n').filter(Boolean);
  
  requiredContainers.forEach(container => {
    if (runningContainers.includes(container)) {
      console.log(`✓ ${container} is running`);
    } else {
      console.log(`✗ ${container} is not running (run: pnpm run docker:up)`);
      errors++;
    }
  });
} catch (e) {
  console.log('✗ Could not check Docker containers');
  errors++;
}

console.log('\n' + (errors === 0 ? '✅ Setup is complete!' : `❌ Found ${errors} issues to fix`));
process.exit(errors === 0 ? 0 : 1);
EOF
print_success "Created check-setup.js"

chmod +x scripts/check-setup.js

# Step 6: Create Development Helpers
print_header "Step 6: Creating Development Helpers"

# Create mock AI service
create_dir "packages/shared/src/services"
cat > packages/shared/src/services/mock-ai.ts << 'EOF'
// Mock AI service for development without API keys

export class MockAIService {
  async complete(prompt: string): Promise<string> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return mock responses based on prompt patterns
    if (prompt.includes('email')) {
      return 'This is a mock email response. In production, this would use real AI.';
    }
    
    if (prompt.includes('contact')) {
      return 'Mock contact enrichment: Company: Acme Corp, Role: Manager';
    }
    
    return 'Mock AI response for: ' + prompt.substring(0, 50) + '...';
  }
  
  async embed(text: string): Promise<number[]> {
    // Return mock embedding vector
    return Array(1536).fill(0).map(() => Math.random());
  }
}

export const mockAI = new MockAIService();
EOF
print_success "Created mock AI service"

# Create README for quick reference
cat > README.md << 'EOF'
# hasteCRM

AI-powered CRM platform built with Next.js, NestJS, and PostgreSQL.

## 🚀 Quick Start

```bash
# 1. Run the setup wizard (you've already done this!)
./setup-wizard.sh

# 2. Install dependencies
pnpm install

# 3. Set up environment
pnpm run setup:env

# 4. Start services
pnpm run docker:up

# 5. Initialize database
pnpm run db:push

# 6. Start development
pnpm run dev
```

## 📁 Project Structure

```
.
├── apps/
│   ├── web/          # Next.js frontend
│   ├── api/          # NestJS backend
│   └── workers/      # Background job processors
├── packages/
│   ├── database/     # Prisma schema and client
│   ├── types/        # Shared TypeScript types
│   ├── ui/           # Shared UI components
│   └── shared/       # Shared utilities
├── docker/           # Docker configurations
├── scripts/          # Build and setup scripts
└── docs/            # Documentation
```

## 🛠️ Common Commands

- `pnpm dev` - Start all services in development mode
- `pnpm build` - Build all packages
- `pnpm test` - Run tests
- `pnpm lint` - Run linting
- `pnpm type-check` - Check TypeScript types
- `pnpm db:studio` - Open Prisma Studio
- `pnpm docker:reset` - Reset Docker containers

## 🔧 Troubleshooting

Run `node scripts/check-setup.js` to verify your setup.

## 📚 Documentation

See the [docs](./docs) folder for detailed documentation.
EOF
print_success "Created README.md"

# Step 7: Final Setup
print_header "Step 7: Running Initial Setup"

# Install dependencies
print_info "Installing dependencies..."
pnpm install

# Copy .env file
print_info "Setting up environment..."
node scripts/setup-env.js

# Start Docker containers
print_info "Starting Docker containers..."
docker-compose up -d

# Wait for containers
print_info "Waiting for services to start..."
sleep 5

# Setup git hooks for documentation enforcement
print_info "Setting up git hooks..."
./scripts/setup-git-hooks.sh

# Generate starter templates
print_info "Generating starter templates..."
./scripts/generate-templates.sh

# Run setup check
print_header "🎉 Setup Complete!"
node scripts/check-setup.js

echo ""
echo "📚 Documentation-First Development Enabled!"
echo ""
echo "Key files for Claude Code:"
echo "  • .cursorrules - Mandatory development rules"
echo "  • docs/CLAUDE.md - Current project status"
echo "  • docs/MASTER-CONFIG.md - Version authority"
echo "  • docs/DOCUMENTATION-MAP.md - Quick reference"
echo "  • CLAUDE-PROMPTS.md - Prompt templates"
echo ""
echo "Next steps:"
echo "1. Open this project in Cursor IDE"
echo "2. Claude Code MUST read .cursorrules first"
echo "3. Use prompts from CLAUDE-PROMPTS.md"
echo "4. Start with: make start"
echo ""
echo "Remember: Documentation First, Code Second! 📖"
echo "Happy coding! 🚀"