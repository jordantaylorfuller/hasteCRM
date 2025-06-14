# Authentication & Authorization

## Overview

hasteCRM implements a comprehensive authentication and authorization system that supports multiple authentication methods, role-based access control (RBAC), and fine-grained permissions. This document details the implementation, configuration, and usage of the auth system.

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
   - 1.1 [Components](#11-components)
   - 1.2 [Token Flow](#12-token-flow)
2. [Authentication Methods](#2-authentication-methods)
   - 2.1 [Email/Password Authentication](#21-emailpassword-authentication)
   - 2.2 [OAuth2 Authentication](#22-oauth2-authentication)
   - 2.3 [Magic Link Authentication](#23-magic-link-authentication)
   - 2.4 [API Key Authentication](#24-api-key-authentication)
3. [Authorization System](#3-authorization-system)
   - 3.1 [Role-Based Access Control (RBAC)](#31-role-based-access-control-rbac)
   - 3.2 [Permission Model](#32-permission-model)
   - 3.3 [Custom Permissions](#33-custom-permissions)
4. [Implementation Details](#4-implementation-details)
   - 4.1 [JWT Token Structure](#41-jwt-token-structure)
   - 4.2 [Session Management](#42-session-management)
   - 4.3 [Middleware Implementation](#43-middleware-implementation)
5. [API Reference](#5-api-reference)
   - 5.1 [Authentication Endpoints](#51-authentication-endpoints)
   - 5.2 [User Management Endpoints](#52-user-management-endpoints)
   - 5.3 [OAuth Endpoints](#53-oauth-endpoints)
6. [Security Features](#6-security-features)
   - 6.1 [Password Security](#61-password-security)
   - 6.2 [Rate Limiting](#62-rate-limiting)
   - 6.3 [Two-Factor Authentication (2FA)](#63-two-factor-authentication-2fa)
   - 6.4 [Account Security](#64-account-security)
   - 6.5 [Token Security](#65-token-security)
7. [Configuration](#7-configuration)
   - 7.1 [Environment Variables](#71-environment-variables)
   - 7.2 [Security Headers](#72-security-headers)
8. [Best Practices](#8-best-practices)
   - 8.1 [Token Management](#81-token-management)
   - 8.2 [Password Policies](#82-password-policies)
   - 8.3 [Session Security](#83-session-security)
   - 8.4 [API Security](#84-api-security)
   - 8.5 [Monitoring & Logging](#85-monitoring--logging)
9. [Troubleshooting](#9-troubleshooting)
   - 9.1 [Common Issues](#91-common-issues)
   - 9.2 [Debug Mode](#92-debug-mode)
   - 9.3 [Health Checks](#93-health-checks)
10. [Related Documentation](#10-related-documentation)
11. [Conclusion](#11-conclusion)

## 1. Architecture Overview

### 1.1 Components

```
                                                             
                                                             
  Client Apps        �   Auth Service      �   Database      
  (Web/Mobile)                                               
                                                             
                                                       
                                �                       
                                                     
                      �  OAuth Providers             
                          (Google, MS)                
                                                      
                                                        
                                 �                       �
                                                               
                           JWT Tokens            Redis Cache   
                           (Access/Ref)          (Sessions)    
                                                               
```

### 1.2 Token Flow

1. **Authentication** � User credentials verified � Tokens issued
2. **Authorization** � Token validated � Permissions checked � Access granted/denied
3. **Refresh** � Refresh token used � New access token issued

## 2. Authentication Methods

### 2.1 Email/Password Authentication

Traditional email and password authentication with security enhancements.

#### Registration Flow

```typescript
// POST /api/auth/register
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "workspaceName": "Acme Corp" // Optional - creates new workspace
}

// Response
{
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "emailVerified": false
  },
  "tokens": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": 3600
  }
}
```

#### Login Flow

```typescript
// POST /api/auth/login
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}

// Response
{
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "workspaces": [
      {
        "id": "workspace_123",
        "name": "Acme Corp",
        "role": "owner"
      }
    ]
  },
  "tokens": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": 3600
  }
}
```

#### Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character
- Not in common password list
- Not similar to email or name

### 2.2 OAuth2 Authentication

Support for third-party authentication providers.

#### Google OAuth

```typescript
// GET /api/auth/google
// Redirects to Google OAuth consent screen

// Callback: GET /api/auth/google/callback?code=...
// Handles OAuth callback and creates/updates user

// Frontend implementation
import { signIn } from 'next-auth/react';

function GoogleLoginButton() {
  return (
    <button onClick={() => signIn('google')}>
      Sign in with Google
    </button>
  );
}
```

#### Microsoft OAuth

```typescript
// GET /api/auth/microsoft
// Redirects to Microsoft OAuth consent screen

// Callback: GET /api/auth/microsoft/callback?code=...
```

### 2.3 Magic Link Authentication

Passwordless authentication via email.

```typescript
// POST /api/auth/magic-link
{
  "email": "user@example.com"
}

// Email sent with link: https://app.crm.com/auth/verify?token=...

// GET /api/auth/verify?token=...
// Verifies token and logs user in
```

### 2.4 API Key Authentication

For programmatic access and integrations.

```typescript
// Generate API key
// POST /api/auth/api-keys
{
  "name": "Integration Key",
  "permissions": ["contacts:read", "contacts:write"]
}

// Response
{
  "id": "api_key_123",
  "name": "Integration Key",
  "key": "crm_live_a1b2c3d4...", // Only shown once
  "permissions": ["contacts:read", "contacts:write"],
  "createdAt": "2024-01-01T00:00:00Z"
}

// Usage
fetch('/api/contacts', {
  headers: {
    'X-API-Key': 'crm_live_a1b2c3d4...'
  }
});
```

[⬆ Back to top](#table-of-contents)

## 3. Authorization System

### 3.1 Role-Based Access Control (RBAC)

#### Workspace Roles

```typescript
enum WorkspaceRole {
  Owner = 'owner',        // Full access, can delete workspace
  Admin = 'admin',        // Full access except workspace deletion
  Member = 'member',      // Standard access
  Viewer = 'viewer'       // Read-only access
}

// Role hierarchy
const roleHierarchy = {
  owner: ['admin', 'member', 'viewer'],
  admin: ['member', 'viewer'],
  member: ['viewer'],
  viewer: []
};
```

#### Resource-Level Permissions

```typescript
interface Permission {
  resource: string;
  actions: string[];
  conditions?: Record<string, any>;
}

// Example permissions
const permissions: Permission[] = [
  {
    resource: 'contacts',
    actions: ['create', 'read', 'update', 'delete'],
    conditions: { ownOnly: true }
  },
  {
    resource: 'deals',
    actions: ['read', 'update'],
    conditions: { teamOnly: true }
  }
];
```

### 3.2 Permission Model

```typescript
// Permission structure
interface PermissionCheck {
  user: User;
  workspace: Workspace;
  resource: string;
  action: string;
  resourceId?: string;
}

// Permission checking
async function checkPermission({
  user,
  workspace,
  resource,
  action,
  resourceId
}: PermissionCheck): Promise<boolean> {
  // 1. Check workspace membership
  const member = await getWorkspaceMember(workspace.id, user.id);
  if (!member) return false;
  
  // 2. Check role permissions
  const rolePermissions = getRolePermissions(member.role);
  if (rolePermissions.includes(`${resource}:${action}`)) {
    return true;
  }
  
  // 3. Check custom permissions
  const customPermissions = await getCustomPermissions(member.id);
  if (customPermissions.includes(`${resource}:${action}`)) {
    return true;
  }
  
  // 4. Check resource-specific permissions
  if (resourceId) {
    return checkResourcePermission(user.id, resourceId, action);
  }
  
  return false;
}
```

### 3.3 Custom Permissions

```typescript
// Assign custom permissions to users
// POST /api/workspaces/:id/members/:userId/permissions
{
  "permissions": [
    {
      "resource": "reports",
      "actions": ["create", "read", "update"],
      "conditions": {
        "departmentOnly": true
      }
    }
  ]
}
```

[⬆ Back to top](#table-of-contents)

## 4. Implementation Details

### 4.1 JWT Token Structure

```typescript
// Access Token Payload
interface AccessTokenPayload {
  sub: string;           // User ID
  email: string;
  workspaceId: string;
  role: string;
  permissions: string[];
  iat: number;
  exp: number;
  type: 'access';
}

// Refresh Token Payload
interface RefreshTokenPayload {
  sub: string;           // User ID
  tokenId: string;       // Unique token ID for revocation
  iat: number;
  exp: number;
  type: 'refresh';
}

// Token generation
import jwt from 'jsonwebtoken';

function generateTokens(user: User, workspace: Workspace) {
  const accessToken = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      workspaceId: workspace.id,
      role: user.role,
      permissions: user.permissions,
      type: 'access'
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  
  const refreshToken = jwt.sign(
    {
      sub: user.id,
      tokenId: generateTokenId(),
      type: 'refresh'
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '30d' }
  );
  
  return { accessToken, refreshToken };
}
```

### 4.2 Session Management

```typescript
// Session storage in Redis
interface Session {
  userId: string;
  workspaceId: string;
  deviceInfo: {
    userAgent: string;
    ip: string;
    location?: string;
  };
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
}

// Session management
class SessionManager {
  async createSession(userId: string, deviceInfo: DeviceInfo): Promise<string> {
    const sessionId = generateSessionId();
    const session: Session = {
      userId,
      workspaceId: getCurrentWorkspaceId(),
      deviceInfo,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      expiresAt: addDays(new Date(), 30)
    };
    
    await redis.setex(
      `session:${sessionId}`,
      30 * 24 * 60 * 60, // 30 days
      JSON.stringify(session)
    );
    
    return sessionId;
  }
  
  async validateSession(sessionId: string): Promise<Session | null> {
    const data = await redis.get(`session:${sessionId}`);
    if (!data) return null;
    
    const session = JSON.parse(data) as Session;
    
    // Update last activity
    session.lastActivityAt = new Date();
    await redis.setex(
      `session:${sessionId}`,
      30 * 24 * 60 * 60,
      JSON.stringify(session)
    );
    
    return session;
  }
  
  async revokeSession(sessionId: string): Promise<void> {
    await redis.del(`session:${sessionId}`);
  }
  
  async revokeSessions(userId: string): Promise<void> {
    // Get all sessions for user
    const keys = await redis.keys(`session:*`);
    
    for (const key of keys) {
      const session = await redis.get(key);
      if (session && JSON.parse(session).userId === userId) {
        await redis.del(key);
      }
    }
  }
}
```

### 4.3 Middleware Implementation

```typescript
// Authentication middleware
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Check for Bearer token
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = jwt.verify(token, process.env.JWT_SECRET) as AccessTokenPayload;
      
      // Validate token type
      if (payload.type !== 'access') {
        throw new Error('Invalid token type');
      }
      
      // Get user from cache or database
      const user = await getUserById(payload.sub);
      if (!user) {
        throw new Error('User not found');
      }
      
      req.user = user;
      req.workspaceId = payload.workspaceId;
      return next();
    }
    
    // Check for API key
    const apiKey = req.headers['x-api-key'] as string;
    if (apiKey) {
      const keyData = await validateApiKey(apiKey);
      if (keyData) {
        req.user = keyData.user;
        req.workspaceId = keyData.workspaceId;
        req.permissions = keyData.permissions;
        return next();
      }
    }
    
    throw new Error('No valid authentication provided');
  } catch (error) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      }
    });
  }
}

// Authorization middleware
export function authorize(resource: string, action: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const hasPermission = await checkPermission({
        user: req.user,
        workspace: { id: req.workspaceId },
        resource,
        action,
        resourceId: req.params.id
      });
      
      if (!hasPermission) {
        return res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions'
          }
        });
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}

// Usage
router.get(
  '/api/contacts/:id',
  authenticate,
  authorize('contacts', 'read'),
  contactController.getById
);
```

[⬆ Back to top](#table-of-contents)

## 5. API Reference

### 5.1 Authentication Endpoints

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

#### Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJ..."
}
```

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer {accessToken}
```

#### Password Reset
```http
# Request reset
POST /api/auth/password/reset-request
Content-Type: application/json

{
  "email": "user@example.com"
}

# Reset password
POST /api/auth/password/reset
Content-Type: application/json

{
  "token": "reset_token_from_email",
  "newPassword": "NewSecurePassword123!"
}
```

#### Email Verification
```http
# Resend verification
POST /api/auth/email/verify-request
Authorization: Bearer {accessToken}

# Verify email
GET /api/auth/email/verify?token=verification_token
```

### 5.2 User Management Endpoints

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer {accessToken}
```

#### Update Profile
```http
PATCH /api/auth/me
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "firstName": "Jane",
  "lastName": "Smith",
  "timezone": "America/New_York"
}
```

#### Change Password
```http
POST /api/auth/me/password
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword123!"
}
```

#### List Sessions
```http
GET /api/auth/sessions
Authorization: Bearer {accessToken}
```

#### Revoke Session
```http
DELETE /api/auth/sessions/:sessionId
Authorization: Bearer {accessToken}
```

### 5.3 OAuth Endpoints

#### Initiate OAuth Flow
```http
GET /api/auth/{provider}
# Providers: google, microsoft

# Redirects to provider consent screen
```

#### OAuth Callback
```http
GET /api/auth/{provider}/callback?code=...&state=...
# Handled automatically by the system
```

#### Disconnect OAuth Provider
```http
DELETE /api/auth/providers/{provider}
Authorization: Bearer {accessToken}
```

[⬆ Back to top](#table-of-contents)

## 6. Security Features

### 6.1 Password Security

- **Bcrypt hashing**: Industry-standard password hashing with configurable salt rounds
- **Password complexity**: Enforced requirements for uppercase, lowercase, numbers, and special characters
- **Strength validation**: Integration with zxcvbn for intelligent password strength checking
- **Password history**: Prevent reuse of recent passwords
- **Secure reset flow**: Time-limited tokens with one-time use

```typescript
// Example password validation
import { validatePassword } from '@/lib/auth/password';

const result = validatePassword('MySecureP@ssw0rd', ['user@email.com', 'firstname']);
if (!result.valid) {
  console.error(result.message);
}

// Password requirements enforced:
// - Minimum 8 characters
// - At least one uppercase letter
// - At least one lowercase letter  
// - At least one number
// - At least one special character
// - Not in common password list
// - Not similar to user info
```

For security architecture details, see [Security Documentation](/docs/architecture/security.md#data-security).

### 6.2 Rate Limiting

- **Endpoint-specific limits**: Different rate limits for login, registration, and password reset
- **Redis-backed storage**: Distributed rate limiting across multiple servers
- **IP and user-based**: Rate limiting by both IP address and authenticated user
- **Configurable windows**: Time-based windows with automatic reset

#### Default Rate Limits

| Endpoint | Window | Max Attempts |
|----------|--------|-------------|
| Login | 15 minutes | 5 |
| Register | 1 hour | 3 |
| Password Reset | 1 hour | 3 |
| API Requests | 1 minute | 100 |

For DDoS protection and advanced rate limiting, see [Network Security](/docs/architecture/security.md#network-security).

### 6.3 Two-Factor Authentication (2FA)

- **TOTP-based**: Time-based One-Time Password compatible with Google Authenticator
- **Backup codes**: One-time use recovery codes for account access
- **QR code setup**: Easy setup with QR code scanning
- **Grace period**: 30-second window for clock skew tolerance
- **Optional enforcement**: Can be required for specific roles or all users

```typescript
// 2FA Setup Flow
// 1. Enable 2FA
const { qrCode, backupCodes } = await enable2FA(userId);

// 2. User scans QR code with authenticator app
// 3. Verify setup with code from app
const verified = await verify2FA(userId, '123456');

// 4. Login with 2FA
const loginResult = await login(email, password);
if (loginResult.requiresTwoFactor) {
  // Prompt for 2FA code
  const tokens = await completeLogin(loginResult.userId, twoFactorCode);
}
```

#### Supported 2FA Apps
- Google Authenticator
- Microsoft Authenticator
- Authy
- 1Password
- Any TOTP-compatible app

For implementation details, see the [2FA API endpoints](#63-two-factor-authentication-2fa).

### 6.4 Account Security

- **Account lockout**: Automatic lockout after multiple failed login attempts
- **Suspicious activity detection**: Monitor for new devices, locations, and unusual patterns
- **Security alerts**: Email notifications for important security events
- **Device tracking**: Remember trusted devices and require verification for new ones
- **IP-based geolocation**: Detect and alert on login attempts from new countries

#### Security Events Monitored

- Multiple failed login attempts
- Login from new device or location
- Password changes
- 2FA enablement/disablement
- API key generation
- Permission changes

For incident response procedures, see [Incident Response](/docs/architecture/security.md#incident-response).

### 6.5 Token Security

- **Token rotation**: Automatic refresh token rotation on each use
- **Token blacklisting**: Immediate revocation of compromised tokens
- **Short expiration**: Access tokens expire in 1 hour, refresh tokens in 30 days
- **Secure storage**: Tokens stored in httpOnly cookies or secure client storage
- **Token binding**: Optional binding to device fingerprints

#### Token Lifecycle

1. **Generation**: Tokens created with user claims and permissions
2. **Validation**: Every request validates token signature and expiration
3. **Refresh**: Access tokens refreshed using refresh tokens
4. **Rotation**: Refresh tokens rotated on each use
5. **Revocation**: Tokens can be revoked individually or in bulk

For token implementation details, see [JWT Token Structure](#41-jwt-token-structure).

[⬆ Back to top](#table-of-contents)

## 7. Configuration

### 7.1 Environment Variables

```bash
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=30d

# OAuth Providers
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=https://api.hastecrm.com/auth/google/callback

MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
MICROSOFT_CALLBACK_URL=https://api.hastecrm.com/auth/microsoft/callback

# Email Configuration
EMAIL_FROM=noreply@hastecrm.com
EMAIL_VERIFICATION_URL=https://app.hastecrm.com/auth/verify
PASSWORD_RESET_URL=https://app.hastecrm.com/auth/reset-password

# Security
BCRYPT_ROUNDS=12
SESSION_SECRET=your-session-secret
CORS_ORIGINS=https://app.hastecrm.com,https://www.hastecrm.com

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PREFIX=crm:

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 7.2 Security Headers

The platform implements comprehensive security headers using Helmet.js:

- **Content Security Policy (CSP)**: Prevents XSS attacks by controlling resource loading
- **HTTP Strict Transport Security (HSTS)**: Forces HTTPS connections
- **X-Frame-Options**: Prevents clickjacking attacks
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **Referrer Policy**: Controls referrer information sent with requests

For complete security header configuration, see [Content Security Policy](/docs/architecture/security.md#content-security-policy).

[⬆ Back to top](#table-of-contents)

## 8. Best Practices

### 8.1 Token Management

- Use short-lived access tokens (1 hour)
- Use longer-lived refresh tokens (30 days)
- Implement token rotation on refresh
- Store tokens securely (httpOnly cookies or secure storage)
- Never store tokens in localStorage for sensitive applications

### 8.2 Password Policies

- Enforce strong password requirements
- Implement password history (prevent reuse)
- Require password changes for compromised accounts
- Use secure password reset flows
- Never send passwords in plain text

### 8.3 Session Security

- Implement session timeout (inactivity)
- Allow users to view and revoke sessions
- Log session activity for audit trails
- Detect and alert on suspicious sessions
- Clear sessions on password change

### 8.4 API Security

- Always use HTTPS
- Implement proper CORS policies
- Use API rate limiting
- Validate all input data
- Implement request signing for sensitive operations

### 8.5 Monitoring & Logging

```typescript
// Security event logging
interface SecurityEvent {
  userId?: string;
  type: SecurityEventType;
  ip: string;
  userAgent: string;
  details: Record<string, any>;
  timestamp: Date;
}

enum SecurityEventType {
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  LOGOUT = 'logout',
  PASSWORD_CHANGE = 'password_change',
  PASSWORD_RESET = 'password_reset',
  TWO_FACTOR_ENABLED = '2fa_enabled',
  TWO_FACTOR_DISABLED = '2fa_disabled',
  ACCOUNT_LOCKED = 'account_locked',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  TOKEN_REVOKED = 'token_revoked',
  PERMISSION_DENIED = 'permission_denied'
}

export async function logSecurityEvent(event: SecurityEvent): Promise<void> {
  // Store in database
  await db.securityEvents.create({ data: event });
  
  // Send to monitoring service
  await monitoring.trackEvent('security', event);
  
  // Alert on critical events
  if (isCriticalEvent(event.type)) {
    await alerting.send({
      type: 'security_alert',
      severity: 'high',
      event
    });
  }
}
```

[⬆ Back to top](#table-of-contents)

## 9. Troubleshooting

### 9.1 Common Issues

#### 9.1.1 "Invalid token" errors
- Check token expiration
- Verify JWT secret is correct
- Ensure token hasn't been revoked
- Check for clock skew between servers

#### 9.1.2 "Insufficient permissions" errors
- Verify user's role in workspace
- Check custom permissions
- Ensure resource ownership
- Review permission inheritance

#### 9.1.3 OAuth login failures
- Verify OAuth credentials
- Check callback URLs
- Ensure proper scopes requested
- Review OAuth provider settings

#### 9.1.4 2FA issues
- Verify time sync on devices
- Check backup codes
- Ensure secret is stored correctly
- Review 2FA window settings

### 9.2 Debug Mode

```typescript
// Enable debug logging for auth
if (process.env.AUTH_DEBUG === 'true') {
  app.use((req, res, next) => {
    console.log('Auth Debug:', {
      path: req.path,
      method: req.method,
      headers: {
        authorization: req.headers.authorization?.substring(0, 20) + '...',
        'x-api-key': req.headers['x-api-key']?.substring(0, 20) + '...'
      },
      user: req.user?.id,
      workspace: req.workspaceId
    });
    next();
  });
}
```

### 9.3 Health Checks

```typescript
// Auth system health check
app.get('/api/auth/health', async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    jwt: checkJWTConfig(),
    oauth: await checkOAuthProviders()
  };
  
  const healthy = Object.values(checks).every(c => c.status === 'healthy');
  
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    checks
  });
});
```

[⬆ Back to top](#table-of-contents)

## 10. Related Documentation

- [Security Architecture](/docs/architecture/security.md) - Overall security design and threat model
- [API Design](/docs/architecture/api-design.md) - API security patterns
- [Database Schema](/docs/architecture/database-schema.md) - User and permission data models
- [Deployment Security](/docs/deployment/environments.md) - Environment-specific security settings

[⬆ Back to top](#table-of-contents)

## 11. Conclusion

The authentication and authorization system provides a secure, flexible foundation for hasteCRM. It supports multiple authentication methods, fine-grained permissions, and comprehensive security features. Regular security audits and updates ensure the system remains secure against evolving threats.

[⬆ Back to top](#table-of-contents)