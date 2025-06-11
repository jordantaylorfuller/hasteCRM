# Phase 6: Email Outreach & Sequences

## Overview

Phase 6 implements sophisticated email outreach capabilities with multi-step sequences, personalization, A/B testing, and comprehensive analytics. This phase transforms hasteCRM into a powerful sales engagement platform while maintaining deliverability and compliance.

## Core Features

### 1. Email Sequences

#### Sequence Builder
- Visual sequence designer
- Multi-step campaigns
- Conditional branching
- Time-based delays
- Action-based triggers

```typescript
interface EmailSequence {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  
  // Configuration
  settings: {
    timezone: string;
    sendingDays: string[]; // ['mon', 'tue', 'wed', 'thu', 'fri']
    sendingHours: {
      start: string; // '09:00'
      end: string;   // '17:00'
    };
    replyHandling: 'pause' | 'continue' | 'stop';
    bounceHandling: 'pause' | 'stop';
  };
  
  // Steps
  steps: SequenceStep[];
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  stats?: SequenceStats;
}

interface SequenceStep {
  id: string;
  type: 'email' | 'task' | 'linkedin' | 'call' | 'sms';
  order: number;
  
  // Timing
  delay: {
    value: number;
    unit: 'hours' | 'days' | 'weeks';
  };
  
  // Content
  content: StepContent;
  
  // Conditions
  conditions?: StepCondition[];
  
  // A/B Testing
  variants?: StepVariant[];
}
```

### 2. Email Templates

#### Template Management
- Rich HTML editor
- Plain text fallback
- Template variables
- Snippet library
- Template sharing

```typescript
interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  
  // Personalization
  variables: TemplateVariable[];
  snippets: string[]; // Reusable content blocks
  
  // Categorization
  category: 'sales' | 'marketing' | 'support' | 'custom';
  tags: string[];
  
  // Performance
  stats?: {
    sent: number;
    opened: number;
    clicked: number;
    replied: number;
    avgOpenRate: number;
    avgClickRate: number;
  };
}

interface TemplateVariable {
  name: string;
  fallback?: string;
  source: 'contact' | 'company' | 'deal' | 'custom';
  field: string;
}
```

### 3. Personalization Engine

#### Dynamic Variables
- Contact fields
- Company data
- Custom properties
- Conditional content
- Dynamic snippets

#### Smart Personalization
```typescript
interface PersonalizationEngine {
  // Variable replacement
  replaceVariables(template: string, context: PersonalizationContext): string;
  
  // Conditional content
  evaluateConditions(conditions: ContentCondition[], context: PersonalizationContext): boolean;
  
  // Dynamic snippets
  selectSnippet(snippetGroup: string, context: PersonalizationContext): string;
  
  // Fallback handling
  handleMissingData(variable: string, fallback?: string): string;
}

interface PersonalizationContext {
  contact: Contact;
  company?: Company;
  deal?: Deal;
  sender: User;
  customData?: Record<string, any>;
}
```

### 4. Sending Infrastructure

#### Email Delivery
- Multiple sending accounts
- Domain authentication (SPF, DKIM, DMARC)
- IP warming
- Rate limiting
- Bounce handling

```typescript
interface SendingAccount {
  id: string;
  provider: 'gmail' | 'outlook' | 'smtp' | 'sendgrid' | 'mailgun';
  email: string;
  displayName: string;
  
  // Limits
  dailyLimit: number;
  hourlyLimit: number;
  currentUsage: {
    daily: number;
    hourly: number;
    resetAt: Date;
  };
  
  // Health
  reputation: number; // 0-100
  bounceRate: number;
  spamRate: number;
  
  // Authentication
  spf: boolean;
  dkim: boolean;
  dmarc: boolean;
}
```

### 5. A/B Testing

#### Test Configuration
- Subject line testing
- Content variations
- Send time optimization
- From name testing
- CTA testing

```typescript
interface ABTest {
  id: string;
  name: string;
  type: 'subject' | 'content' | 'send_time' | 'from_name';
  
  variants: TestVariant[];
  
  // Distribution
  distribution: 'equal' | 'weighted' | 'multi_armed_bandit';
  sampleSize: number; // percentage
  
  // Winner selection
  metric: 'open_rate' | 'click_rate' | 'reply_rate' | 'conversion_rate';
  minSampleSize: number;
  confidenceLevel: number; // 90, 95, 99
  
  // Results
  winner?: string;
  results?: TestResults;
}

interface TestVariant {
  id: string;
  name: string;
  content: any; // Varies by test type
  weight?: number; // For weighted distribution
  
  stats?: {
    sent: number;
    opens: number;
    clicks: number;
    replies: number;
    conversions: number;
  };
}
```

