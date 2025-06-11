# Database Schema Design

## Overview

The hasteCRM uses PostgreSQL 15+ as its primary database, leveraging advanced features like JSONB, full-text search, and the pgvector extension for AI embeddings. This document details the complete database schema, relationships, and design decisions.

## Database Architecture

### Technology Stack
- **Database**: PostgreSQL 15+
- **ORM**: Prisma 5.x
- **Extensions**: 
  - pgvector (AI embeddings)
  - uuid-ossp (UUID generation)
  - pg_trgm (Fuzzy text search)
  - postgis (Geographic data - future)
- **Caching**: Redis 7.2+
- **Search**: PostgreSQL FTS + Redis

### Design Principles
1. **Multi-tenancy**: Workspace-based isolation with RLS
2. **Audit Trail**: Every table has created/updated timestamps and user tracking
3. **Soft Deletes**: Logical deletion with `deletedAt` timestamps
4. **Flexibility**: JSONB for custom fields and extensibility
5. **Performance**: Strategic indexing and partitioning

## Core Schema

### Workspace & Authentication

```sql
-- Workspaces (Multi-tenancy root)
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    logo_url TEXT,
    plan VARCHAR(50) NOT NULL DEFAULT 'free',
    settings JSONB DEFAULT '{}',
    features JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    -- Subscription info
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    subscription_status VARCHAR(50),
    trial_ends_at TIMESTAMPTZ,
    
    -- Usage tracking
    usage_metrics JSONB DEFAULT '{}',
    
    CONSTRAINT valid_plan CHECK (plan IN ('free', 'starter', 'professional', 'enterprise'))
);

CREATE INDEX idx_workspaces_slug ON workspaces(slug);
CREATE INDEX idx_workspaces_deleted_at ON workspaces(deleted_at);

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    password_hash VARCHAR(255), -- Null for OAuth users
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url TEXT,
    phone VARCHAR(50),
    timezone VARCHAR(50) DEFAULT 'UTC',
    locale VARCHAR(10) DEFAULT 'en',
    
    -- OAuth providers
    google_id VARCHAR(255) UNIQUE,
    google_refresh_token TEXT,
    microsoft_id VARCHAR(255) UNIQUE,
    
    -- Metadata
    last_login_at TIMESTAMPTZ,
    login_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    -- Preferences
    preferences JSONB DEFAULT '{}'
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_deleted_at ON users(deleted_at);

-- Workspace memberships
CREATE TABLE workspace_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    
    -- Permissions
    permissions JSONB DEFAULT '{}',
    
    -- Status
    status VARCHAR(50) DEFAULT 'active',
    invited_by UUID REFERENCES users(id),
    invited_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_role CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    CONSTRAINT unique_workspace_member UNIQUE (workspace_id, user_id)
);

CREATE INDEX idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);
```

### Contact Management

