# Security Best Practices

## Overview

This guide outlines security best practices for hasteCRM in production. Follow these guidelines to maintain a secure, compliant platform.

## Authentication & Authorization

### JWT Configuration

```typescript
// ✅ SECURE: Use RS256 with proper key rotation
const jwtConfig = {
  algorithm: 'RS256',
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
  issuer: 'https://api.haste.nyc',
  audience: 'https://www.haste.nyc',
  keyRotationInterval: '90d'
};

// ❌ INSECURE: Never use HS256 in production
```

### OAuth2 Configuration

```yaml
# Production OAuth2 settings
google:
  client_id: ${GOOGLE_CLIENT_ID}
  client_secret: ${GOOGLE_CLIENT_SECRET}
  redirect_uri: https://api.haste.nyc/auth/google/callback
  scopes:
    - openid
    - email
    - profile
  # Security: Always validate state parameter
  state_validation: required
  # Security: Use PKCE for additional protection
  pkce: enabled
```

### Password Requirements

```typescript
const passwordPolicy = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommonPasswords: true,
  preventUserInfo: true,
  maxAge: '90d',
  historyCount: 5
};
```

## Data Protection

### Encryption at Rest

```yaml
# PostgreSQL encryption
postgresql:
  encryption:
    enabled: true
    method: "TDE"  # Transparent Data Encryption
    key_provider: "AWS_KMS"
    key_rotation: "90d"

# File storage encryption
s3:
  encryption:
    enabled: true
    algorithm: "AES256"
    kms_key_id: ${AWS_KMS_KEY_ID}
```

### Encryption in Transit

```yaml
# TLS configuration
tls:
  min_version: "1.3"
  cipher_suites:
    - "TLS_AES_256_GCM_SHA384"
    - "TLS_CHACHA20_POLY1305_SHA256"
    - "TLS_AES_128_GCM_SHA256"
  certificate_transparency: required
  ocsp_stapling: enabled
```

### PII Handling

```typescript
// Mask sensitive data in logs
const sanitizeLog = (data: any): any => {
  const sensitive = ['email', 'phone', 'ssn', 'creditCard'];
  return maskFields(data, sensitive);
};

// Encrypt PII fields in database
@Column({ 
  transformer: {
    to: (value: string) => encrypt(value),
    from: (value: string) => decrypt(value)
  }
})
email: string;
```

## API Security

### Rate Limiting

```typescript
// Configure rate limiting per endpoint
const rateLimits = {
  '/api/auth/login': {
    window: '15m',
    max: 5,
    skipSuccessful: false
  },
  '/api/graphql': {
    window: '1m',
    max: 100,
    skipSuccessful: true
  },
  '/api/export': {
    window: '1h',
    max: 10,
    skipSuccessful: true
  }
};
```

### Input Validation

```typescript
// Always validate and sanitize input
import { IsEmail, IsUUID, MaxLength, Matches } from 'class-validator';
import DOMPurify from 'isomorphic-dompurify';

export class CreateContactDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @MaxLength(100)
  @Matches(/^[a-zA-Z\s\-']+$/)
  firstName: string;

  @Transform(({ value }) => DOMPurify.sanitize(value))
  bio: string;
}
```

### CORS Configuration

```typescript
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'https://www.haste.nyc',
      'https://app.haste.nyc'
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  maxAge: 86400 // 24 hours
};
```

## Infrastructure Security

### Network Segmentation

```yaml
# VPC configuration
vpc:
  cidr: "10.0.0.0/16"
  
  subnets:
    public:
      - cidr: "10.0.1.0/24"
        services: ["load_balancer", "nat_gateway"]
    
    private:
      - cidr: "10.0.10.0/24"
        services: ["api", "worker"]
    
    database:
      - cidr: "10.0.20.0/24"
        services: ["postgresql", "redis", "elasticsearch"]
```

### Security Groups

```yaml
# Database security group
database_sg:
  ingress:
    - protocol: tcp
      port: 5432
      source: "app_security_group"
      description: "PostgreSQL from app tier"
  
  egress: []  # No outbound connections

# Application security group  
app_sg:
  ingress:
    - protocol: tcp
      port: 4000
      source: "alb_security_group"
      description: "API from ALB"
  
  egress:
    - protocol: tcp
      port: 5432
      destination: "database_security_group"
    - protocol: tcp
      port: 443
      destination: "0.0.0.0/0"
      description: "HTTPS for external APIs"
```