### 6. Analytics & Reporting

#### Engagement Metrics
- Open rates with device/client tracking
- Click tracking with link attribution
- Reply detection
- Bounce classification
- Spam complaints

```typescript
interface SequenceAnalytics {
  sequenceId: string;
  period: DateRange;
  
  // Overall metrics
  summary: {
    enrolled: number;
    active: number;
    completed: number;
    stopped: number;
    
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    replied: number;
    converted: number;
  };
  
  // Step performance
  stepMetrics: {
    [stepId: string]: {
      sent: number;
      deliveryRate: number;
      openRate: number;
      clickRate: number;
      replyRate: number;
      dropoffRate: number;
    };
  };
  
  // Time-based analysis
  engagement: {
    bestSendTimes: TimeSlot[];
    bestDays: string[];
    avgTimeToOpen: number; // minutes
    avgTimeToReply: number; // hours
  };
  
  // Recipient analysis
  recipientBreakdown: {
    byStatus: Record<string, number>;
    byEngagement: Record<string, number>;
    byIndustry?: Record<string, number>;
    byTitle?: Record<string, number>;
  };
}
```

### 7. Compliance & Deliverability

#### Compliance Features
- Unsubscribe management
- Suppression lists
- GDPR compliance
- CAN-SPAM compliance
- Custom compliance rules

```typescript
interface ComplianceSettings {
  // Unsubscribe
  unsubscribeLink: 'required' | 'optional' | 'none';
  unsubscribeText: string;
  
  // Suppression
  globalSuppressionList: string[];
  domainSuppressionList: string[];
  
  // Legal
  includePhysicalAddress: boolean;
  physicalAddress: string;
  
  // Rate limiting
  maxEmailsPerDay: number;
  maxEmailsPerWeek: number;
  cooldownPeriod: number; // days
  
  // Content filtering
  spamKeywords: string[];
  linkWhitelist: string[];
}
```

#### Deliverability Monitoring
```typescript
interface DeliverabilityMetrics {
  // Reputation
  senderScore: number;
  domainReputation: number;
  ipReputation: number;
  
  // Delivery metrics
  deliveryRate: number;
  bounceRate: number;
  spamRate: number;
  
  // Engagement
  openRate: number;
  clickRate: number;
  replyRate: number;
  
  // Issues
  blacklistStatus: BlacklistCheck[];
  authenticationIssues: AuthIssue[];
  contentIssues: ContentIssue[];
}
```

## Technical Implementation

### Database Schema

#### Sequences Table
```sql
CREATE TABLE email_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  
  -- Settings
  timezone VARCHAR(50) DEFAULT 'America/New_York',
  sending_days TEXT[] DEFAULT ARRAY['mon','tue','wed','thu','fri'],
  sending_hours JSONB DEFAULT '{"start": "09:00", "end": "17:00"}',
  reply_handling VARCHAR(20) DEFAULT 'pause',
  bounce_handling VARCHAR(20) DEFAULT 'stop',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  -- Stats cache
  stats JSONB DEFAULT '{}',
  
  UNIQUE(workspace_id, name)
);

CREATE INDEX idx_sequences_workspace ON email_sequences(workspace_id);
CREATE INDEX idx_sequences_status ON email_sequences(status);
```

#### Sequence Steps Table
```sql
CREATE TABLE sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES email_sequences(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL, -- 'email', 'task', 'call', etc.
  order_index INTEGER NOT NULL,
  
  -- Timing
  delay_value INTEGER NOT NULL,
  delay_unit VARCHAR(10) NOT NULL, -- 'hours', 'days', 'weeks'
  
  -- Content
  template_id UUID REFERENCES email_templates(id),
  content JSONB DEFAULT '{}',
  
  -- Conditions
  conditions JSONB DEFAULT '[]',
  
  -- A/B Testing
  ab_test_id UUID REFERENCES ab_tests(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(sequence_id, order_index)
);

CREATE INDEX idx_sequence_steps_sequence ON sequence_steps(sequence_id);
```