```sql
-- Contacts
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Basic info
    email VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),
    mobile VARCHAR(50),
    
    -- Company info
    company VARCHAR(255),
    title VARCHAR(255),
    department VARCHAR(100),
    
    -- Address
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(50),
    
    -- Contact metadata
    source VARCHAR(50) DEFAULT 'manual',
    source_details JSONB DEFAULT '{}',
    score INTEGER DEFAULT 0,
    lifecycle_stage VARCHAR(50) DEFAULT 'lead',
    
    -- Social profiles
    linkedin_url TEXT,
    twitter_handle VARCHAR(100),
    facebook_url TEXT,
    website TEXT,
    
    -- AI and enrichment
    enrichment_data JSONB DEFAULT '{}',
    enrichment_updated_at TIMESTAMPTZ,
    ai_insights JSONB DEFAULT '{}',
    embedding vector(1536), -- For semantic search
    
    -- Custom fields
    custom_fields JSONB DEFAULT '{}',
    
    -- Relationships
    owner_id UUID REFERENCES users(id),
    created_by UUID REFERENCES users(id),
    
    -- Tracking
    last_activity_at TIMESTAMPTZ,
    last_contacted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT valid_source CHECK (source IN ('manual', 'import', 'website', 'email', 'api', 'linkedin', 'enrichment')),
    CONSTRAINT valid_lifecycle CHECK (lifecycle_stage IN ('lead', 'MQL', 'SQL', 'opportunity', 'customer', 'evangelist'))
);

-- Indexes for performance
CREATE INDEX idx_contacts_workspace ON contacts(workspace_id);
CREATE INDEX idx_contacts_email ON contacts(workspace_id, email);
CREATE INDEX idx_contacts_company ON contacts(workspace_id, company);
CREATE INDEX idx_contacts_owner ON contacts(workspace_id, owner_id);
CREATE INDEX idx_contacts_score ON contacts(workspace_id, score DESC);
CREATE INDEX idx_contacts_created_at ON contacts(workspace_id, created_at DESC);
CREATE INDEX idx_contacts_last_activity ON contacts(workspace_id, last_activity_at DESC);
CREATE INDEX idx_contacts_deleted_at ON contacts(deleted_at);

-- Full-text search
CREATE INDEX idx_contacts_search ON contacts USING gin(
    to_tsvector('english', 
        coalesce(first_name, '') || ' ' || 
        coalesce(last_name, '') || ' ' || 
        coalesce(email, '') || ' ' || 
        coalesce(company, '')
    )
);

-- Vector similarity search
CREATE INDEX idx_contacts_embedding ON contacts USING ivfflat (embedding vector_cosine_ops);

-- Tags (many-to-many)
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#808080',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_workspace_tag UNIQUE (workspace_id, name)
);

CREATE TABLE contact_tags (
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (contact_id, tag_id)
);

CREATE INDEX idx_contact_tags_contact ON contact_tags(contact_id);
CREATE INDEX idx_contact_tags_tag ON contact_tags(tag_id);
```

### Companies

```sql
-- Companies (Organizations)
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Basic info
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    website TEXT,
    
    -- Details
    industry VARCHAR(100),
    company_size VARCHAR(50),
    annual_revenue DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Location
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    postal_code VARCHAR(50),
    timezone VARCHAR(50),
    
    -- Contact info
    phone VARCHAR(50),
    email VARCHAR(255),
    
    -- Social
    linkedin_url TEXT,
    twitter_handle VARCHAR(100),
    facebook_url TEXT,
    
    -- Enrichment
    enrichment_data JSONB DEFAULT '{}',
    enrichment_updated_at TIMESTAMPTZ,
    logo_url TEXT,
    description TEXT,
    
    -- AI
    ai_insights JSONB DEFAULT '{}',
    embedding vector(1536),
    
    -- Metadata
    custom_fields JSONB DEFAULT '{}',
    tags TEXT[],
    
    -- Relationships
    parent_company_id UUID REFERENCES companies(id),
    owner_id UUID REFERENCES users(id),
    created_by UUID REFERENCES users(id),
    
    -- Tracking
    employee_count INTEGER,
    founded_year INTEGER,
    last_activity_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT valid_company_size CHECK (company_size IN ('1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5000+'))
);

-- Indexes
CREATE INDEX idx_companies_workspace ON companies(workspace_id);
CREATE INDEX idx_companies_domain ON companies(domain);
CREATE INDEX idx_companies_name ON companies(workspace_id, name);
CREATE INDEX idx_companies_owner ON companies(workspace_id, owner_id);
CREATE INDEX idx_companies_parent ON companies(parent_company_id);
CREATE INDEX idx_companies_deleted_at ON companies(deleted_at);

-- Full-text search
CREATE INDEX idx_companies_search ON companies USING gin(
    to_tsvector('english', 
        coalesce(name, '') || ' ' || 
        coalesce(domain, '') || ' ' ||
        coalesce(description, '')
    )
);

-- Company-Contact relationships
CREATE TABLE company_contacts (
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    
    role VARCHAR(100),
    is_primary BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    PRIMARY KEY (company_id, contact_id)
);

CREATE INDEX idx_company_contacts_company ON company_contacts(company_id);
CREATE INDEX idx_company_contacts_contact ON company_contacts(contact_id);
```

### Notes & Comments

