# Phase 5: Sales Pipelines & Deals

## Overview

Phase 5 implements comprehensive sales pipeline management with visual kanban boards, deal tracking, forecasting, and automation. This phase transforms hasteCRM into a powerful sales management platform.

## Core Features

### 1. Pipeline Management

#### Multiple Pipelines
- Create unlimited sales pipelines
- Custom stages per pipeline
- Stage probability and duration tracking
- Pipeline templates for common workflows

#### Pipeline Configuration
```typescript
interface Pipeline {
  id: string;
  name: string;
  description?: string;
  stages: PipelineStage[];
  defaultProbabilities: boolean;
  currency: string;
  fiscalYearStart: string;
  createdAt: Date;
  updatedAt: Date;
  archived: boolean;
}

interface PipelineStage {
  id: string;
  name: string;
  order: number;
  probability: number;
  averageDuration: number; // days
  color: string;
  requirements?: StageRequirement[];
  automations?: StageAutomation[];
}
```

### 2. Deal Management

#### Deal Properties
- Comprehensive deal tracking
- Custom fields support
- Multi-contact association
- Document attachments
- Activity timeline

```typescript
interface Deal {
  id: string;
  name: string;
  value: number;
  currency: string;
  stage: string;
  pipelineId: string;
  probability: number;
  expectedCloseDate: Date;
  
  // Associations
  contactIds: string[];
  companyId?: string;
  ownerId: string;
  teamIds?: string[];
  
  // Details
  description?: string;
  lostReason?: string;
  competitorIds?: string[];
  products?: DealProduct[];
  
  // Tracking
  createdAt: Date;
  updatedAt: Date;
  closedAt?: Date;
  lastActivityAt?: Date;
  nextActivityAt?: Date;
  
  // Custom fields
  customFields: Record<string, any>;
}
```

### 3. Kanban Board Interface

#### Visual Pipeline View
- Drag-and-drop deal cards
- Stage-based organization
- Quick deal creation
- Bulk operations

#### Deal Cards
- Customizable card display
- Key metrics visibility
- Quick actions menu
- Color coding by criteria

#### Filtering & Sorting
- Advanced filter builder
- Saved filter views
- Sort by multiple criteria
- Search across all fields

### 4. Deal Workflow

#### Stage Progression
- Manual stage updates
- Automated stage transitions
- Required fields per stage
- Stage entry/exit actions

#### Validation Rules
```typescript
interface StageRequirement {
  field: string;
  condition: 'required' | 'min' | 'max' | 'regex';
  value?: any;
  message: string;
}

// Example requirements
const qualificationRequirements: StageRequirement[] = [
  {
    field: 'budget',
    condition: 'required',
    message: 'Budget must be identified'
  },
  {
    field: 'decisionMaker',
    condition: 'required',
    message: 'Decision maker must be identified'
  }
];
```

### 5. Sales Forecasting

#### Revenue Forecasting
- Probability-weighted forecasts
- Time-based projections
- Scenario modeling
- Historical accuracy tracking

#### Forecast Views
- Monthly/Quarterly/Annual views
- By owner/team/territory
- Product-based forecasting
- Pipeline velocity metrics

```typescript
interface ForecastData {
  period: string;
  pipeline: string;
  committed: number;
  bestCase: number;
  weighted: number;
  closed: number;
  target: number;
  deals: {
    stage: string;
    count: number;
    value: number;
    weightedValue: number;
  }[];
}
```

### 6. Automation & Rules

#### Stage Automations
- Email notifications
- Task creation
- Field updates
- Webhook triggers

```typescript
interface StageAutomation {
  trigger: 'enter' | 'exit' | 'duration';
  conditions?: AutomationCondition[];
  actions: AutomationAction[];
  enabled: boolean;
}

interface AutomationAction {
  type: 'email' | 'task' | 'field_update' | 'webhook';
  config: {
    // Action-specific configuration
  };
}
```

#### Workflow Examples
- Auto-assign deals by territory
- Create follow-up tasks
- Send stage-specific emails
- Update probabilities
- Notify team members

### 7. Analytics & Reporting

#### Pipeline Analytics
- Conversion rates by stage
- Average deal velocity
- Win/loss analysis
- Stage duration tracking
- Bottleneck identification

