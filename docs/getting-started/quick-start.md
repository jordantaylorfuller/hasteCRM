# Quick Start Guide

Get hasteCRM running locally in 5 minutes.

## Prerequisites

- Node.js 18.19.0+
- Docker Desktop
- Git

## Setup

1. **Clone and Install**
   ```bash
   git clone https://github.com/hasteNYC/hasteCRM.git
   cd hasteCRM
   ./scripts/init-project.sh
   ```

2. **Configure Environment**
   ```bash
   # Edit .env with your API keys
   ANTHROPIC_API_KEY=your-key-here
   GOOGLE_CLIENT_ID=your-google-oauth-id
   GOOGLE_CLIENT_SECRET=your-google-oauth-secret
   ```

3. **Start Development**
   ```bash
   pnpm dev
   ```

## Access Points

- **Web App**: http://localhost:3000
- **API**: http://localhost:4000/graphql
- **API Docs**: http://localhost:4000/api-docs

## Default Credentials

- **Email**: admin@haste.nyc
- **Password**: Welcome123!

## Next Steps

1. [Set up Google OAuth](../features/auth.md#google-oauth-setup)
2. [Configure AI Services](../features/ai-integration.md#setup)
3. [Import Contacts](../features/contacts.md#importing)

## Common Issues

### Ports Already in Use
```bash
# Kill processes on required ports
lsof -ti:3000 | xargs kill -9
lsof -ti:4000 | xargs kill -9
lsof -ti:5432 | xargs kill -9
```

### Docker Not Running
Ensure Docker Desktop is running before starting services.

### Database Connection Failed
```bash
# Restart database container
docker-compose restart postgres
```

Need help? See [Troubleshooting Guide](../troubleshooting.md)