```sql
-- Notes
CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Content
    content TEXT NOT NULL,
    content_html TEXT,
    
    -- Relationships (polymorphic)
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    
    -- Specific relationships for indexing
    contact_id UUID REFERENCES contacts(id),
    company_id UUID REFERENCES companies(id),
    deal_id UUID REFERENCES deals(id),
    
    -- Metadata
    is_pinned BOOLEAN DEFAULT FALSE,
    mentions UUID[], -- User IDs mentioned
    
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT valid_entity_type CHECK (entity_type IN ('contact', 'company', 'deal', 'task'))
);

-- Indexes
CREATE INDEX idx_notes_workspace ON notes(workspace_id);
CREATE INDEX idx_notes_entity ON notes(entity_type, entity_id);
CREATE INDEX idx_notes_contact ON notes(contact_id);
CREATE INDEX idx_notes_company ON notes(company_id);
CREATE INDEX idx_notes_deal ON notes(deal_id);
CREATE INDEX idx_notes_created_by ON notes(created_by);
CREATE INDEX idx_notes_created_at ON notes(created_at DESC);

-- Full-text search
CREATE INDEX idx_notes_search ON notes USING gin(
    to_tsvector('english', content)
);

-- Comments (for collaboration)
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Parent entity (polymorphic)
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    
    -- Content
    content TEXT NOT NULL,
    
    -- Threading
    parent_comment_id UUID REFERENCES comments(id),
    
    -- Metadata
    mentions UUID[], -- User IDs mentioned
    reactions JSONB DEFAULT '{}', -- {"👍": [user_ids], "❤️": [user_ids]}
    
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT valid_entity_type CHECK (entity_type IN ('note', 'task', 'deal', 'email'))
);

CREATE INDEX idx_comments_entity ON comments(entity_type, entity_id);
CREATE INDEX idx_comments_parent ON comments(parent_comment_id);
CREATE INDEX idx_comments_created_at ON comments(created_at);
```

### Email System

```sql
-- Email accounts (for sending)
CREATE TABLE email_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Account info
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    provider VARCHAR(50) NOT NULL,
    
    -- OAuth tokens
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    
    -- Gmail specific
    gmail_history_id VARCHAR(255),
    gmail_sync_token TEXT,
    
    -- Settings
    is_primary BOOLEAN DEFAULT FALSE,
    sync_enabled BOOLEAN DEFAULT TRUE,
    signature TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT valid_provider CHECK (provider IN ('gmail', 'outlook', 'smtp'))
);

CREATE INDEX idx_email_accounts_workspace ON email_accounts(workspace_id);
CREATE INDEX idx_email_accounts_user ON email_accounts(user_id);

-- Emails
CREATE TABLE emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Email identifiers
    message_id VARCHAR(255) NOT NULL,
    thread_id VARCHAR(255),
    in_reply_to VARCHAR(255),
    references TEXT[],
    
    -- Headers
    subject TEXT,
    from_email VARCHAR(255) NOT NULL,
    from_name VARCHAR(255),
    to_emails TEXT[] NOT NULL,
    cc_emails TEXT[],
    bcc_emails TEXT[],
    reply_to VARCHAR(255),
    
    -- Content
    body_html TEXT,
    body_text TEXT,
    snippet TEXT,
    
    -- Metadata
    folder VARCHAR(50) DEFAULT 'inbox',
    labels TEXT[],
    is_read BOOLEAN DEFAULT FALSE,
    is_starred BOOLEAN DEFAULT FALSE,
    is_important BOOLEAN DEFAULT FALSE,
    is_draft BOOLEAN DEFAULT FALSE,
    is_sent BOOLEAN DEFAULT FALSE,
    
    -- Tracking
    tracking_id UUID,
    track_opens BOOLEAN DEFAULT FALSE,
    track_clicks BOOLEAN DEFAULT FALSE,
    
    -- Relationships
    email_account_id UUID REFERENCES email_accounts(id),
    contact_id UUID REFERENCES contacts(id),
    deal_id UUID REFERENCES deals(id),
    
    -- AI analysis
    ai_analysis JSONB DEFAULT '{}',
    sentiment VARCHAR(20),
    category VARCHAR(50),
    priority VARCHAR(20),
    
    -- Timestamps
    sent_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT unique_message_id UNIQUE (workspace_id, message_id)
);

-- Indexes
CREATE INDEX idx_emails_workspace ON emails(workspace_id);
CREATE INDEX idx_emails_thread ON emails(workspace_id, thread_id);
CREATE INDEX idx_emails_contact ON emails(workspace_id, contact_id);
CREATE INDEX idx_emails_received_at ON emails(workspace_id, received_at DESC);
CREATE INDEX idx_emails_from ON emails(workspace_id, from_email);
CREATE INDEX idx_emails_folder ON emails(workspace_id, folder);

-- Full-text search
CREATE INDEX idx_emails_search ON emails USING gin(
    to_tsvector('english', 
        coalesce(subject, '') || ' ' || 
        coalesce(body_text, '')
    )
);

-- Email attachments
CREATE TABLE email_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    
    filename VARCHAR(255) NOT NULL,
    content_type VARCHAR(100),
    size INTEGER,
    storage_url TEXT NOT NULL,
    
    -- Security
    virus_scanned BOOLEAN DEFAULT FALSE,
    virus_scan_result JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_attachments_email ON email_attachments(email_id);

-- Email tracking events
CREATE TABLE email_tracking_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    
    event_type VARCHAR(50) NOT NULL,
    
    -- Event data
    ip_address INET,
    user_agent TEXT,
    referer TEXT,
    
    -- Click tracking
    link_url TEXT,
    link_position INTEGER,
    
    -- Location (from IP)
    country VARCHAR(2),
    city VARCHAR(100),
    
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_event_type CHECK (event_type IN ('open', 'click', 'bounce', 'complaint', 'unsubscribe'))
);

CREATE INDEX idx_tracking_events_email ON email_tracking_events(email_id);
CREATE INDEX idx_tracking_events_occurred ON email_tracking_events(occurred_at DESC);
```

