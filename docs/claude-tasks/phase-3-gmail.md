# Phase 3: Gmail Integration

## Overview
Phase 3 implements comprehensive Gmail integration, enabling users to sync emails, manage conversations, and automate email-based workflows directly within hasteCRM. This phase builds upon the contact management foundation to create a unified communication hub.

## Goals
- Implement secure OAuth2 Gmail authentication
- Enable two-way email synchronization
- Create unified inbox experience
- Track email interactions with contacts
- Build email templates and automation
- Implement email analytics and insights

## Prerequisites
- Phase 1: Foundation (authentication, database, API)
- Phase 2: Contact Management (contact database, activity tracking)
- Google Cloud Platform account with Gmail API enabled

## Tasks

### 1. Gmail OAuth2 Setup
- [ ] Register application with Google Cloud Console
- [ ] Implement OAuth2 flow for Gmail access
- [ ] Store and manage refresh tokens securely
- [ ] Handle token refresh automatically
- [ ] Implement scope management (read, compose, send)
- [ ] Create disconnect/revoke access functionality

### 2. Email Synchronization Engine
- [ ] Design email storage schema
  - Emails table
  - Attachments table
  - Email-contact relationships
- [ ] Implement Gmail API webhook for real-time updates
- [ ] Create batch sync for historical emails
- [ ] Handle email threading and conversations
- [ ] Implement incremental sync strategy
- [ ] Add conflict resolution for concurrent updates

### 3. Email Data Processing
- [ ] Parse email headers and metadata
- [ ] Extract and link email addresses to contacts
- [ ] Implement attachment handling and storage
- [ ] Create email content indexing for search
- [ ] Handle email labels and categories
- [ ] Process email signatures and extract contact info

### 4. Unified Inbox Interface
- [ ] Create inbox API endpoints
- [ ] Implement email filtering and sorting
- [ ] Add conversation grouping
- [ ] Create unread/read status management
- [ ] Implement starring and importance markers
- [ ] Add multi-account support

### 5. Email Composition & Sending
- [ ] Create email composer API
- [ ] Implement draft management
- [ ] Add email template system
- [ ] Handle recipient validation
- [ ] Implement CC/BCC functionality
- [ ] Add attachment upload support
- [ ] Create send later/scheduling feature

### 6. Email Templates
- [ ] Design template storage system
- [ ] Create template variables/placeholders
- [ ] Implement personalization tokens
- [ ] Add template categories and organization
- [ ] Create template sharing within organization
- [ ] Build template analytics

### 7. Email Tracking
- [ ] Implement email open tracking
- [ ] Add link click tracking
- [ ] Create tracking pixel system
- [ ] Handle privacy and consent
- [ ] Build tracking analytics dashboard
- [ ] Add opt-out mechanisms

### 8. Email Automation
- [ ] Create email sequence builder
- [ ] Implement trigger-based sending
- [ ] Add conditional logic for sequences
- [ ] Create follow-up reminders
- [ ] Implement auto-responders
- [ ] Build email workflow engine

### 9. Contact Integration
- [ ] Link emails to contact timeline
- [ ] Create email-based contact creation
- [ ] Implement conversation history view
- [ ] Add email interaction scoring
- [ ] Create contact email preferences
- [ ] Build communication frequency analysis

### 10. Search & Analytics
- [ ] Implement full-text email search
- [ ] Create advanced search filters
- [ ] Build email analytics dashboard
  - Send/receive volumes
  - Response rates
  - Engagement metrics
- [ ] Add email performance reports
- [ ] Create team email analytics

### 11. Security & Compliance
- [ ] Implement email encryption at rest
- [ ] Add data retention policies
- [ ] Create audit trail for email access
- [ ] Implement GDPR compliance features
- [ ] Add email archiving system
- [ ] Handle email deletion and purging

### 12. Performance Optimization
- [ ] Implement email caching strategy
- [ ] Optimize database queries for email data
- [ ] Add pagination for large email lists
- [ ] Create background job system for sync
- [ ] Implement rate limit handling
- [ ] Add circuit breaker for API failures

## Database Schema

