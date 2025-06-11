# Day 1 Checklist - Start Here! 🚀

> This is your practical, step-by-step guide to get hasteCRM from zero to development-ready in one day.

## ⏰ Time Estimate: 4-6 hours

## 🎯 Goal
By the end of Day 1, you'll have:
- All critical accounts created
- API access confirmed
- Local development environment running
- First commit pushed

---

## 📋 Step-by-Step Checklist

### Hour 1: Critical Accounts (45 min)

#### 1. AI Services - START THESE FIRST! ⏰
Applications can take 24-48 hours for approval.

**Anthropic Claude** (10 min)
- [ ] Go to https://console.anthropic.com
- [ ] Sign up with business email
- [ ] Apply for API access
- [ ] Add payment method
- [ ] Note: You'll get an email when approved

**OpenAI** (5 min)
- [ ] Go to https://platform.openai.com
- [ ] Create account
- [ ] Add payment method ($10 minimum)
- [ ] Generate API key → Save to password manager
- [ ] Set usage limit to $50/month

**Google Cloud** (20 min)
- [ ] Go to https://console.cloud.google.com
- [ ] Create new project: "hasteCRM-dev"
- [ ] Enable APIs:
  ```
  ✓ Gmail API
  ✓ Google Calendar API  
  ✓ People API
  ```
- [ ] Create OAuth 2.0 credentials
- [ ] Download credentials JSON

**GitHub** (10 min)
- [ ] Create organization: "hastecrm" (or available variant)
- [ ] Create repository: "hastecrm"
- [ ] Clone locally:
  ```bash
  git clone git@github.com:YOUR_ORG/hastecrm.git
  cd hastecrm
  ```

### Hour 2: Development Setup (45 min)

#### 2. Local Environment

**Install Prerequisites** (15 min)
```bash
# macOS (using Homebrew)
brew install node@18 pnpm docker docker-compose postgresql@15 redis

# Verify installations
node --version  # Should be 18.x
pnpm --version  # Should be 8.x
docker --version
```

**Run Initialization** (20 min)
```bash
# Make script executable
chmod +x scripts/initialize-project.sh

# Run it!
./scripts/initialize-project.sh

# This creates the entire project structure
```

**Environment Configuration** (10 min)
```bash
# Copy example environment
cp .env.example .env

# Edit .env and add (even if pending):
ANTHROPIC_API_KEY=pending_approval
OPENAI_API_KEY=sk-...your-key...
GOOGLE_CLIENT_ID=pending_setup
GOOGLE_CLIENT_SECRET=pending_setup
```

### Hour 3: First Working Code (45 min)

#### 3. Verify Everything Works

**Start Services** (10 min)
```bash
# Start Docker services
docker-compose up -d

# Check they're running
docker ps
# Should see: postgres, redis, mailhog
```

**Install Dependencies** (10 min)
```bash
# Install all packages
pnpm install

# If any errors, try:
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

**Run Development** (15 min)
```bash
# Start development servers
pnpm dev

# Check:
# Frontend: http://localhost:3000
# API: http://localhost:4000/graphql
# Mailhog: http://localhost:8025
```

**Make First Commit** (10 min)
```bash
# Set up Git
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"

# Create .gitignore
cat > .gitignore << 'EOF'
node_modules
.env
.env.local
dist
.next
.turbo
*.log
.DS_Store
EOF

# Commit
git add .
git commit -m "chore: initial project setup

- Set up monorepo structure
- Configure development environment
- Add Docker services
- Initialize packages"

git push origin main
```

### Hour 4: Quick Wins (45 min)

#### 4. Test Basic Functionality

**Test Database Connection** (10 min)
```bash
# Access Prisma Studio
cd packages/database
pnpm dlx prisma studio

# This opens a GUI to see your database
```

**Create First Schema** (15 min)
```prisma
// packages/database/prisma/schema.prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

```bash
# Generate Prisma client
pnpm db:generate

# Create migration
pnpm db:migrate dev --name init
```

**Test API Endpoint** (20 min)
```typescript
// apps/api/src/app.module.ts
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver } from '@nestjs/apollo';

@Module({
  imports: [
    GraphQLModule.forRoot({
      driver: ApolloDriver,
      autoSchemaFile: true,
      playground: true,
    }),
  ],
})
export class AppModule {}
```

---

## 🏁 End of Day 1 Checklist

### ✅ Accounts Created
- [ ] Anthropic (pending approval)
- [ ] OpenAI (API key saved)
- [ ] Google Cloud (project created)
- [ ] GitHub (repo created)

### ✅ Development Environment
- [ ] All tools installed
- [ ] Project initialized
- [ ] Dependencies installed
- [ ] Services running

### ✅ First Code
- [ ] Initial commit pushed
- [ ] Database connected
- [ ] Basic API running
- [ ] Can access all endpoints

---

## 🚫 Common Issues & Fixes

### Issue: "Cannot find module"
```bash
# Clear everything and reinstall
rm -rf node_modules **/node_modules
rm -rf .next **/dist
pnpm install
```

### Issue: "Port already in use"
```bash
# Find and kill process
lsof -ti:3000 | xargs kill -9
lsof -ti:4000 | xargs kill -9
```

### Issue: "Docker not running"
```bash
# Restart Docker Desktop
# Then:
docker-compose down
docker-compose up -d
```

### Issue: "Database connection failed"
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check connection string in .env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/crm_dev
```

---

## 📅 What's Next?

### Day 2 Priorities
1. **API Access Follow-up**
   - Check Anthropic approval status
   - Complete Google OAuth setup
   - Test all API integrations

2. **Legal/Business** (if applicable)
   - Start business registration
   - Open business bank account

3. **Begin Phase 1**
   - Review [Phase 1 Foundation](./claude-tasks/phase-1-foundation.md)
   - Set up authentication
   - Create user model

### This Week
- Complete [Pre-Phase 1 Sprint Plan](./PRE-PHASE-1-SPRINT-PLAN.md)
- Set up CI/CD pipeline
- Add team members
- Start Phase 1 implementation

---

## 💡 Pro Tips

1. **Start API applications NOW** - They take time
2. **Use temporary keys** - Put "pending" in .env for blocked items
3. **Commit often** - Small, focused commits
4. **Ask for help** - Join our Discord/Slack
5. **Document as you go** - Future you will thank you

---

## 🎉 Congratulations!

You've completed Day 1! You now have:
- A working development environment
- All the tools you need
- A clear path forward

**Next Step**: Continue with Day 2 of the [Pre-Phase 1 Sprint Plan](./PRE-PHASE-1-SPRINT-PLAN.md)

---

*Remember: Perfect is the enemy of good. Get it working first, optimize later!*