### Pipeline & Deals

```sql
-- Pipelines
CREATE TABLE pipelines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'sales',
    description TEXT,
    
    -- Settings
    currency VARCHAR(3) DEFAULT 'USD',
    probability_enabled BOOLEAN DEFAULT TRUE,
    rotting_enabled BOOLEAN DEFAULT TRUE,
    rotting_days INTEGER DEFAULT 30,
    
    -- Permissions
    visibility VARCHAR(50) DEFAULT 'everyone',
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT valid_type CHECK (type IN ('sales', 'recruitment', 'investor', 'vendor', 'custom'))
);

CREATE INDEX idx_pipelines_workspace ON pipelines(workspace_id);

-- Pipeline stages
CREATE TABLE pipeline_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    order_index INTEGER NOT NULL,
    probability DECIMAL(5,2) DEFAULT 0,
    
    -- Visual
    color VARCHAR(7) DEFAULT '#808080',
    
    -- Automation
    automation_rules JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_stage_order UNIQUE (pipeline_id, order_index)
);

CREATE INDEX idx_pipeline_stages_pipeline ON pipeline_stages(pipeline_id);

-- Deals
CREATE TABLE deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Basic info
    title VARCHAR(255) NOT NULL,
    value DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Pipeline position
    pipeline_id UUID NOT NULL REFERENCES pipelines(id),
    stage_id UUID NOT NULL REFERENCES pipeline_stages(id),
    
    -- Relationships
    contact_id UUID REFERENCES contacts(id),
    company_id UUID REFERENCES companies(id),
    owner_id UUID NOT NULL REFERENCES users(id),
    
    -- Deal details
    probability DECIMAL(5,2),
    expected_close_date DATE,
    actual_close_date DATE,
    
    -- Status
    status VARCHAR(50) DEFAULT 'open',
    won_reason TEXT,
    lost_reason TEXT,
    
    -- Tracking
    stage_entered_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ,
    rotting_days INTEGER DEFAULT 0,
    
    -- AI predictions
    ai_score DECIMAL(5,2),
    ai_insights JSONB DEFAULT '{}',
    ai_predicted_close_date DATE,
    
    -- Custom fields
    custom_fields JSONB DEFAULT '{}',
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT valid_status CHECK (status IN ('open', 'won', 'lost'))
);

-- Indexes
CREATE INDEX idx_deals_workspace ON deals(workspace_id);
CREATE INDEX idx_deals_pipeline ON deals(pipeline_id);
CREATE INDEX idx_deals_stage ON deals(stage_id);
CREATE INDEX idx_deals_contact ON deals(contact_id);
CREATE INDEX idx_deals_owner ON deals(owner_id);
CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deals_expected_close ON deals(expected_close_date);
CREATE INDEX idx_deals_value ON deals(workspace_id, value DESC);

-- Deal history (audit trail)
CREATE TABLE deal_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    
    changed_by UUID NOT NULL REFERENCES users(id),
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_deal_history_deal ON deal_history(deal_id);
CREATE INDEX idx_deal_history_changed_at ON deal_history(changed_at DESC);
```

