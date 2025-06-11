# Authentication Guide

## Overview

All hasteCRM APIs use a unified authentication system based on JWT tokens with support for multiple authentication methods.

## Authentication Methods

### 1. Email/Password Authentication

```bash
# Login
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure-password"
}

# Response
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600,
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "workspaceId": "workspace_456"
  }
}
```

### 2. API Key Authentication

For server-to-server communication:

```bash
# Using API Key
GET /api/v1/contacts
X-API-Key: ak_live_xxxxxxxxxxxxxxxxxxx
```

### 3. OAuth 2.0

Supported providers:
- Google
- Microsoft
- GitHub

```bash
# Initiate OAuth flow
GET /api/v1/auth/google?redirect_uri=https://app.example.com/callback

# Handle callback
GET /api/v1/auth/google/callback?code=xxx&state=yyy
```

## Using Authentication

### GraphQL

```javascript
// With Apollo Client
const client = new ApolloClient({
  uri: 'https://api.haste.nyc/graphql',
  headers: {
    authorization: `Bearer ${accessToken}`
  }
});

// With fetch
const response = await fetch('https://api.haste.nyc/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`
  },
  body: JSON.stringify({ query, variables })
});
```

### REST API

```javascript
// With axios
const api = axios.create({
  baseURL: 'https://api.haste.nyc/v1',
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});

// With fetch
const response = await fetch('https://api.haste.nyc/v1/contacts', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

### WebSocket

```javascript
// With Socket.IO
const socket = io('wss://api.haste.nyc', {
  auth: {
    token: accessToken
  }
});

// Native WebSocket
const ws = new WebSocket(`wss://api.haste.nyc/ws?token=${accessToken}`);
```

## Token Management

### Token Structure

Access tokens contain:
```json
{
  "sub": "user_123",
  "email": "user@example.com", 
  "workspaceId": "workspace_456",
  "permissions": ["read:contacts", "write:contacts"],
  "exp": 1641826800,
  "iat": 1641823200
}
```

### Token Lifecycle

- **Access Token**: 1 hour expiration
- **Refresh Token**: 7 days expiration (rotating)
- **API Keys**: No expiration (revocable)

### Refreshing Tokens

```javascript
// Refresh expired token
async function refreshAccessToken(refreshToken) {
  const response = await fetch('/api/v1/auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refreshToken })
  });
  
  const data = await response.json();
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken // New rotating refresh token
  };
}
```

## Multi-Factor Authentication (MFA)

### Enabling MFA

```bash
POST /api/v1/auth/mfa/enable
Authorization: Bearer {token}

# Response includes QR code for authenticator app
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,..."
}
```

### Using MFA

```bash
POST /api/v1/auth/login
{
  "email": "user@example.com",
  "password": "password",
  "mfaCode": "123456"
}
```

## API Key Management

### Creating API Keys

```bash
POST /api/v1/api-keys
Authorization: Bearer {token}
{
  "name": "Production Server",
  "permissions": ["read:contacts", "write:contacts"],
  "expiresAt": "2024-12-31T23:59:59Z"
}

# Response
{
  "id": "key_123",
  "key": "ak_live_xxxxxxxxxxxxxxxxxxx", # Only shown once!
  "name": "Production Server",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

### API Key Best Practices

1. **Never expose keys in client-side code**
2. **Use environment variables**
3. **Rotate keys regularly**
4. **Use minimal permissions**
5. **Set expiration dates**

## Permissions & Scopes

### Available Scopes

| Scope | Description |
|-------|-------------|
| `read:contacts` | View contacts |
| `write:contacts` | Create/update contacts |
| `delete:contacts` | Delete contacts |
| `read:deals` | View deals |
| `write:deals` | Create/update deals |
| `read:emails` | View emails |
| `send:emails` | Send emails |
| `read:analytics` | View analytics |
| `admin:workspace` | Admin access |

### Checking Permissions

```javascript
// Client-side check
function hasPermission(user, scope) {
  return user.permissions.includes(scope);
}

// Server-side middleware
function requirePermission(scope) {
  return (req, res, next) => {
    if (!req.user.permissions.includes(scope)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions' 
      });
    }
    next();
  };
}
```

## Security Best Practices

### 1. Token Storage

**Do:**
- Store tokens in httpOnly cookies
- Use secure flag in production
- Implement CSRF protection

**Don't:**
- Store tokens in localStorage (XSS vulnerable)
- Include tokens in URLs
- Log tokens

### 2. Token Transmission

**Do:**
- Always use HTTPS
- Send tokens in Authorization header
- Validate tokens on every request

**Don't:**
- Send tokens in query parameters
- Use custom headers without prefix
- Trust client-side validation

### 3. Session Management

```javascript
// Implement token blacklisting for logout
async function logout(token) {
  const decoded = jwt.decode(token);
  await redis.setex(
    `blacklist:${decoded.jti}`,
    decoded.exp - Math.floor(Date.now() / 1000),
    'true'
  );
}

// Check blacklist on each request
async function isTokenBlacklisted(token) {
  const decoded = jwt.decode(token);
  return await redis.exists(`blacklist:${decoded.jti}`);
}
```

## Error Handling

### Common Authentication Errors

| Code | Message | Description |
|------|---------|-------------|
| `INVALID_CREDENTIALS` | Invalid email or password | Login failed |
| `TOKEN_EXPIRED` | Access token expired | Refresh required |
| `TOKEN_INVALID` | Invalid token format | Malformed JWT |
| `MFA_REQUIRED` | MFA code required | 2FA enabled |
| `INSUFFICIENT_PERMISSIONS` | Insufficient permissions | Missing scope |

### Error Response Format

```json
{
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Access token has expired",
    "details": {
      "expiredAt": "2024-01-01T12:00:00Z"
    }
  }
}
```

## Testing Authentication

### Test Credentials

```bash
# Development environment only
Email: test@example.com
Password: test123
API Key: ak_test_xxxxxxxxxxxx
```

### Testing Tools

```bash
# Test login
curl -X POST https://api.haste.nyc/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Test authenticated request
curl https://api.haste.nyc/v1/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Migration Guide

### From v1 to v2

1. **Token Format**: Now includes workspace ID
2. **Refresh Tokens**: Now rotate on use
3. **API Keys**: New prefix format `ak_live_`
4. **Permissions**: Granular scopes instead of roles

See [API Changelog](./CHANGELOG.md) for details.