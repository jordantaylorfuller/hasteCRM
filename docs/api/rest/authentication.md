# Authentication API

## Overview

The Authentication API handles user authentication, session management, and token operations.

## Endpoints

### Login

Authenticate a user and receive access tokens.

```http
POST /v1/auth/login
```

#### Request Body

```json
{
  "email": "user@haste.nyc",
  "password": "your-password"
}
```

#### Response

```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900,
    "tokenType": "Bearer",
    "user": {
      "id": "usr_1234567890",
      "email": "user@haste.nyc",
      "firstName": "John",
      "lastName": "Doe",
      "role": "ADMIN",
      "workspaceId": "ws_1234567890"
    }
  }
}
```

### OAuth Login

Initiate OAuth authentication flow.

```http
GET /v1/auth/oauth/google
```

Redirects to Google OAuth consent page. After authorization, redirects to:

```
https://app.haste.nyc/auth/callback?token=ACCESS_TOKEN
```

### Refresh Token

Exchange a refresh token for new access tokens.

```http
POST /v1/auth/refresh
```

#### Request Body

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### Response

```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900,
    "tokenType": "Bearer"
  }
}
```

### Logout

Invalidate the current session and tokens.

```http
POST /v1/auth/logout
Authorization: Bearer YOUR_ACCESS_TOKEN
```

#### Response

```json
{
  "data": {
    "message": "Successfully logged out"
  }
}
```

### Verify Email

Verify email address using verification token.

```http
POST /v1/auth/verify-email
```

#### Request Body

```json
{
  "token": "verification-token-from-email"
}
```

#### Response

```json
{
  "data": {
    "message": "Email verified successfully",
    "user": {
      "id": "usr_1234567890",
      "email": "user@haste.nyc",
      "emailVerified": true
    }
  }
}
```

### Request Password Reset

Request a password reset email.

```http
POST /v1/auth/forgot-password
```

#### Request Body

```json
{
  "email": "user@haste.nyc"
}
```

#### Response

```json
{
  "data": {
    "message": "Password reset email sent"
  }
}
```

### Reset Password

Reset password using reset token.

```http
POST /v1/auth/reset-password
```

#### Request Body

```json
{
  "token": "reset-token-from-email",
  "password": "new-secure-password"
}
```

#### Response

```json
{
  "data": {
    "message": "Password reset successfully"
  }
}
```

### Get Current User

Retrieve the authenticated user's profile.

```http
GET /v1/auth/me
Authorization: Bearer YOUR_ACCESS_TOKEN
```

#### Response

```json
{
  "data": {
    "id": "usr_1234567890",
    "email": "user@haste.nyc",
    "firstName": "John",
    "lastName": "Doe",
    "avatar": "https://cdn.haste.nyc/avatars/usr_1234567890.jpg",
    "role": "ADMIN",
    "workspace": {
      "id": "ws_1234567890",
      "name": "Acme Corp",
      "plan": "PROFESSIONAL"
    },
    "permissions": [
      "contacts:read",
      "contacts:write",
      "deals:read",
      "deals:write"
    ],
    "createdAt": "2024-01-01T00:00:00Z",
    "lastLoginAt": "2024-01-15T10:30:00Z"
  }
}
```

### Update Password

Change the current user's password.

```http
POST /v1/auth/change-password
Authorization: Bearer YOUR_ACCESS_TOKEN
```

#### Request Body

```json
{
  "currentPassword": "current-password",
  "newPassword": "new-secure-password"
}
```

#### Response

```json
{
  "data": {
    "message": "Password updated successfully"
  }
}
```

## Two-Factor Authentication

### Enable 2FA

Generate 2FA secret and QR code.

```http
POST /v1/auth/2fa/enable
Authorization: Bearer YOUR_ACCESS_TOKEN
```

#### Response

```json
{
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "qrCode": "data:image/png;base64,iVBORw0KGgo...",
    "backupCodes": ["12345678", "87654321", "11223344"]
  }
}
```

### Verify 2FA

Confirm 2FA setup with TOTP code.

```http
POST /v1/auth/2fa/verify
Authorization: Bearer YOUR_ACCESS_TOKEN
```

#### Request Body

```json
{
  "code": "123456"
}
```

#### Response

```json
{
  "data": {
    "message": "Two-factor authentication enabled successfully"
  }
}
```

### Disable 2FA

Disable two-factor authentication.

```http
POST /v1/auth/2fa/disable
Authorization: Bearer YOUR_ACCESS_TOKEN
```

#### Request Body

```json
{
  "password": "current-password"
}
```

### Login with 2FA

When 2FA is enabled, login requires an additional step.

```http
POST /v1/auth/login
```

#### Initial Response (2FA Required)

```json
{
  "data": {
    "requiresTwoFactor": true,
    "tempToken": "temp_token_for_2fa"
  }
}
```

#### Complete 2FA Login

```http
POST /v1/auth/2fa/login
```

#### Request Body

```json
{
  "tempToken": "temp_token_for_2fa",
  "code": "123456"
}
```

## Session Management

### List Active Sessions

Get all active sessions for the current user.

```http
GET /v1/auth/sessions
Authorization: Bearer YOUR_ACCESS_TOKEN
```

#### Response

```json
{
  "data": [
    {
      "id": "sess_1234567890",
      "deviceName": "Chrome on MacOS",
      "ipAddress": "192.168.1.1",
      "location": "San Francisco, CA",
      "lastActive": "2024-01-15T10:30:00Z",
      "current": true
    }
  ]
}
```

### Revoke Session

Terminate a specific session.

```http
DELETE /v1/auth/sessions/:sessionId
Authorization: Bearer YOUR_ACCESS_TOKEN
```

## Error Responses

### Invalid Credentials

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

### Account Locked

```json
{
  "error": {
    "code": "ACCOUNT_LOCKED",
    "message": "Account is temporarily locked due to too many failed attempts",
    "details": {
      "lockedUntil": "2024-01-15T11:00:00Z"
    }
  }
}
```

### Email Not Verified

```json
{
  "error": {
    "code": "EMAIL_NOT_VERIFIED",
    "message": "Please verify your email address before logging in"
  }
}
```

## Security Notes

1. Tokens expire after 15 minutes (configurable)
2. Refresh tokens expire after 7 days
3. Failed login attempts are rate-limited
4. Account lockout after 5 failed attempts
5. All passwords must meet complexity requirements:
   - Minimum 8 characters
   - At least one uppercase letter
   - At least one lowercase letter
   - At least one number
   - At least one special character
