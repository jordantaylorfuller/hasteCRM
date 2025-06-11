# Pre-Phase 1 Critical Path Tasks

> These are the absolute must-have tasks that will block Phase 1 if not completed.

## 🚨 Critical Path Items (Must Complete First)

### 1. AI Service API Access (Day 1-2)
**Blocker Level**: 🔴 CRITICAL  
**Owner**: Jordan Taylor Fuller

```bash
# Without these, no AI features can be developed
```

#### Anthropic Claude API
- [ ] Create Anthropic account
- [ ] Apply for API access (may take 24-48 hours)
- [ ] Generate API key
- [ ] Set up billing with $100 initial credit
- [ ] Test basic API call:
```typescript
// test-claude.ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function testClaude() {
  const response = await client.messages.create({
    model: 'claude-3-opus-20240229',
    max_tokens: 100,
    messages: [{
      role: 'user',
      content: 'Hello, Claude!'
    }]
  });
  console.log(response);
}
```

#### OpenAI API
- [ ] Create OpenAI account
- [ ] Add payment method
- [ ] Generate API key
- [ ] Set usage limits
- [ ] Test API call:
```typescript
// test-openai.ts
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function testOpenAI() {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [{
      role: 'user',
      content: 'Hello, GPT!'
    }]
  });
  console.log(completion);
}
```

### 2. Google OAuth Setup (Day 2-3)
**Blocker Level**: 🔴 CRITICAL  
**Owner**: Jordan Taylor Fuller

```bash
# Required for Gmail integration and authentication
```

#### Google Cloud Console Setup
- [ ] Create Google Cloud Project
- [ ] Enable required APIs:
  ```bash
  # APIs to enable
  - Gmail API
  - Google Calendar API
  - Google Meet API
  - Google Drive API (optional)
  - People API
  ```
- [ ] Create OAuth 2.0 credentials:
  - [ ] Configure consent screen
  - [ ] Add authorized redirect URIs:
    ```
    http://localhost:3000/auth/google/callback
    http://localhost:4000/auth/google/callback
    https://yourdomain.com/auth/google/callback
    ```
  - [ ] Download credentials JSON
- [ ] Set up test users (if not verified domain)

### 3. Development Environment Script (Day 1)
**Blocker Level**: 🟡 HIGH  
**Owner**: Jordan Taylor Fuller

```bash
#!/bin/bash
# Quick setup for any developer
```

Create `scripts/quick-start.sh`:
```bash
#!/bin/bash
set -e

echo "🚀 hasteCRM Quick Start"
echo "======================"

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "📦 Installing pnpm..."; npm i -g pnpm; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker is required"; exit 1; }

# Create .env from example
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️  Created .env file - please add your API keys"
fi

# Check for required API keys
source .env
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "❌ ANTHROPIC_API_KEY is required in .env"
  exit 1
fi

# Initialize project
./scripts/initialize-project.sh

# Start services
docker-compose up -d

echo "✅ Setup complete!"
echo "📝 Next steps:"
echo "1. Add your API keys to .env"
echo "2. Run 'pnpm dev' to start development"
```

### 4. Legal Entity & Banking (Day 1-3)
**Blocker Level**: 🟡 HIGH  
**Owner**: Jordan Taylor Fuller

```bash
# Required for contracts and payments
```

#### Business Registration
- [ ] Choose business structure (LLC recommended)
- [ ] File with state (can use LegalZoom/Stripe Atlas)
- [ ] Get EIN from IRS (immediate online)
- [ ] Register for state tax ID

#### Banking Setup
- [ ] Business checking account (Mercury/Brex recommended)
- [ ] Business credit card for subscriptions
- [ ] Link to payment processors

### 5. Core Legal Documents (Day 2-4)
**Blocker Level**: 🟡 HIGH  
**Owner**: Jordan Taylor Fuller

```markdown
# Minimum viable legal framework
```