### Core Tables
```sql
-- Email accounts
CREATE TABLE email_accounts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  email_address VARCHAR(255) NOT NULL,
  provider VARCHAR(50) DEFAULT 'gmail',
  access_token TEXT ENCRYPTED,
  refresh_token TEXT ENCRYPTED,
  token_expires_at TIMESTAMP,
  sync_state JSONB,
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, email_address)
);

-- Emails
CREATE TABLE emails (
  id UUID PRIMARY KEY,
  account_id UUID REFERENCES email_accounts(id),
  gmail_id VARCHAR(255) UNIQUE,
  thread_id UUID REFERENCES email_threads(id),
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  from_address VARCHAR(255),
  from_name VARCHAR(255),
  sent_at TIMESTAMP,
  received_at TIMESTAMP,
  is_read BOOLEAN DEFAULT false,
  is_starred BOOLEAN DEFAULT false,
  labels TEXT[],
  raw_headers JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Email threads
CREATE TABLE email_threads (
  id UUID PRIMARY KEY,
  gmail_thread_id VARCHAR(255) UNIQUE,
  account_id UUID REFERENCES email_accounts(id),
  subject TEXT,
  participant_emails TEXT[],
  last_message_at TIMESTAMP,
  message_count INTEGER DEFAULT 0,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Email recipients
CREATE TABLE email_recipients (
  id UUID PRIMARY KEY,
  email_id UUID REFERENCES emails(id),
  type VARCHAR(10) CHECK (type IN ('to', 'cc', 'bcc')),
  email_address VARCHAR(255),
  name VARCHAR(255),
  contact_id UUID REFERENCES contacts(id)
);

-- Email attachments
CREATE TABLE email_attachments (
  id UUID PRIMARY KEY,
  email_id UUID REFERENCES emails(id),
  filename VARCHAR(255),
  content_type VARCHAR(100),
  size_bytes INTEGER,
  storage_url TEXT,
  gmail_attachment_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Email templates
CREATE TABLE email_templates (
  id UUID PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  variables JSONB,
  category VARCHAR(100),
  is_shared BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Email tracking
CREATE TABLE email_tracking (
  id UUID PRIMARY KEY,
  email_id UUID REFERENCES emails(id),
  tracking_id VARCHAR(255) UNIQUE,
  opens INTEGER DEFAULT 0,
  clicks JSONB DEFAULT '[]',
  first_opened_at TIMESTAMP,
  last_opened_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Indexes
```sql
-- Performance indexes
CREATE INDEX idx_emails_account_received ON emails(account_id, received_at DESC);
CREATE INDEX idx_emails_thread ON emails(thread_id, sent_at DESC);
CREATE INDEX idx_emails_from ON emails(from_address);
CREATE INDEX idx_emails_gmail_id ON emails(gmail_id);
CREATE INDEX idx_email_recipients_email ON email_recipients(email_address);
CREATE INDEX idx_email_recipients_contact ON email_recipients(contact_id);
CREATE INDEX idx_email_threads_account ON email_threads(account_id, last_message_at DESC);

-- Full-text search indexes
CREATE INDEX idx_emails_subject_fts ON emails USING gin(to_tsvector('english', subject));
CREATE INDEX idx_emails_body_fts ON emails USING gin(to_tsvector('english', body_text));
```

## API Endpoints

### REST API
```
# Authentication
POST   /api/gmail/connect
DELETE /api/gmail/disconnect
GET    /api/gmail/accounts
PUT    /api/gmail/accounts/:id/sync

# Email Operations
GET    /api/emails?page=1&limit=50&filter[unread]=true
GET    /api/emails/:id
POST   /api/emails/send
POST   /api/emails/draft
PUT    /api/emails/:id/read
PUT    /api/emails/:id/star
DELETE /api/emails/:id
POST   /api/emails/:id/archive
POST   /api/emails/:id/labels

# Email Search
GET    /api/emails/search?q=subject:invoice&from=john@example.com
GET    /api/emails/threads/:threadId

# Templates
GET    /api/email-templates
POST   /api/email-templates
PUT    /api/email-templates/:id
DELETE /api/email-templates/:id
POST   /api/email-templates/:id/preview

# Analytics
GET    /api/email-analytics/overview
GET    /api/email-analytics/sent?period=30d
GET    /api/email-analytics/tracking/:emailId

