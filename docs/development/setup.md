# Development Setup Guide

This guide will help you set up your local development environment for hasteCRM.

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

### Required Software
- **Node.js**: v18.0.0 or higher ([Download](https://nodejs.org/))
- **pnpm**: v8.0.0 or higher (`npm install -g pnpm`)
- **Docker Desktop**: Latest version ([Download](https://www.docker.com/products/docker-desktop))
- **Git**: v2.30.0 or higher
- **VS Code** (recommended) or your preferred IDE

### System Requirements
- **OS**: macOS 12+, Windows 10/11 (WSL2), or Linux
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 20GB free space
- **CPU**: 4 cores minimum

### Required Accounts
- **GitHub**: For repository access
- **Google Cloud**: For Gmail API ([Console](https://console.cloud.google.com))
- **Anthropic**: For Claude API ([Get API Key](https://console.anthropic.com))
- **OpenAI**: For GPT-4 API ([Get API Key](https://platform.openai.com))
- **Perplexity**: For web search API ([Get API Key](https://www.perplexity.ai))
- **SendGrid**: For email delivery ([Sign up](https://sendgrid.com))

## 🚀 Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/hasteNYC/hasteCRM.git
cd hasteCRM

# 2. Run the setup script (NEW!)
./scripts/setup.sh

# This script will:
# - Check prerequisites
# - Install dependencies
# - Set up environment variables
# - Start Docker services
# - Run migrations
# - Seed sample data
# - Start development servers
```

Your application should now be running at:
- Frontend: http://localhost:3000
- API: http://localhost:4000/graphql
- Email UI (MailHog): http://localhost:8025
- Database UI (Prisma): http://localhost:5555
- S3 UI (MinIO): http://localhost:9001

## 🔧 Detailed Setup

### Step 1: Prerequisites Verification

Run our prerequisite checker:
```bash
./scripts/check-prerequisites.sh
```

This will verify:
- ✅ Node.js version
- ✅ pnpm installation
- ✅ Docker status
- ✅ Available ports
- ✅ System resources

### Step 2: Environment Configuration

#### Automated Setup (Recommended)
```bash
# Interactive environment setup
pnpm setup:env
```

#### Manual Setup
Create a `.env.local` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/crm_dev"
REDIS_URL="redis://localhost:6379"

# Authentication
JWT_SECRET="change-me-in-production-min-32-chars"
JWT_REFRESH_SECRET="change-me-refresh-secret-min-32-chars"
SESSION_SECRET="change-me-session-secret-min-32-chars"

# Google OAuth & APIs
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret-here"
GOOGLE_REDIRECT_URI="http://localhost:3000/auth/google/callback"
GOOGLE_PUBSUB_TOPIC="projects/your-project/topics/gmail-push"
GOOGLE_PUBSUB_SUBSCRIPTION="projects/your-project/subscriptions/gmail-push-sub"

# AI Services
ANTHROPIC_API_KEY="your-anthropic-api-key-here"
OPENAI_API_KEY="your-openai-api-key-here"
PERPLEXITY_API_KEY="your-perplexity-api-key-here"

# Email Configuration
SMTP_HOST="localhost"
SMTP_PORT="1025"
SMTP_USER=""
SMTP_PASS=""
SENDGRID_API_KEY="your-sendgrid-api-key-here" # For production emails
EMAIL_FROM_ADDRESS="noreply@localhost"
EMAIL_TRACKING_DOMAIN="http://localhost:4000/track"

# Application URLs
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_API_URL="http://localhost:4000"
NEXT_PUBLIC_WS_URL="ws://localhost:4000"

# Storage
S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY="change-me-minio-access-key"
S3_SECRET_KEY="change-me-minio-secret-key"
S3_BUCKET="crm-dev"
S3_REGION="us-east-1"

# Feature Flags
ENABLE_AI_FEATURES="true"
ENABLE_EMAIL_TRACKING="true"
ENABLE_MEETING_INTELLIGENCE="false"
ENABLE_ADVANCED_ANALYTICS="false"

# Development
NODE_ENV="development"
LOG_LEVEL="debug"
FORCE_COLOR="1"
```

### Step 3: Google Cloud Setup (Detailed)

#### 3.1 Create Project & Enable APIs
```bash
# Install gcloud CLI
# macOS
brew install google-cloud-sdk

# Ubuntu/Debian
echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key --keyring /usr/share/keyrings/cloud.google.gpg add -
sudo apt-get update && sudo apt-get install google-cloud-cli

# Windows (WSL2)
# Download from https://cloud.google.com/sdk/docs/install

# Initialize gcloud
gcloud init

# Create project
gcloud projects create hastecrm-dev-$USER --name="hasteCRM Dev"
gcloud config set project hastecrm-dev-$USER

# Enable APIs
gcloud services enable \
  gmail.googleapis.com \
  drive.googleapis.com \
  calendar-json.googleapis.com \
  pubsub.googleapis.com \
  cloudresourcemanager.googleapis.com
```

#### 3.2 Create Service Account
```bash
# Create service account
gcloud iam service-accounts create hastecrm-dev \
  --display-name="hasteCRM Development"

# Download credentials
gcloud iam service-accounts keys create \
  ./credentials/google-service-account.json \
  --iam-account=hastecrm-dev@hastecrm-dev-$USER.iam.gserviceaccount.com

# Set environment variable
echo "GOOGLE_APPLICATION_CREDENTIALS=./credentials/google-service-account.json" >> .env.local
```

#### 3.3 OAuth 2.0 Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **APIs & Services → Credentials**
3. Click **Create Credentials → OAuth client ID**
4. Choose **Web application**
5. Add authorized redirect URIs:
   ```
   http://localhost:3000/auth/google/callback
   http://localhost:4000/auth/google/callback
   http://localhost:3000/api/auth/callback/google
   ```
6. Add authorized JavaScript origins:
   ```
   http://localhost:3000
   http://localhost:4000
   ```
7. Copy the Client ID and Client Secret to `.env.local`

#### 3.4 Gmail Push Notifications
```bash
# Create Pub/Sub topic
gcloud pubsub topics create gmail-push-notifications

# Create subscription
gcloud pubsub subscriptions create gmail-push-sub \
  --topic=gmail-push-notifications \
  --push-endpoint=https://your-domain.com/webhooks/gmail

# Grant Gmail publish permissions
gcloud pubsub topics add-iam-policy-binding gmail-push-notifications \
  --member=serviceAccount:gmail-api-push@system.gserviceaccount.com \
  --role=roles/pubsub.publisher
```

### Step 4: Database Setup (Enhanced)

#### 4.1 Start PostgreSQL
```bash
# Start PostgreSQL with custom configuration
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
./scripts/wait-for-postgres.sh
```

#### 4.2 Database Initialization
```bash
# Create databases
docker exec -it crm-postgres psql -U postgres << EOF
CREATE DATABASE crm_dev;
CREATE DATABASE crm_test;
CREATE DATABASE crm_shadow;
EOF

# Run migrations
pnpm db:migrate

# Seed with sample data
pnpm db:seed

# Optional: Import large dataset for testing
pnpm db:seed:large  # Creates 10k contacts, 50k activities
```

#### 4.3 Database Management Commands
```bash
# Open Prisma Studio (GUI)
pnpm db:studio

# Create migration
pnpm db:migrate:dev --name descriptive_name

# Reset database
pnpm db:reset

# Database backup
./scripts/backup-db.sh

# Restore from backup
./scripts/restore-db.sh backup-2024-01-15.sql
```

### Step 5: Redis Setup (Enhanced)

```bash
# Start Redis with persistence
docker-compose up -d redis

# Verify Redis
docker exec -it crm-redis redis-cli ping

# Monitor Redis in real-time
docker exec -it crm-redis redis-cli monitor

# Redis GUI (optional)
docker run -d -p 8081:8081 \
  --link crm-redis:redis \
  rediscommander/redis-commander
```

### Step 6: Development Services Configuration

#### Complete Docker Compose Stack
```yaml
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
      - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: crm-redis
    command: redis-server --appendonly yes --requirepass change-me-redis-password
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  mailhog:
    image: mailhog/mailhog:latest
    container_name: crm-mailhog
    ports:
      - "1025:1025"  # SMTP
      - "8025:8025"  # Web UI
    environment:
      MH_STORAGE: maildir
      MH_MAILDIR_PATH: /maildir
    volumes:
      - mailhog_data:/maildir

  minio:
    image: minio/minio:latest
    container_name: crm-minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: change-me-minio-user
      MINIO_ROOT_PASSWORD: change-me-minio-password
    ports:
      - "9000:9000"  # API
      - "9001:9001"  # Console
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

  # Development utilities
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: crm-pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@localhost
      PGADMIN_DEFAULT_PASSWORD: change-me-pgadmin-password
    ports:
      - "5050:80"
    depends_on:
      - postgres

volumes:
  postgres_data:
  redis_data:
  minio_data:
  mailhog_data:
```

### Step 7: Project Initialization

```bash
# Install all dependencies
pnpm install

# Generate Prisma client
pnpm db:generate

# Build shared packages
pnpm build:packages

# Create S3 buckets
./scripts/setup-minio.sh

# Verify all services
pnpm check:services
```

## 🏗️ Project Structure (Enhanced)

```
hastecrm/
├── apps/
│   ├── web/                 # Next.js frontend
│   │   ├── app/            # App router pages
│   │   ├── components/     # React components
│   │   │   ├── ui/        # Base UI components
│   │   │   ├── features/  # Feature components
│   │   │   └── layouts/   # Layout components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── lib/           # Utilities and configs
│   │   ├── public/        # Static assets
│   │   └── styles/        # Global styles
│   │
│   ├── api/                # NestJS backend
│   │   ├── src/
│   │   │   ├── modules/   # Feature modules
│   │   │   ├── common/    # Shared code
│   │   │   ├── config/    # Configuration
│   │   │   └── main.ts    # Entry point
│   │   ├── test/          # Tests
│   │   └── prisma/        # Database schema
│   │
│   └── workers/            # Background job processors
│       ├── email-sync/     # Gmail sync worker
│       ├── ai-tasks/       # AI processing worker
│       ├── analytics/      # Analytics worker
│       └── shared/         # Shared worker code
│
├── packages/               # Shared packages
│   ├── database/          # Prisma schemas & migrations
│   ├── types/            # TypeScript types
│   ├── ui/               # Shared UI components
│   ├── utils/            # Shared utilities
│   ├── ai-sdk/           # AI service wrappers
│   └── email-sdk/        # Email service wrappers
│
├── scripts/               # Development scripts
│   ├── setup.sh          # Initial setup
│   ├── check-prerequisites.sh
│   ├── backup-db.sh
│   └── ...
│
├── docker/                # Docker configurations
│   ├── development/
│   ├── production/
│   └── testing/
│
├── .github/              # GitHub configurations
│   ├── workflows/        # CI/CD pipelines
│   └── ISSUE_TEMPLATE/
│
└── docs/                 # Documentation
```

## 🧪 Testing Setup

### Test Database Configuration
```bash
# Create test database
docker exec -it crm-postgres psql -U postgres -c "CREATE DATABASE crm_test;"

# Run tests with proper environment
NODE_ENV=test pnpm test
```

### Testing Commands
```bash
# Unit tests
pnpm test:unit           # Run unit tests
pnpm test:unit:watch     # Watch mode
pnpm test:unit:coverage  # With coverage

# Integration tests
pnpm test:integration    # Run integration tests
pnpm test:api           # API integration tests

# E2E tests
pnpm test:e2e           # Headless
pnpm test:e2e:headed    # With browser
pnpm test:e2e:debug     # Debug mode

# All tests
pnpm test:all           # Run everything
```

## 🔍 Development Tools

### Database Management
```bash
# Prisma Studio (GUI)
pnpm db:studio

# pgAdmin (Alternative GUI)
# Access at http://localhost:5050
# Login: admin@localhost / admin
# Add server: postgres / 5432 / postgres / postgres

# Database queries
pnpm db:query "SELECT * FROM users LIMIT 10"

# Database console
pnpm db:console
```

### API Development
```bash
# GraphQL Playground
# http://localhost:4000/graphql

# Generate GraphQL schema
pnpm generate:graphql

# Generate API documentation
pnpm docs:api

# API request examples
./scripts/api-examples.sh
```

### Email Development
```bash
# MailHog UI
# http://localhost:8025

# Send test email
pnpm email:test

# Clear all emails
curl -X DELETE http://localhost:8025/api/v1/messages
```

## 🐛 Troubleshooting (Enhanced)

### Common Issues & Solutions

#### Port Conflicts
```bash
# Check what's using a port
lsof -i :3000

# Kill all development ports
./scripts/kill-ports.sh

# Use alternative ports
PORT=3001 pnpm dev:web
API_PORT=4001 pnpm dev:api
```

#### Database Issues
```bash
# Connection refused
docker-compose restart postgres
./scripts/wait-for-postgres.sh

# Migration errors
pnpm db:migrate:reset  # WARNING: Deletes all data

# Prisma client issues
pnpm clean:prisma
pnpm db:generate
```

#### Node/pnpm Issues
```bash
# Clear everything and start fresh
./scripts/clean-install.sh

# This runs:
# - Remove all node_modules
# - Clear pnpm store
# - Clear Next.js cache
# - Clear TypeScript cache
# - Fresh install
```

#### Docker Issues
```bash
# Complete Docker reset
docker-compose down -v
docker system prune -af --volumes
docker-compose up -d

# Check Docker logs
docker-compose logs -f [service-name]

# Docker resource issues
# Increase Docker Desktop memory to 8GB+
```

#### AI API Issues
```bash
# Check API keys
./scripts/verify-api-keys.sh

# Use mock AI responses in development
MOCK_AI_RESPONSES=true pnpm dev
```

### Debug Mode
```bash
# Enable verbose logging
DEBUG=* pnpm dev

# Debug specific module
DEBUG=api:auth pnpm dev:api

# Node.js debugging
NODE_OPTIONS='--inspect' pnpm dev:api
# Then open chrome://inspect
```

## 🛠️ IDE Configuration

### VS Code Setup (Enhanced)

#### Required Extensions
```bash
# Install all recommended extensions
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension prisma.prisma
code --install-extension graphql.vscode-graphql
code --install-extension graphql.vscode-graphql-syntax
code --install-extension bradlc.vscode-tailwindcss
code --install-extension formulahendry.auto-rename-tag
code --install-extension steoates.autoimport
code --install-extension usernamehw.errorlens
code --install-extension yoavbls.pretty-ts-errors
code --install-extension christian-kohler.path-intellisense
code --install-extension mikestead.dotenv
code --install-extension eamodio.gitlens
```

#### Workspace Settings
Create `.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "typescript.preferences.importModuleSpecifier": "shortest",
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"],
    ["clsx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ],
  "files.exclude": {
    "**/node_modules": true,
    "**/.turbo": true,
    "**/dist": true,
    "**/.next": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.next": true,
    "**/coverage": true
  },
  "[prisma]": {
    "editor.defaultFormatter": "Prisma.prisma"
  },
  "prisma.showPrismaDataPlatformNotification": false,
  "dotenv.enableAutocloaking": false
}
```

#### Launch Configurations
Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug API",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["run", "dev:api:debug"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "env": {
        "DEBUG": "api:*"
      }
    },
    {
      "name": "Debug Web",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}/apps/web",
      "sourceMapPathOverrides": {
        "webpack://_N_E/*": "${webRoot}/*"
      }
    },
    {
      "name": "Debug Test",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "pnpm",
      "runtimeArgs": ["run", "test:debug", "${file}"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### WebStorm/IntelliJ Setup
1. Enable pnpm: Settings → Languages & Frameworks → Node.js → Package Manager
2. Set TypeScript version: Settings → Languages & Frameworks → TypeScript
3. Configure Prettier: Settings → Languages & Frameworks → JavaScript → Prettier
4. Enable ESLint: Settings → Languages & Frameworks → JavaScript → Code Quality Tools → ESLint

## 📊 Performance Monitoring

### Development Performance Tools
```bash
# Frontend bundle analysis
pnpm analyze:web

# API performance profiling
pnpm profile:api

# Database query analysis
pnpm db:analyze

# Memory usage monitoring
pnpm monitor:memory
```

### Chrome DevTools Setup
1. **React DevTools**: Install extension
2. **Apollo DevTools**: For GraphQL debugging
3. **Network throttling**: Test on slow connections
4. **Performance profiling**: Record and analyze

## 🚀 Advanced Development

### Using Development Fixtures
```bash
# Load specific test scenarios
pnpm fixture:load large-workspace    # 10k contacts
pnpm fixture:load email-campaigns    # Email test data
pnpm fixture:load ai-automations     # AI test scenarios
```

### Feature Flags
```typescript
// Toggle features in .env.local
ENABLE_AI_FEATURES=true
ENABLE_MEETING_INTELLIGENCE=false

// Use in code
if (process.env.ENABLE_AI_FEATURES === 'true') {
  // AI features
}
```

### Mock Services
```bash
# Use mock AI responses
MOCK_AI_RESPONSES=true pnpm dev

# Use mock email sending
MOCK_EMAIL_SENDING=true pnpm dev

# Mock all external services
MOCK_ALL_EXTERNAL=true pnpm dev
```

## 📚 Learning Resources

### Documentation
- [Architecture Guide](../architecture/overview.md)
- [API Documentation](../api/graphql-schema.md)
- [Database Schema](../architecture/database-schema.md)
- [Testing Guide](testing-guide.md)

### Video Tutorials
- [Getting Started (YouTube)](https://youtube.com/...)
- [Architecture Overview (Loom)](https://loom.com/...)
- [Debugging Tips (Internal)](https://...)

### Example Code
- [API Examples](../../examples/api/)
- [Frontend Patterns](../../examples/frontend/)
- [Testing Patterns](../../examples/testing/)

## 🚨 Troubleshooting Common Issues

### Port Already in Use
```bash
# Find and kill process
lsof -i :3000
kill -9 <PID>

# Or use one-liner:
npx kill-port 3000 4000 5432 6379
```

### Docker Not Running
```bash
# macOS:
open -a Docker

# Wait 30 seconds, then verify:
docker ps
```

### Database Connection Failed
```bash
# Restart database container
docker-compose down
docker-compose up -d postgres

# Recreate database
docker exec -it hastecrm-postgres psql -U postgres -c "CREATE DATABASE hastecrm_dev"
pnpm run db:push
```

### Module Not Found Errors
```bash
# Clean and rebuild
pnpm run clean
rm -rf node_modules
pnpm install
pnpm run build
```

### TypeScript Errors
```bash
# Generate Prisma client
cd packages/database
pnpm run db:generate
cd ../..
```

## 🆘 Getting Help

### Self-Service
1. Run diagnostics: `node scripts/check-setup.js`
2. Check logs: `pnpm logs:all`
3. Search issues: [GitHub Issues](https://github.com/hasteNYC/hasteCRM/issues)

### Team Support
- **Slack**: #crm-development (fastest)
- **Email**: crm-dev-team@haste.nyc
- **Office Hours**: Tue/Thu 2-3pm PST

### Bug Reports
Use `pnpm report:bug` to generate a bug report with:
- System information
- Environment variables (sanitized)
- Recent logs
- Diagnostic results

## 🎉 Next Steps

1. ✅ Run the test suite: `pnpm test`
2. ✅ Explore the GraphQL playground
3. ✅ Create your first contact
4. ✅ Set up your first automation
5. ✅ Read the [contribution guide](../CONTRIBUTING.md)

Welcome to the team! 🚀