#### Performance Metrics
```typescript
interface PipelineMetrics {
  totalDeals: number;
  totalValue: number;
  averageDealSize: number;
  conversionRate: number;
  averageCycleTime: number;
  velocityTrend: number;
  
  stageMetrics: {
    [stageId: string]: {
      deals: number;
      value: number;
      averageDuration: number;
      conversionRate: number;
    };
  };
  
  forecastAccuracy: {
    period: string;
    forecast: number;
    actual: number;
    variance: number;
  }[];
}
```

## Technical Implementation

### Database Schema

#### Pipelines Table
```sql
CREATE TABLE pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  currency VARCHAR(3) DEFAULT 'USD',
  fiscal_year_start VARCHAR(5) DEFAULT '01-01',
  is_default BOOLEAN DEFAULT false,
  archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  
  UNIQUE(workspace_id, name) WHERE archived = false
);

CREATE INDEX idx_pipelines_workspace ON pipelines(workspace_id);
```

#### Pipeline Stages Table
```sql
CREATE TABLE pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  order_index INTEGER NOT NULL,
  probability INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
  average_duration INTEGER, -- days
  color VARCHAR(7) DEFAULT '#gray',
  is_closed BOOLEAN DEFAULT false,
  is_won BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(pipeline_id, order_index)
);

CREATE INDEX idx_pipeline_stages_pipeline ON pipeline_stages(pipeline_id);
```

#### Deals Table
```sql
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id),
  stage_id UUID NOT NULL REFERENCES pipeline_stages(id),
  
  -- Basic info
  name VARCHAR(255) NOT NULL,
  value DECIMAL(15, 2),
  currency VARCHAR(3) DEFAULT 'USD',
  probability INTEGER CHECK (probability >= 0 AND probability <= 100),
  expected_close_date DATE,
  
  -- Associations
  company_id UUID REFERENCES companies(id),
  owner_id UUID NOT NULL REFERENCES users(id),
  
  -- Details
  description TEXT,
  lost_reason VARCHAR(255),
  closed_at TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  custom_fields JSONB DEFAULT '{}',
  
  -- Search
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED
);

CREATE INDEX idx_deals_workspace ON deals(workspace_id);
CREATE INDEX idx_deals_pipeline ON deals(pipeline_id);
CREATE INDEX idx_deals_stage ON deals(stage_id);
CREATE INDEX idx_deals_owner ON deals(owner_id);
CREATE INDEX idx_deals_company ON deals(company_id);
CREATE INDEX idx_deals_search ON deals USING gin(search_vector);
CREATE INDEX idx_deals_close_date ON deals(expected_close_date);
```

#### Deal Contacts Table
```sql
CREATE TABLE deal_contacts (
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  role VARCHAR(50),
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (deal_id, contact_id)
);

CREATE INDEX idx_deal_contacts_contact ON deal_contacts(contact_id);
```

#### Deal Activities Table
```sql
CREATE TABLE deal_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'stage_change', 'value_update', 'note', etc.
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_deal_activities_deal ON deal_activities(deal_id);
CREATE INDEX idx_deal_activities_created ON deal_activities(created_at DESC);
```

### API Endpoints

#### Pipeline Management
```typescript
// Pipeline CRUD
GET    /api/v1/pipelines
POST   /api/v1/pipelines
GET    /api/v1/pipelines/:id
PUT    /api/v1/pipelines/:id
DELETE /api/v1/pipelines/:id

// Stage management
POST   /api/v1/pipelines/:id/stages
PUT    /api/v1/pipelines/:id/stages/:stageId
DELETE /api/v1/pipelines/:id/stages/:stageId
PUT    /api/v1/pipelines/:id/stages/reorder

// Pipeline analytics
GET    /api/v1/pipelines/:id/analytics
GET    /api/v1/pipelines/:id/forecast
GET    /api/v1/pipelines/:id/velocity
```

#### Deal Management
```typescript
// Deal CRUD
GET    /api/v1/deals
POST   /api/v1/deals
GET    /api/v1/deals/:id
PUT    /api/v1/deals/:id
DELETE /api/v1/deals/:id

// Deal operations
PUT    /api/v1/deals/:id/stage
POST   /api/v1/deals/:id/win
POST   /api/v1/deals/:id/lose
POST   /api/v1/deals/:id/duplicate

// Associations
POST   /api/v1/deals/:id/contacts
DELETE /api/v1/deals/:id/contacts/:contactId
GET    /api/v1/deals/:id/activities
POST   /api/v1/deals/:id/notes
```