# Bulk Operations
POST   /api/emails/bulk/read
POST   /api/emails/bulk/archive
POST   /api/emails/bulk/delete
```

### WebSocket Events
```javascript
// Real-time email updates
ws.on('email:new', (data) => { /* New email received */ });
ws.on('email:updated', (data) => { /* Email status changed */ });
ws.on('email:deleted', (data) => { /* Email deleted */ });
ws.on('sync:progress', (data) => { /* Sync progress update */ });
```

### GraphQL Schema
```graphql
type Email {
  id: ID!
  subject: String
  bodyText: String
  bodyHtml: String
  from: EmailAddress!
  to: [EmailAddress!]!
  cc: [EmailAddress!]
  bcc: [EmailAddress!]
  sentAt: DateTime
  receivedAt: DateTime
  thread: EmailThread
  attachments: [Attachment!]
  contact: Contact
  isRead: Boolean!
  isStarred: Boolean!
  labels: [String!]
  tracking: EmailTracking
}

type EmailThread {
  id: ID!
  subject: String
  emails(first: Int, after: String): EmailConnection!
  participants: [Contact!]!
  lastActivity: DateTime!
  messageCount: Int!
  isArchived: Boolean!
}

type EmailAddress {
  email: String!
  name: String
  contact: Contact
}

type Attachment {
  id: ID!
  filename: String!
  contentType: String!
  sizeBytes: Int!
  url: String!
}

type EmailTracking {
  opens: Int!
  clicks: [ClickEvent!]!
  firstOpened: DateTime
  lastOpened: DateTime
}

input SendEmailInput {
  to: [String!]!
  cc: [String]
  bcc: [String]
  subject: String!
  bodyHtml: String!
  bodyText: String
  attachmentIds: [ID]
  templateId: ID
  templateVariables: JSON
  scheduleSendAt: DateTime
}
```

## Success Criteria
- Users can connect Gmail accounts securely
- Emails sync in real-time without data loss
- Email search and filtering work efficiently
- Templates and automation increase productivity
- System handles 10,000+ emails per account
- Email tracking provides actionable insights

## Technical Considerations

### Performance Optimization
- Use Gmail API batch requests (up to 100 requests per batch)
- Implement exponential backoff with jitter for rate limits
- Store attachments in object storage (S3/GCS) with CDN
- Use message queues (Bull/BullMQ) for async processing
- Implement multi-layer caching:
  - Redis for hot data (recent emails, active threads)
  - Database materialized views for aggregations
  - CDN for attachment delivery

### Sync Strategy
- Initial sync: Use history API to fetch all messages
- Incremental sync: Use Gmail push notifications (Pub/Sub)
- Delta sync: Track historyId for efficient updates
- Batch size: 50 messages per request
- Sync frequency: Real-time via push, fallback to 5-minute polling

### Rate Limiting
- Gmail API quota: 250 quota units per user per second
- Implement token bucket algorithm for rate limiting
- Queue overflow handling with priority system
- Graceful degradation when limits reached

### Error Handling
```typescript
interface EmailError {
  code: string;
  message: string;
  retryable: boolean;
  retryAfter?: number;
}