#### Sequence Enrollments Table
```sql
CREATE TABLE sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID NOT NULL REFERENCES email_sequences(id),
  contact_id UUID NOT NULL REFERENCES contacts(id),
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'paused', 'completed', 'stopped'
  current_step INTEGER DEFAULT 0,
  
  -- Tracking
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  enrolled_by UUID REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  stop_reason VARCHAR(50),
  
  -- Context
  context JSONB DEFAULT '{}', -- Custom data for personalization
  
  UNIQUE(sequence_id, contact_id)
);

CREATE INDEX idx_enrollments_sequence ON sequence_enrollments(sequence_id);
CREATE INDEX idx_enrollments_contact ON sequence_enrollments(contact_id);
CREATE INDEX idx_enrollments_status ON sequence_enrollments(status);
```

#### Email Activities Table
```sql
CREATE TABLE email_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID REFERENCES sequence_enrollments(id),
  step_id UUID REFERENCES sequence_steps(id),
  contact_id UUID NOT NULL REFERENCES contacts(id),
  
  -- Email details
  message_id VARCHAR(255) UNIQUE,
  subject VARCHAR(500),
  from_email VARCHAR(255),
  to_email VARCHAR(255),
  
  -- Status
  status VARCHAR(20) NOT NULL, -- 'scheduled', 'sent', 'delivered', 'bounced', 'failed'
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  -- Engagement
  opened_at TIMESTAMPTZ,
  open_count INTEGER DEFAULT 0,
  clicked_at TIMESTAMPTZ,
  click_count INTEGER DEFAULT 0,
  replied_at TIMESTAMPTZ,
  
  -- Tracking
  bounce_type VARCHAR(20),
  bounce_reason TEXT,
  spam_complaint BOOLEAN DEFAULT false,
  unsubscribed BOOLEAN DEFAULT false,
  
  -- A/B Testing
  variant_id UUID,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_activities_enrollment ON email_activities(enrollment_id);
CREATE INDEX idx_email_activities_contact ON email_activities(contact_id);
CREATE INDEX idx_email_activities_message ON email_activities(message_id);
CREATE INDEX idx_email_activities_sent ON email_activities(sent_at);
```

### API Endpoints

#### Sequence Management
```typescript
// Sequence CRUD
GET    /api/v1/sequences
POST   /api/v1/sequences
GET    /api/v1/sequences/:id
PUT    /api/v1/sequences/:id
DELETE /api/v1/sequences/:id

// Step management
POST   /api/v1/sequences/:id/steps
PUT    /api/v1/sequences/:id/steps/:stepId
DELETE /api/v1/sequences/:id/steps/:stepId
PUT    /api/v1/sequences/:id/steps/reorder

// Sequence operations
POST   /api/v1/sequences/:id/activate
POST   /api/v1/sequences/:id/pause
POST   /api/v1/sequences/:id/duplicate
```

#### Enrollment Management
```typescript
// Enrollment operations
POST   /api/v1/sequences/:id/enroll
POST   /api/v1/sequences/:id/enroll/bulk
GET    /api/v1/sequences/:id/enrollments
DELETE /api/v1/enrollments/:id
PUT    /api/v1/enrollments/:id/pause
PUT    /api/v1/enrollments/:id/resume

// Contact enrollment history
GET    /api/v1/contacts/:id/sequences
GET    /api/v1/contacts/:id/email-activities
```

#### Analytics & Reporting
```typescript
// Sequence analytics
GET    /api/v1/sequences/:id/analytics
GET    /api/v1/sequences/:id/funnel
GET    /api/v1/sequences/:id/ab-tests

// Deliverability
GET    /api/v1/deliverability/score
GET    /api/v1/deliverability/issues
POST   /api/v1/deliverability/test

// Reports
GET    /api/v1/reports/email-performance
GET    /api/v1/reports/engagement-trends
GET    /api/v1/reports/best-practices
```

### Email Sending Service

```typescript
interface EmailSendingService {
  // Queue management
  queueEmail(email: QueuedEmail): Promise<string>;
  processQueue(): Promise<void>;
  
  // Sending
  sendEmail(email: Email): Promise<SendResult>;
  sendBulk(emails: Email[]): Promise<SendResult[]>;
  
  // Rate limiting
  checkRateLimit(account: SendingAccount): Promise<boolean>;
  updateUsage(account: SendingAccount, count: number): Promise<void>;
  
  // Tracking
  trackOpen(messageId: string, metadata: OpenMetadata): Promise<void>;
  trackClick(messageId: string, link: string, metadata: ClickMetadata): Promise<void>;
  trackReply(messageId: string): Promise<void>;
  
  // Bounce handling
  processBounce(bounce: BounceNotification): Promise<void>;
  processComplaint(complaint: ComplaintNotification): Promise<void>;
}
```