### Frontend Components

#### Pipeline Board Component
```typescript
interface PipelineBoardProps {
  pipelineId: string;
  filters?: DealFilter[];
  onDealMove?: (dealId: string, stageId: string) => void;
  onDealClick?: (dealId: string) => void;
}

const PipelineBoard: React.FC<PipelineBoardProps> = ({
  pipelineId,
  filters,
  onDealMove,
  onDealClick
}) => {
  // Drag and drop implementation
  // Stage columns with deal cards
  // Real-time updates via WebSocket
};
```

#### Deal Card Component
```typescript
interface DealCardProps {
  deal: Deal;
  displayFields?: string[];
  onClick?: () => void;
  isDragging?: boolean;
}

const DealCard: React.FC<DealCardProps> = ({
  deal,
  displayFields = ['value', 'company', 'owner'],
  onClick,
  isDragging
}) => {
  // Customizable card display
  // Quick actions menu
  // Visual indicators
};
```

## Integration Points

### Email Integration
- Link emails to deals
- Track communication history
- Email templates per stage
- Automated follow-ups

### Calendar Integration
- Schedule meetings from deals
- Track meeting outcomes
- Automated reminders
- Activity logging

### AI Features
- Deal scoring
- Win probability prediction
- Next best action suggestions
- Anomaly detection

### Reporting Integration
- Custom deal reports
- Pipeline dashboards
- Forecast reports
- Team performance metrics

## Performance Optimization

### Query Optimization
```sql
-- Materialized view for pipeline metrics
CREATE MATERIALIZED VIEW pipeline_metrics AS
SELECT 
  p.id as pipeline_id,
  ps.id as stage_id,
  COUNT(d.id) as deal_count,
  SUM(d.value) as total_value,
  AVG(d.value) as avg_deal_value,
  AVG(EXTRACT(epoch FROM (d.updated_at - d.created_at))/86400) as avg_cycle_days
FROM pipelines p
JOIN pipeline_stages ps ON ps.pipeline_id = p.id
LEFT JOIN deals d ON d.stage_id = ps.id
GROUP BY p.id, ps.id;

CREATE INDEX idx_pipeline_metrics ON pipeline_metrics(pipeline_id, stage_id);
```

### Caching Strategy
- Cache pipeline structure
- Cache stage metrics
- Real-time deal updates
- Invalidate on changes

### Real-time Updates
```typescript
// WebSocket events for pipeline updates
socket.on('deal.moved', (data) => {
  updateDealPosition(data.dealId, data.newStageId);
});

socket.on('deal.updated', (data) => {
  updateDealCard(data.dealId, data.changes);
});

socket.on('pipeline.metrics', (data) => {
  updatePipelineMetrics(data);
});
```

## Security Considerations

### Access Control
- Pipeline-level permissions
- Deal ownership rules
- Stage transition permissions
- Value visibility controls

### Data Protection
- Encrypt sensitive deal data
- Audit trail for all changes
- GDPR compliance for deal data
- Secure document storage

## Testing Strategy

### Unit Tests
- Pipeline CRUD operations
- Deal stage transitions
- Automation rule execution
- Forecast calculations

### Integration Tests
- Drag-and-drop functionality
- Real-time synchronization
- Email/calendar integration
- Webhook delivery

### E2E Tests
- Complete deal lifecycle
- Pipeline board interactions
- Reporting accuracy
- Performance under load

## Deployment Checklist

- [ ] Database migrations executed
- [ ] Pipeline templates seeded
- [ ] Indexes created and optimized
- [ ] API endpoints deployed
- [ ] WebSocket events configured
- [ ] Frontend components tested
- [ ] Permissions configured
- [ ] Analytics tracking enabled
- [ ] Documentation updated
- [ ] Team training completed

## Success Metrics

- Deal creation time < 30 seconds
- Stage transitions < 2 seconds
- Pipeline load time < 1 second
- 99.9% uptime for pipeline operations
- Zero data loss during transitions
- Forecast accuracy within 10%

## Future Enhancements

### Phase 5.1
- Advanced forecasting models
- Territory management
- Commission tracking
- Partner deal registration

### Phase 5.2
- CPQ integration
- Contract management
- Revenue recognition
- Renewal tracking

### Phase 5.3
- AI-powered insights
- Predictive analytics
- Automated playbooks
- Competition tracking