### Activities & Tasks

```sql
-- Activities (unified activity stream)
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Activity info
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Relationships (polymorphic)
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    
    -- Specific relationships
    contact_id UUID REFERENCES contacts(id),
    deal_id UUID REFERENCES deals(id),
    company_id UUID REFERENCES companies(id),
    
    -- User info
    user_id UUID REFERENCES users(id),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_type CHECK (type IN (
        'email_sent', 'email_received', 'email_opened', 'email_clicked',
        'meeting_held', 'meeting_scheduled', 'call_made', 'call_received',
        'note_added', 'task_created', 'task_completed',
        'deal_created', 'deal_updated', 'deal_won', 'deal_lost',
        'contact_created', 'contact_updated',
        'custom'
    )),
    CONSTRAINT valid_entity_type CHECK (entity_type IN ('contact', 'deal', 'company', 'email', 'task'))
);

-- Indexes
CREATE INDEX idx_activities_workspace ON activities(workspace_id);
CREATE INDEX idx_activities_entity ON activities(entity_type, entity_id);
CREATE INDEX idx_activities_contact ON activities(contact_id);
CREATE INDEX idx_activities_deal ON activities(deal_id);
CREATE INDEX idx_activities_user ON activities(user_id);
CREATE INDEX idx_activities_occurred ON activities(workspace_id, occurred_at DESC);
CREATE INDEX idx_activities_type ON activities(workspace_id, type);

-- Tasks
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    -- Task info
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) DEFAULT 'task',
    priority VARCHAR(20) DEFAULT 'medium',
    
    -- Relationships
    contact_id UUID REFERENCES contacts(id),
    deal_id UUID REFERENCES deals(id),
    company_id UUID REFERENCES companies(id),
    
    -- Assignment
    assigned_to UUID NOT NULL REFERENCES users(id),
    assigned_by UUID REFERENCES users(id),
    
    -- Scheduling
    due_date DATE,
    due_time TIME,
    reminder_minutes INTEGER,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending',
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES users(id),
    
    -- Recurrence
    recurrence_rule JSONB,
    recurrence_parent_id UUID REFERENCES tasks(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT valid_type CHECK (type IN ('task', 'call', 'email', 'meeting')),
    CONSTRAINT valid_priority CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'))
);

-- Indexes
CREATE INDEX idx_tasks_workspace ON tasks(workspace_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_contact ON tasks(contact_id);
CREATE INDEX idx_tasks_deal ON tasks(deal_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_status ON tasks(status);
```

### AI & Automation