### Secrets Management

```yaml
# Use HashiCorp Vault or AWS Secrets Manager
secrets:
  provider: "aws_secrets_manager"
  
  rotation:
    database_password: "30d"
    api_keys: "90d"
    jwt_keys: "90d"
  
  access:
    method: "iam_role"
    audit: enabled
```

## Application Security

### Dependency Management

```json
{
  "scripts": {
    "audit": "pnpm audit --audit-level=high",
    "audit:fix": "pnpm audit fix",
    "outdated": "pnpm outdated",
    "update:security": "pnpm update --depth 9999"
  },
  "husky": {
    "hooks": {
      "pre-commit": "pnpm audit"
    }
  }
}
```

### Security Headers

```typescript
// Helmet.js configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.haste.nyc"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.haste.nyc"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'none'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### SQL Injection Prevention

```typescript
// ✅ SECURE: Use parameterized queries
const user = await prisma.user.findFirst({
  where: {
    email: userEmail,
    workspace: { id: workspaceId }
  }
});

// ❌ INSECURE: Never use string concatenation
const query = `SELECT * FROM users WHERE email = '${userEmail}'`;
```

## Monitoring & Incident Response

### Security Monitoring

```yaml
monitoring:
  siem:
    provider: "datadog"
    
    alerts:
      - name: "Multiple failed login attempts"
        query: "status:401 AND endpoint:/api/auth/login"
        threshold: 5
        window: "5m"
      
      - name: "Unusual API activity"
        query: "rate > 1000 AND user.role:user"
        threshold: 1
        window: "1m"
      
      - name: "Potential data exfiltration"
        query: "endpoint:/api/export AND response.size > 100MB"
        threshold: 1
        window: "1h"
```

### Incident Response Plan

1. **Detection**: Alert triggered
2. **Triage**: Assess severity and impact
3. **Containment**: Isolate affected systems
4. **Investigation**: Identify root cause
5. **Remediation**: Fix vulnerability
6. **Recovery**: Restore normal operations
7. **Post-Mortem**: Document and learn

### Audit Logging

```typescript
// Comprehensive audit logging
@Injectable()
export class AuditService {
  async logSecurityEvent(event: SecurityEvent) {
    await this.auditLog.create({
      timestamp: new Date(),
      userId: event.userId,
      action: event.action,
      resource: event.resource,
      ip: event.ip,
      userAgent: event.userAgent,
      result: event.result,
      metadata: this.sanitizeMetadata(event.metadata)
    });
  }
}

// Events to log
const securityEvents = [
  'LOGIN_SUCCESS',
  'LOGIN_FAILURE',
  'PASSWORD_RESET',
  'PERMISSION_DENIED',
  'DATA_EXPORT',
  'API_KEY_CREATED',
  'USER_SUSPENDED'
];
```

## Compliance

### GDPR Compliance

```typescript
// Data retention policies
const retentionPolicies = {
  user_data: '3 years after account closure',
  activity_logs: '1 year',
  audit_logs: '7 years',
  email_content: '6 months',
  deleted_data: '30 days (soft delete)'
};

// Right to erasure
async function deleteUserData(userId: string) {
  await Promise.all([
    anonymizeUser(userId),
    deleteEmails(userId),
    deleteActivities(userId),
    removeFromSearchIndex(userId)
  ]);
}
```

### Security Training

All team members must complete:
- [ ] OWASP Top 10 training
- [ ] Secure coding practices
- [ ] Incident response procedures
- [ ] Data handling policies
- [ ] Social engineering awareness

## Security Checklist

### Daily
- [ ] Review security alerts
- [ ] Check failed login attempts
- [ ] Monitor API rate limits

### Weekly
- [ ] Review access logs
- [ ] Check for security updates
- [ ] Verify backup integrity

### Monthly
- [ ] Rotate service credentials
- [ ] Review user permissions
- [ ] Security training updates
- [ ] Penetration testing (quarterly)

### Annually
- [ ] Full security audit
- [ ] Disaster recovery drill
- [ ] Policy review and update
- [ ] Third-party security assessment