#### Essential Documents
- [ ] Privacy Policy template
  - Use Termly/Iubenda generator as starting point
  - Must cover AI data processing
  - GDPR/CCPA basics
  
- [ ] Terms of Service template
  - Limitation of liability
  - AI-generated content disclaimer
  - Data retention policies

- [ ] Data Processing Agreement
  - For when you process customer data
  - AI service sub-processor list

## 🟢 Parallel Track Tasks

These can be done alongside critical path:

### Development Tools Setup
```yaml
Can be done by: Jordan Taylor Fuller
Timeline: Ongoing
```

- [ ] VS Code extensions pack:
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "prisma.prisma",
    "graphql.vscode-graphql",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

- [ ] Git hooks setup:
```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

pnpm lint-staged
```

### Cost Monitoring Setup
```yaml
Can be done by: Jordan Taylor Fuller
Timeline: Week 1
```

- [ ] Set up billing alerts:
```typescript
// Anthropic: $15 per 1M tokens
// OpenAI GPT-4: $30 per 1M tokens
// Budget alerts at: $50, $100, $200
```

- [ ] Create usage dashboard:
```sql
-- Track AI usage
CREATE TABLE ai_usage_logs (
  id UUID PRIMARY KEY,
  service TEXT NOT NULL, -- 'claude', 'gpt4', etc
  tokens_used INTEGER,
  cost_usd DECIMAL(10,4),
  user_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 📅 Compressed Timeline (5 Days)

### Day 1 (8 hours)
- **Morning**: Business registration + AI API applications
- **Afternoon**: Development environment script

### Day 2 (8 hours)  
- **Morning**: Google OAuth setup
- **Afternoon**: Test all API integrations

### Day 3 (8 hours)
- **Morning**: Legal documents drafting
- **Afternoon**: Banking and payment setup

### Day 4 (8 hours)
- **Morning**: Security framework
- **Afternoon**: Cost projections and monitoring

### Day 5 (8 hours)
- **Morning**: Final testing and validation
- **Afternoon**: Phase 1 kickoff preparation

## ✅ Critical Path Checklist

Before starting Phase 1, these MUST be complete:

```markdown
### API Access
- [ ] Anthropic API key working
- [ ] OpenAI API key working  
- [ ] Google OAuth configured
- [ ] All API calls tested

### Legal/Business
- [ ] Business entity exists
- [ ] Bank account opened
- [ ] Basic legal docs drafted

### Development
- [ ] Quick-start script works
- [ ] All developers can run locally
- [ ] Git repository initialized

### Costs
- [ ] Budget defined
- [ ] Monitoring in place
- [ ] Alerts configured
```

## 🚀 Quick Validation Test

Run this to verify everything is ready:

```bash
#!/bin/bash
# validate-readiness.sh

echo "Checking Phase 1 readiness..."

# Check API keys
[ -z "$ANTHROPIC_API_KEY" ] && echo "❌ Missing Anthropic API key" || echo "✅ Anthropic API key"
[ -z "$OPENAI_API_KEY" ] && echo "❌ Missing OpenAI API key" || echo "✅ OpenAI API key"
[ -z "$GOOGLE_CLIENT_ID" ] && echo "❌ Missing Google OAuth" || echo "✅ Google OAuth"

# Check tools
command -v docker >/dev/null 2>&1 && echo "✅ Docker installed" || echo "❌ Docker missing"
command -v pnpm >/dev/null 2>&1 && echo "✅ pnpm installed" || echo "❌ pnpm missing"

# Check services
docker ps | grep -q postgres && echo "✅ PostgreSQL running" || echo "❌ PostgreSQL not running"
docker ps | grep -q redis && echo "✅ Redis running" || echo "❌ Redis not running"

# Test API connections
node -e "console.log('✅ Node.js working')" || echo "❌ Node.js error"
```

---

*Focus on the critical path - everything else can wait until Phase 1 is underway.*