```sql
-- AI models and configurations
CREATE TABLE ai_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    model_id VARCHAR(255),
    
    -- Configuration
    config JSONB DEFAULT '{}',
    
    -- Performance metrics
    metrics JSONB DEFAULT '{}',
    
    -- Status
    status VARCHAR(50) DEFAULT 'active',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_type CHECK (type IN ('classification', 'generation', 'embedding', 'analysis')),
    CONSTRAINT valid_provider CHECK (provider IN ('openai', 'anthropic', 'perplexity', 'custom'))
);

-- Automations
CREATE TABLE automations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    
    -- Trigger configuration
    trigger_type VARCHAR(50) NOT NULL,
    trigger_config JSONB NOT NULL,
    
    -- Conditions
    conditions JSONB DEFAULT '[]',
    
    -- Actions
    actions JSONB NOT NULL,
    
    -- Settings
    enabled BOOLEAN DEFAULT TRUE,
    run_once BOOLEAN DEFAULT FALSE,
    
    -- Error handling
    on_error VARCHAR(50) DEFAULT 'stop',
    max_retries INTEGER DEFAULT 3,
    
    -- Execution stats
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    run_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT valid_trigger_type CHECK (trigger_type IN (
        'contact_created', 'contact_updated', 'contact_tagged',
        'email_received', 'email_opened', 'email_clicked',
        'deal_created', 'deal_stage_changed', 'deal_won', 'deal_lost',
        'time_based', 'webhook', 'manual'
    ))
);

CREATE INDEX idx_automations_workspace ON automations(workspace_id);
CREATE INDEX idx_automations_enabled ON automations(enabled);
CREATE INDEX idx_automations_trigger ON automations(trigger_type);

-- Automation executions (audit log)
CREATE TABLE automation_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
    
    -- Trigger info
    triggered_by VARCHAR(50),
    trigger_entity_type VARCHAR(50),
    trigger_entity_id UUID,
    
    -- Execution details
    status VARCHAR(50) NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Results
    actions_executed JSONB DEFAULT '[]',
    error_message TEXT,
    error_details JSONB,
    
    -- Metrics
    duration_ms INTEGER,
    
    CONSTRAINT valid_status CHECK (status IN ('running', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX idx_automation_executions_automation ON automation_executions(automation_id);
CREATE INDEX idx_automation_executions_started ON automation_executions(started_at DESC);

-- AI tasks
CREATE TABLE ai_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    
    -- Input/Output
    input JSONB NOT NULL,
    output JSONB,
    
    -- Model info
    model_provider VARCHAR(50),
    model_name VARCHAR(100),
    
    -- Metrics
    tokens_used INTEGER,
    cost_cents INTEGER,
    duration_ms INTEGER,
    
    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- User context
    user_id UUID REFERENCES users(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    CONSTRAINT valid_type CHECK (type IN (
        'email_generation', 'email_reply', 'summarization',
        'sentiment_analysis', 'entity_extraction', 'classification',
        'contact_enrichment', 'lead_scoring', 'meeting_summary'
    )),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'))
);

CREATE INDEX idx_ai_tasks_workspace ON ai_tasks(workspace_id);
CREATE INDEX idx_ai_tasks_status ON ai_tasks(status);
CREATE INDEX idx_ai_tasks_created ON ai_tasks(created_at DESC);
```

### Analytics & Reporting

```sql
-- Custom fields definitions
CREATE TABLE custom_field_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    object_type VARCHAR(50) NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    field_type VARCHAR(50) NOT NULL,
    
    -- Display
    label VARCHAR(255) NOT NULL,
    description TEXT,
    placeholder TEXT,
    
    -- Validation
    required BOOLEAN DEFAULT FALSE,
    validation_rules JSONB DEFAULT '{}',
    
    -- Options (for select/multiselect)
    options JSONB,
    
    -- Settings
    is_active BOOLEAN DEFAULT TRUE,
    order_index INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_object_type CHECK (object_type IN ('contact', 'company', 'deal')),
    CONSTRAINT valid_field_type CHECK (field_type IN ('text', 'number', 'date', 'datetime', 'boolean', 'select', 'multiselect', 'url', 'email', 'phone')),
    CONSTRAINT unique_field_name UNIQUE (workspace_id, object_type, field_name)
);

CREATE INDEX idx_custom_fields_workspace ON custom_field_definitions(workspace_id, object_type);

-- Saved views/filters
CREATE TABLE saved_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    object_type VARCHAR(50) NOT NULL,
    
    -- View configuration
    filters JSONB NOT NULL,
    columns JSONB,
    sort_by VARCHAR(100),
    sort_order VARCHAR(4) DEFAULT 'ASC',
    
    -- Sharing
    visibility VARCHAR(50) DEFAULT 'private',
    created_by UUID NOT NULL REFERENCES users(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_visibility CHECK (visibility IN ('private', 'workspace'))
);

CREATE INDEX idx_saved_views_workspace ON saved_views(workspace_id, object_type);
CREATE INDEX idx_saved_views_user ON saved_views(created_by);

-- Reports
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    
    -- Report configuration
    config JSONB NOT NULL,
    
    -- Scheduling
    schedule_enabled BOOLEAN DEFAULT FALSE,
    schedule_cron VARCHAR(100),
    schedule_timezone VARCHAR(50) DEFAULT 'UTC',
    
    -- Distribution
    recipients JSONB DEFAULT '[]',
    
    -- Cache
    last_generated_at TIMESTAMPTZ,
    cached_data JSONB,
    
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_type CHECK (type IN ('pipeline', 'activity', 'email', 'revenue', 'custom'))
);

CREATE INDEX idx_reports_workspace ON reports(workspace_id);
```