### Frontend Components

#### Sequence Builder
```typescript
interface SequenceBuilderProps {
  sequence?: EmailSequence;
  onSave: (sequence: EmailSequence) => Promise<void>;
  templates: EmailTemplate[];
}

const SequenceBuilder: React.FC<SequenceBuilderProps> = ({
  sequence,
  onSave,
  templates
}) => {
  // Visual drag-and-drop builder
  // Step configuration
  // Condition builder
  // Preview functionality
};
```

#### Email Template Editor
```typescript
interface TemplateEditorProps {
  template?: EmailTemplate;
  onSave: (template: EmailTemplate) => Promise<void>;
  variables: TemplateVariable[];
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({
  template,
  onSave,
  variables
}) => {
  // Rich text editor
  // Variable insertion
  // Preview (desktop/mobile)
  // Plain text sync
};
```

## Integration Points

### CRM Integration
- Automatic contact enrichment
- Deal stage triggers
- Activity logging
- Task creation

### Calendar Integration
- Meeting booking links
- Calendar availability
- Follow-up scheduling
- Time zone handling

### Analytics Integration
- Conversion tracking
- Revenue attribution
- ROI calculation
- Custom goals

## Performance Optimization

### Queue Processing
```typescript
// Distributed queue processing
class EmailQueueProcessor {
  private readonly queue: Queue;
  private readonly workers: Worker[];
  
  async processEmails() {
    // Batch processing
    const batch = await this.queue.getBatch(100);
    
    // Parallel sending
    await Promise.all(
      batch.map(email => this.sendWithRetry(email))
    );
    
    // Update metrics
    await this.updateMetrics(batch);
  }
  
  private async sendWithRetry(email: QueuedEmail, attempts = 3) {
    for (let i = 0; i < attempts; i++) {
      try {
        return await this.send(email);
      } catch (error) {
        if (i === attempts - 1) throw error;
        await this.delay(Math.pow(2, i) * 1000);
      }
    }
  }
}
```

### Caching Strategy
- Template caching
- Personalization cache
- Analytics aggregation
- Rate limit caching

### Real-time Updates
```typescript
// WebSocket events for email tracking
socket.on('email.opened', (data) => {
  updateEmailStatus(data.messageId, 'opened');
  incrementOpenCount(data.messageId);
});

socket.on('email.clicked', (data) => {
  updateEmailStatus(data.messageId, 'clicked');
  trackLinkClick(data.messageId, data.link);
});

socket.on('email.replied', (data) => {
  updateEmailStatus(data.messageId, 'replied');
  pauseSequence(data.enrollmentId);
});
```

## Security Considerations

### Data Protection
- Encrypt email content at rest
- Secure credential storage
- PII handling compliance
- Audit trail for all actions

### Authentication
- OAuth2 for email providers
- API key rotation
- Multi-factor authentication
- Session management

### Anti-Abuse
- Rate limiting per user
- Content moderation
- Spam detection
- Blacklist monitoring

## Testing Strategy

### Unit Tests
- Template rendering
- Personalization engine
- Queue processing
- Analytics calculations

### Integration Tests
- Email provider APIs
- Webhook processing
- Real-time tracking
- A/B test distribution

### E2E Tests
- Complete sequence flow
- Email delivery
- Tracking pixels
- Unsubscribe flow

## Deployment Checklist

- [ ] Email provider accounts configured
- [ ] Domain authentication (SPF/DKIM/DMARC) set up
- [ ] Queue workers deployed
- [ ] Tracking domain configured
- [ ] Webhook endpoints registered
- [ ] Rate limits configured
- [ ] Compliance settings verified
- [ ] Analytics dashboard deployed
- [ ] Documentation completed
- [ ] Team training delivered

## Success Metrics

- Email delivery rate > 95%
- Average open rate > 20%
- Click-through rate > 3%
- Bounce rate < 3%
- Spam complaint rate < 0.1%
- Queue processing < 30 seconds
- Real-time tracking < 1 second

## Future Enhancements

### Phase 6.1
- AI-powered subject lines
- Send time optimization
- Content personalization AI
- Predictive engagement scoring

### Phase 6.2
- Multi-channel sequences (SMS, LinkedIn)
- Dynamic content blocks
- Advanced segmentation
- Behavioral triggers

### Phase 6.3
- Email warming automation
- Deliverability optimization AI
- Advanced reply detection
- Conversation intelligence