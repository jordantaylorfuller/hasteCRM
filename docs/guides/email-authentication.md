# Email Authentication Guide

## Overview

This guide covers email authentication setup for the hasteCRM platform, including OAuth configuration for various email providers and security best practices.

## Supported Providers

### 1. Google Workspace / Gmail

#### OAuth Setup
1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable Gmail API
3. Configure OAuth consent screen
4. Create OAuth 2.0 credentials

#### Required Scopes
```typescript
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://mail.google.com/',
];
```

#### Implementation
```typescript
// Initialize Google OAuth client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Generate auth URL
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: GMAIL_SCOPES,
  prompt: 'consent',
});

// Exchange code for tokens
const { tokens } = await oauth2Client.getToken(code);
oauth2Client.setCredentials(tokens);
```

### 2. Microsoft 365 / Outlook

#### Azure AD Setup
1. Register app in [Azure Portal](https://portal.azure.com)
2. Configure API permissions
3. Add redirect URIs
4. Generate client secret

#### Required Permissions
```typescript
const OUTLOOK_SCOPES = [
  'Mail.Read',
  'Mail.Send',
  'Mail.ReadWrite',
  'offline_access',
];
```

#### Implementation
```typescript
// MSAL configuration
const msalConfig = {
  auth: {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    authority: 'https://login.microsoftonline.com/common',
  },
};

const cca = new msal.ConfidentialClientApplication(msalConfig);

// Get auth URL
const authCodeUrlParameters = {
  scopes: OUTLOOK_SCOPES,
  redirectUri: process.env.MICROSOFT_REDIRECT_URI,
};

const authUrl = await cca.getAuthCodeUrl(authCodeUrlParameters);
```

### 3. Generic IMAP/SMTP

#### Configuration
```typescript
interface IMAPConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  tls: {
    rejectUnauthorized: boolean;
  };
}

// Common IMAP providers
const IMAP_PRESETS = {
  gmail: {
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
  },
  outlook: {
    host: 'outlook.office365.com',
    port: 993,
    secure: true,
  },
  yahoo: {
    host: 'imap.mail.yahoo.com',
    port: 993,
    secure: true,
  },
};
```

## Security Best Practices

### 1. Token Management

#### Secure Storage
```typescript
// Encrypt tokens before storage
import { encrypt, decrypt } from '@/lib/crypto';

async function storeTokens(userId: string, tokens: OAuth2Tokens) {
  const encrypted = {
    accessToken: encrypt(tokens.access_token),
    refreshToken: encrypt(tokens.refresh_token),
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
  };
  
  await prisma.emailAccount.update({
    where: { userId },
    data: encrypted,
  });
}
```

#### Token Refresh
```typescript
async function refreshAccessToken(account: EmailAccount) {
  try {
    const decryptedRefresh = decrypt(account.refreshToken);
    
    if (account.provider === 'gmail') {
      const { tokens } = await oauth2Client.refreshAccessToken({
        refresh_token: decryptedRefresh,
      });
      
      await storeTokens(account.userId, tokens);
      return tokens.access_token;
    }
    // Handle other providers...
  } catch (error) {
    // Handle refresh failure
    await handleTokenRefreshFailure(account);
    throw error;
  }
}
```

### 2. Rate Limiting

```typescript
// Implement provider-specific rate limits
const RATE_LIMITS = {
  gmail: {
    quota: 250,        // Quota units per user per second
    messages: 25,      // Messages per second
    threads: 10,       // Thread operations per second
  },
  outlook: {
    requests: 10000,   // Requests per 10 minutes
    concurrent: 4,     // Concurrent connections
  },
};

// Rate limiter implementation
const gmailLimiter = new RateLimiter({
  points: RATE_LIMITS.gmail.messages,
  duration: 1, // Per second
  keyPrefix: 'gmail',
});
```

### 3. Error Handling

```typescript
class EmailAuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public provider: string,
    public retryable: boolean = false
  ) {
    super(message);
  }
}

async function handleAuthError(error: any, provider: string) {
  if (error.code === 401 || error.message?.includes('invalid_grant')) {
    throw new EmailAuthError(
      'Authentication expired',
      'AUTH_EXPIRED',
      provider,
      true
    );
  }
  
  if (error.code === 'ECONNREFUSED') {
    throw new EmailAuthError(
      'Connection refused',
      'CONNECTION_ERROR',
      provider,
      true
    );
  }
  
  // Log and throw generic error
  logger.error('Email auth error', { error, provider });
  throw new EmailAuthError(
    'Authentication failed',
    'AUTH_FAILED',
    provider
  );
}
```

## OAuth Flow Implementation

### 1. Authorization Flow
```typescript
// 1. Generate state token
const state = crypto.randomBytes(32).toString('hex');
await redis.setex(`oauth:state:${state}`, 600, userId);

// 2. Redirect to provider
const authUrl = generateAuthUrl(provider, state);
return redirect(authUrl);

// 3. Handle callback
async function handleOAuthCallback(code: string, state: string) {
  // Verify state
  const userId = await redis.get(`oauth:state:${state}`);
  if (!userId) throw new Error('Invalid state');
  
  // Exchange code for tokens
  const tokens = await exchangeCodeForTokens(provider, code);
  
  // Store encrypted tokens
  await storeEmailAccount(userId, provider, tokens);
  
  // Start initial sync
  await queueInitialSync(userId);
}
```

### 2. Connection Testing
```typescript
async function testEmailConnection(account: EmailAccount) {
  try {
    if (account.provider === 'gmail') {
      const gmail = google.gmail({ 
        version: 'v1', 
        auth: await getAuthClient(account) 
      });
      
      await gmail.users.labels.list({ userId: 'me' });
      return { success: true };
    }
    
    if (account.provider === 'imap') {
      const client = await connectIMAP(account);
      await client.openBox('INBOX');
      await client.close();
      return { success: true };
    }
  } catch (error) {
    return { 
      success: false, 
      error: error.message,
      code: error.code,
    };
  }
}
```

## Troubleshooting

### Common Issues

1. **Invalid Grant Error**
   - Token expired or revoked
   - User changed password
   - App permissions changed
   - Solution: Re-authenticate user

2. **Insufficient Scopes**
   - Missing required permissions
   - Solution: Update scope list and re-authenticate

3. **Rate Limit Exceeded**
   - Too many requests
   - Solution: Implement exponential backoff

4. **Connection Timeout**
   - Network issues or firewall
   - Solution: Check connectivity and retry

### Debug Logging
```typescript
// Enable detailed logging for troubleshooting
if (process.env.EMAIL_DEBUG === 'true') {
  logger.debug('OAuth token exchange', {
    provider,
    scopes: tokens.scope,
    expiresIn: tokens.expires_in,
  });
}
```

## Related Documentation
- [Email Sync Feature](../features/email-sync.md)
- [Security Architecture](../architecture/security.md)
- [API Authentication](../api/auth-guide.md)