## Data Partitioning

### Time-based Partitioning

```sql
-- Partition activities by month
CREATE TABLE activities_2024_01 PARTITION OF activities
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE activities_2024_02 PARTITION OF activities
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Automated partition creation
CREATE OR REPLACE FUNCTION create_monthly_partition()
RETURNS void AS $$
DECLARE
    start_date date;
    end_date date;
    partition_name text;
BEGIN
    start_date := date_trunc('month', CURRENT_DATE);
    end_date := start_date + interval '1 month';
    partition_name := 'activities_' || to_char(start_date, 'YYYY_MM');
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF activities FOR VALUES FROM (%L) TO (%L)',
        partition_name, start_date, end_date);
END;
$$ LANGUAGE plpgsql;

-- Schedule monthly
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('create-partitions', '0 0 1 * *', 'SELECT create_monthly_partition()');
```

## Row-Level Security

```sql
-- Enable RLS on all tables
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

-- Contacts policy
CREATE POLICY workspace_isolation ON contacts
    FOR ALL
    USING (workspace_id = current_setting('app.workspace_id')::uuid);

-- Deals policy with owner check
CREATE POLICY deal_access ON deals
    FOR ALL
    USING (
        workspace_id = current_setting('app.workspace_id')::uuid
        AND (
            owner_id = current_setting('app.user_id')::uuid
            OR EXISTS (
                SELECT 1 FROM workspace_members
                WHERE workspace_id = deals.workspace_id
                AND user_id = current_setting('app.user_id')::uuid
                AND role IN ('owner', 'admin')
            )
        )
    );
```

## Materialized Views

```sql
-- Contact engagement scores
CREATE MATERIALIZED VIEW contact_engagement_scores AS
SELECT 
    c.id,
    c.workspace_id,
    COUNT(DISTINCT e.id) as email_count,
    COUNT(DISTINCT CASE WHEN et.event_type = 'open' THEN et.id END) as email_opens,
    COUNT(DISTINCT CASE WHEN et.event_type = 'click' THEN et.id END) as email_clicks,
    COUNT(DISTINCT a.id) as activity_count,
    MAX(a.occurred_at) as last_activity_at,
    
    -- Calculate engagement score
    (
        COUNT(DISTINCT CASE WHEN et.event_type = 'open' THEN et.id END) * 1 +
        COUNT(DISTINCT CASE WHEN et.event_type = 'click' THEN et.id END) * 3 +
        COUNT(DISTINCT CASE WHEN a.type = 'meeting_held' THEN a.id END) * 10 +
        COUNT(DISTINCT CASE WHEN a.type = 'email_received' THEN a.id END) * 5
    ) as engagement_score
    
FROM contacts c
LEFT JOIN emails e ON c.id = e.contact_id
LEFT JOIN email_tracking_events et ON e.id = et.email_id
LEFT JOIN activities a ON c.id = a.contact_id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.workspace_id;

CREATE INDEX idx_engagement_scores_workspace ON contact_engagement_scores(workspace_id);
CREATE INDEX idx_engagement_scores_score ON contact_engagement_scores(workspace_id, engagement_score DESC);

-- Refresh every hour
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('refresh-engagement-scores', '0 * * * *', 
    'REFRESH MATERIALIZED VIEW CONCURRENTLY contact_engagement_scores');
```

## Performance Optimizations

### Query Optimization Functions

