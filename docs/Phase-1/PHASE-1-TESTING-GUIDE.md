# Phase 1 Testing Guide

## Overview

Phase 1 implements a complete authentication system with the following features:

- User registration with email verification
- JWT-based authentication
- Google OAuth integration
- Two-factor authentication (2FA)
- Password reset functionality
- Session management with Redis
- Rate limiting

## Testing Status

### ✅ Core Features Implemented:

1. **Registration & Login** - Working with email verification requirement
2. **JWT Authentication** - Access and refresh tokens working
3. **Google OAuth** - Configured and redirecting properly
4. **Email Verification** - Emails sent to Mailhog in development
5. **Password Reset** - Full flow implemented
6. **2FA with TOTP** - Setup, enable, disable, and verify
7. **Session Management** - Redis-based sessions
8. **Rate Limiting** - Applied to all auth endpoints

### 🔧 Controllers Created:

- `AuthController` - Main authentication endpoints
- `TwoFactorController` - 2FA management endpoints
- `SessionController` - Session management endpoints

## How to Test

### 1. Start All Services

```bash
# Terminal 1: Start Docker services (PostgreSQL, Redis, Mailhog)
docker-compose up -d

# Terminal 2: Start API
cd apps/api && pnpm dev

# Terminal 3: Start Web App
cd apps/web && pnpm dev
```

### 2. Manual Testing via Web UI

1. **Registration Flow:**

   - Go to http://localhost:3001/register
   - Fill in registration form
   - Check Mailhog at http://localhost:8025 for verification email
   - Click verification link in email
   - You'll be redirected to verify-email page

2. **Login Flow:**

   - Go to http://localhost:3001/login
   - Login with verified account
   - You'll be redirected to dashboard

3. **Google OAuth:**
   - Click "Sign in with Google" on login page
   - Complete Google authentication
   - You'll be redirected back to the app

### 3. API Testing

#### Run Automated Tests:

```bash
# Run E2E tests
cd apps/api && pnpm test:e2e

# Run manual test with verified user
cd apps/api && npx ts-node test/verified-user-test.ts
```

#### Test Individual Endpoints:

```bash
# Health check
curl http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ health }"}'

# Register
curl -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123!",
    "firstName": "Test",
    "lastName": "User",
    "workspaceName": "Test Workspace"
  }'

# Login (after email verification)
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123!"
  }'
```

## Email Verification

In development, all emails are sent to Mailhog:

- Mailhog UI: http://localhost:8025
- SMTP: localhost:1025

To manually verify a user (for testing):

```bash
# Using Prisma Studio
cd packages/database && npx prisma studio

# Or via SQL
docker exec -it crm-postgres psql -U postgres -d crm_dev
UPDATE "User" SET status = 'ACTIVE' WHERE email = 'test@example.com';
```

## Two-Factor Authentication Testing

```bash
# 1. Setup 2FA (requires auth token)
curl -X POST http://localhost:4000/auth/2fa/setup \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password": "YourPassword123!"}'

# Response includes secret and QR code
# Use Google Authenticator or similar app to scan QR code

# 2. Enable 2FA with TOTP token
curl -X POST http://localhost:4000/auth/2fa/enable \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"token": "123456"}'

# 3. Login with 2FA
# First login returns requiresTwoFactor: true
# Then verify with TOTP token
curl -X POST http://localhost:4000/auth/2fa/verify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "token": "123456"
  }'
```

## Troubleshooting

### Common Issues:

1. **"Please verify your email before logging in"**

   - Check Mailhog for verification email
   - Click the verification link
   - Or manually update user status in database

2. **404 on 2FA endpoints**

   - Ensure TwoFactorController is created and imported
   - Restart the API server

3. **Rate limiting not working**

   - Check Redis is running: `docker ps`
   - Check Redis connection in logs

4. **Email not sending**
   - Check Mailhog is running: http://localhost:8025
   - Check email service logs in API console

### Debug Commands:

```bash
# Check running services
docker ps

# View API logs
cd apps/api && pnpm dev

# Check Redis
docker exec -it crm-redis redis-cli
> KEYS *

# Check PostgreSQL
docker exec -it crm-postgres psql -U postgres -d crm_dev
\dt  -- list tables
SELECT * FROM "User";
```

## Test Coverage

### What's Tested:

- ✅ User registration with validation
- ✅ Email verification flow
- ✅ Login with JWT tokens
- ✅ Token refresh mechanism
- ✅ Protected route access
- ✅ Google OAuth redirect
- ✅ 2FA setup and verification
- ✅ Password reset flow
- ✅ Rate limiting
- ✅ Session management

### What Needs Testing:

- [ ] Backup code recovery for 2FA
- [ ] Session revocation
- [ ] Token blacklisting on logout
- [ ] Rate limiting with different plans
- [ ] Workspace switching

## Summary

Phase 1 authentication is fully implemented and functional. The system enforces proper security:

- Users must verify email before login
- Passwords are hashed with bcrypt
- JWT tokens expire and can be refreshed
- 2FA provides additional security
- Rate limiting prevents abuse

All core features are working. Some endpoints needed to be created (TwoFactorController, SessionController) but the services were already implemented.