// Error categories
- Transient: Network, rate limit, temporary Gmail issues
- Permanent: Invalid credentials, permission denied
- Data: Malformed email, attachment too large
```

## Security Requirements

### Authentication & Authorization
- Encrypt OAuth tokens using AES-256-GCM
- Store refresh tokens in secure vault (HashiCorp Vault)
- Implement least-privilege Gmail scopes:
  - `gmail.readonly` for basic sync
  - `gmail.send` only when needed
  - `gmail.modify` for marking read/unread
- Token rotation every 30 days
- Implement OAuth PKCE flow for added security

### Data Protection
- Encrypt email content at rest using envelope encryption
- TLS 1.3 for all API communications
- Implement field-level encryption for sensitive data
- Email content sanitization:
  - Strip tracking pixels from competitors
  - Remove potentially malicious scripts
  - Validate all URLs
  - Sanitize HTML content (DOMPurify)

### Compliance
- GDPR compliance:
  - Right to erasure implementation
  - Data portability API
  - Consent management for tracking
- CAN-SPAM compliance:
  - Unsubscribe link enforcement
  - Sender identification validation
- Data retention:
  - 90-day default retention
  - Configurable per organization
  - Automatic purging of deleted items

### Audit & Monitoring
- Log all email access with user, timestamp, action
- Implement anomaly detection for unusual access patterns
- Real-time alerts for security events
- Monthly security audit reports

## Dependencies
- Gmail API v1
- Google OAuth2 libraries
- Email parsing libraries (e.g., mailparser)
- Object storage service (S3/GCS)
- Redis for caching
- Background job processor (Bull/BullMQ)

## Timeline
Estimated duration: 3-4 weeks

## Error Handling Strategy

### Error Categories
```typescript
enum EmailErrorType {
  AUTH_FAILED = 'AUTH_FAILED',
  RATE_LIMITED = 'RATE_LIMITED',
  SYNC_FAILED = 'SYNC_FAILED',
  SEND_FAILED = 'SEND_FAILED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  INVALID_REQUEST = 'INVALID_REQUEST',
  NETWORK_ERROR = 'NETWORK_ERROR'
}
```

### Retry Strategy
- Exponential backoff: 1s, 2s, 4s, 8s, 16s
- Max retries: 5 for transient errors
- Circuit breaker: Open after 10 consecutive failures
- Dead letter queue for permanent failures

### User-Facing Messages
```javascript
const errorMessages = {
  AUTH_FAILED: "Please reconnect your Gmail account",
  RATE_LIMITED: "Syncing paused due to Gmail limits. Will resume shortly.",
  SYNC_FAILED: "Unable to sync emails. Our team has been notified.",
  SEND_FAILED: "Email could not be sent. Please try again.",
  QUOTA_EXCEEDED: "Daily email limit reached. Resets at midnight PST."
};
```

## Testing Strategy

### Unit Tests
- Email parser edge cases
- OAuth flow scenarios
- Database query optimization
- Error handling paths
- Template variable substitution

### Integration Tests
- Gmail API mock server
- Full sync workflow
- Email send/receive cycle
- Attachment handling
- Real-time update flow

### Performance Tests
- Load test: 10,000 emails per account
- Concurrent user simulation: 1,000 users
- Sync performance benchmarks
- Search query optimization
- API response time targets: <200ms p95

### Security Tests
- OAuth token handling
- XSS prevention in email display
- SQL injection in search
- Rate limit enforcement
- Access control verification

## Monitoring & Operations

### Key Metrics
- Sync lag: Time between Gmail receipt and CRM availability
- API success rate: Target >99.9%
- Email send success rate
- Search query performance: p95 <500ms
- Storage usage per account

### Alerts
- Sync failures > 5% (critical)
- API errors > 1% (warning)
- Storage usage > 80% (warning)
- Rate limit approaching (info)
- Authentication failures spike (critical)

### Dashboards
- Real-time sync status
- Email volume trends
- Error rate by type
- Performance metrics
- User activity patterns

## Advanced Features

### Smart Email Categorization
- ML-based email classification
- Auto-tagging for follow-ups
- Priority inbox algorithm
- Sentiment analysis integration

### Email Intelligence
- Meeting detection and calendar sync
- Action item extraction
- Contact information parsing
- Signature block analysis
- Email thread summarization

### Productivity Tools
- Email snooze with smart suggestions
- Send later with optimal time prediction
- Template recommendation engine
- Quick reply suggestions
- Bulk email operations

## User Experience

### Onboarding Flow
1. Gmail connection explanation
2. Permission scope details
3. Initial sync progress (with time estimate)
4. Quick tour of email features
5. Template setup wizard

### Settings & Preferences
- Sync frequency options
- Email notification preferences
- Tracking consent management
- Signature configuration
- Vacation responder
- Email aliases support

## Risks & Mitigations
- **Risk**: Gmail API rate limits
  - **Mitigation**: Intelligent batching, caching, and backoff strategies
  - **Monitoring**: Real-time quota tracking dashboard
- **Risk**: Large email volumes affecting performance
  - **Mitigation**: Pagination, lazy loading, and progressive enhancement
  - **Monitoring**: Performance metrics and auto-scaling
- **Risk**: OAuth token expiration
  - **Mitigation**: Proactive refresh 24h before expiry
  - **Monitoring**: Token health dashboard
- **Risk**: Email data loss during sync
  - **Mitigation**: Idempotent operations, transaction logs
  - **Monitoring**: Data integrity checks
- **Risk**: Compliance violations
  - **Mitigation**: Automated compliance checks, audit trails
  - **Monitoring**: Compliance dashboard

## Next Phase
Phase 4: AI Integration - Leveraging email data for intelligent insights and automation