```sql
-- Function to get contact with all related data
CREATE OR REPLACE FUNCTION get_contact_details(p_contact_id UUID)
RETURNS JSON AS $$
BEGIN
    RETURN json_build_object(
        'contact', (SELECT row_to_json(c.*) FROM contacts c WHERE c.id = p_contact_id),
        'recent_emails', (
            SELECT json_agg(row_to_json(e.*))
            FROM (
                SELECT * FROM emails 
                WHERE contact_id = p_contact_id 
                ORDER BY received_at DESC 
                LIMIT 10
            ) e
        ),
        'activities', (
            SELECT json_agg(row_to_json(a.*))
            FROM (
                SELECT * FROM activities 
                WHERE contact_id = p_contact_id 
                ORDER BY occurred_at DESC 
                LIMIT 20
            ) a
        ),
        'deals', (
            SELECT json_agg(row_to_json(d.*))
            FROM deals d 
            WHERE d.contact_id = p_contact_id
        ),
        'tags', (
            SELECT json_agg(t.name)
            FROM tags t
            JOIN contact_tags ct ON t.id = ct.tag_id
            WHERE ct.contact_id = p_contact_id
        )
    );
END;
$$ LANGUAGE plpgsql;
```

### Database Maintenance

```sql
-- Vacuum and analyze schedule
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Daily vacuum of high-activity tables
SELECT cron.schedule('vacuum-emails', '0 2 * * *', 'VACUUM ANALYZE emails');
SELECT cron.schedule('vacuum-activities', '0 2 * * *', 'VACUUM ANALYZE activities');
SELECT cron.schedule('vacuum-tracking', '0 2 * * *', 'VACUUM ANALYZE email_tracking_events');

-- Weekly full vacuum
SELECT cron.schedule('vacuum-full', '0 3 * * 0', 'VACUUM FULL ANALYZE');

-- Update table statistics
SELECT cron.schedule('analyze-tables', '0 * * * *', 'ANALYZE');
```

## Backup Strategy

```sql
-- Continuous archiving configuration
-- postgresql.conf
archive_mode = on
archive_command = 'test ! -f /backup/archive/%f && cp %p /backup/archive/%f'
wal_level = replica

-- Backup script
#!/bin/bash
# Daily backup with point-in-time recovery
pg_basebackup -D /backup/base -Ft -Xs -P

# Weekly logical backup
pg_dump -Fc -f /backup/logical/crm_$(date +%Y%m%d).dump crm_production

# Monthly backup rotation
find /backup/logical -name "*.dump" -mtime +30 -delete
```

## Monitoring Queries

```sql
-- Table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Slow queries
SELECT 
    query,
    calls,
    mean_exec_time,
    total_exec_time,
    rows
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Index usage
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan;

-- Cache hit ratio
SELECT 
    sum(heap_blks_read) as heap_read,
    sum(heap_blks_hit)  as heap_hit,
    sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as ratio
FROM pg_statio_user_tables;
```

## Best Practices

### Naming Conventions
- Tables: Plural, snake_case (e.g., `contacts`, `email_accounts`)
- Columns: Singular, snake_case (e.g., `first_name`, `created_at`)
- Indexes: `idx_<table>_<column(s)>` (e.g., `idx_contacts_email`)
- Foreign keys: `<table>_id` (e.g., `contact_id`, `workspace_id`)
- Constraints: Descriptive names (e.g., `valid_email_format`)

### Data Types
- UUIDs for all primary keys
- TIMESTAMPTZ for all timestamps
- JSONB for flexible/extensible data
- TEXT for variable-length strings (no VARCHAR limits)
- DECIMAL for monetary values

### Performance Guidelines
1. Index foreign keys and commonly queried columns
2. Use partial indexes for filtered queries
3. Leverage JSONB indexes for custom fields
4. Implement materialized views for complex aggregations
5. Partition large tables by time
6. Regular VACUUM and ANALYZE

### Security Guidelines
1. Enable RLS on all user-data tables
2. Use workspace_id for multi-tenancy isolation
3. Audit sensitive operations
4. Encrypt sensitive data at rest
5. Regular security audits

## Additional Resources

- [PostgreSQL Documentation](https://www.postgresql.org/docs/15/)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Database Migration Guide](../development/migrations.md)
- [Performance Tuning Guide](../guides/database-performance.md)