# Contact Management

## Table of Contents
1. [Overview](#overview)
2. [Core Features](#core-features)
3. [Data Model](#data-model)
4. [Contact Operations](#contact-operations)
5. [Activity Tracking](#activity-tracking)
6. [Custom Fields](#custom-fields)
7. [Tags & Segmentation](#tags--segmentation)
8. [Search & Filtering](#search--filtering)
9. [Bulk Operations](#bulk-operations)
10. [Import/Export](#importexport)
11. [AI Enrichment](#ai-enrichment)
12. [Performance Optimization](#performance-optimization)
13. [Best Practices](#best-practices)

## Overview

The Contact Management system is the heart of hasteCRM, providing a comprehensive solution for managing relationships with individuals and companies. Unlike traditional CRMs, our system leverages AI at every touchpoint to provide intelligent insights, automated enrichment, and predictive analytics.

### Key Differentiators
- **AI-Powered Enrichment**: Automatic data enrichment from multiple sources
- **Real-time Activity Tracking**: Every interaction automatically logged
- **Flexible Data Model**: Custom fields without performance penalties
- **Semantic Search**: Search by meaning, not just keywords
- **Predictive Scoring**: AI-driven lead scoring that learns from your data

## Core Features

### Contact Profile
Every contact has a rich profile that includes:
- Basic information (name, email, phone)
- Company associations
- Social profiles
- Communication history
- Activity timeline
- Custom fields
- AI-generated insights
- Engagement score

### Company Management
Companies are first-class entities with:
- Hierarchical relationships (parent/subsidiary)
- Multiple contact associations
- Industry classification
- Enriched firmographic data
- Custom properties
- Activity roll-ups from contacts

### Relationship Mapping
- Contact-to-contact relationships
- Company hierarchies
- Influence networks
- Decision-making units
- Referral tracking

## Data Model

### Contact Schema
```typescript
interface Contact {
  id: string;
  workspaceId: string;
  
  // Basic Information
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  mobile?: string;
  
  // Company Information
  company?: string;
  title?: string;
  department?: string;
  companyId?: string; // Link to companies table
  
  // Address
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  
  // Metadata
  source: ContactSource;
  sourceDetails: Record<string, any>;
  score: number;
  lifecycleStage: LifecycleStage;
  
  // Social Profiles
  linkedinUrl?: string;
  twitterHandle?: string;
  facebookUrl?: string;
  website?: string;
  
  // AI & Enrichment
  enrichmentData: EnrichmentData;
  enrichmentUpdatedAt?: Date;
  aiInsights: AIInsights;
  embedding?: number[]; // Vector for semantic search
  
  // Custom Fields
  customFields: Record<string, any>;
  
  // Relationships
  ownerId: string;
  createdBy: string;
  tags: string[];
  
  // Tracking
  lastActivityAt?: Date;
  lastContactedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

enum ContactSource {
  MANUAL = 'manual',
  IMPORT = 'import',
  WEBSITE = 'website',
  EMAIL = 'email',
  API = 'api',
  LINKEDIN = 'linkedin',
  ENRICHMENT = 'enrichment'
}

enum LifecycleStage {
  LEAD = 'lead',
  MQL = 'MQL',
  SQL = 'SQL',
  OPPORTUNITY = 'opportunity',
  CUSTOMER = 'customer',
  EVANGELIST = 'evangelist'
}
```

### Company Schema
```typescript
interface Company {
  id: string;
  workspaceId: string;
  
  // Basic Information
  name: string;
  domain?: string;
  website?: string;
  
  // Details
  industry?: string;
  companySize?: CompanySize;
  annualRevenue?: number;
  currency: string;
  
  // Location
  address: Address;
  timezone?: string;
  
  // Contact Information
  phone?: string;
  email?: string;
  
  // Social
  linkedinUrl?: string;
  twitterHandle?: string;
  facebookUrl?: string;
  
  // Enrichment
  enrichmentData: CompanyEnrichmentData;
  logoUrl?: string;
  description?: string;
  
  // AI
  aiInsights: CompanyAIInsights;
  embedding?: number[];
  
  // Metadata
  customFields: Record<string, any>;
  tags: string[];
  
  // Relationships
  parentCompanyId?: string;
  ownerId: string;
  
  // Tracking
  employeeCount?: number;
  foundedYear?: number;
  lastActivityAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

## Contact Operations

### Create Contact
```typescript
// GraphQL Mutation
mutation CreateContact($input: CreateContactInput!) {
  createContact(input: $input) {
    id
    email
    firstName
    lastName
    company
    score
    enrichmentData {
      isEnriched
      sources
    }
  }
}

// Example Input
{
  "input": {
    "email": "john@haste.nyc",
    "firstName": "John",
    "lastName": "Doe",
    "company": "Acme Corp",
    "customFields": {
      "budget": 50000,
      "projectTimeline": "2024-04-01"
    }
  }
}
```

### Update Contact
```typescript
mutation UpdateContact($id: ID!, $input: UpdateContactInput!) {
  updateContact(id: $id, input: $input) {
    id
    score
    lifecycleStage
    lastActivityAt
  }
}
```

### Search Contacts
```typescript
query SearchContacts($query: String!, $filters: ContactFilters) {
  searchContacts(query: $query, filters: $filters) {
    nodes {
      id
      email
      fullName
      company
      score
      highlights {
        field
        snippet
      }
    }
    totalCount
    facets {
      companies
      tags
      sources
    }
  }
}
```

### Get Contact with Activities
```typescript
query GetContactDetails($id: ID!) {
  contact(id: $id) {
    id
    email
    fullName
    
    # Recent activities
    activities(first: 20) {
      nodes {
        id
        type
        title
        occurredAt
        metadata
      }
    }
    
    # Email history
    emails(first: 10) {
      nodes {
        id
        subject
        snippet
        sentAt
        opened
      }
    }
    
    # Associated deals
    deals {
      id
      title
      value
      stage
      probability
    }
    
    # AI insights
    aiInsights {
      summary
      predictedValue
      engagementScore
      nextBestAction
    }
  }
}
```

## Activity Tracking

### Activity Types
All contact interactions are automatically tracked:
- Email sent/received
- Email opened/clicked
- Meeting scheduled/held
- Phone call made/received
- Note added
- Task created/completed
- Deal stage changed
- Custom activities

### Activity Schema
```typescript
interface Activity {
  id: string;
  workspaceId: string;
  
  // Activity Information
  type: ActivityType;
  title: string;
  description?: string;
  
  // Relationships
  entityType: EntityType;
  entityId: string;
  contactId?: string;
  dealId?: string;
  companyId?: string;
  
  // User
  userId: string;
  
  // Metadata
  metadata: Record<string, any>;
  
  // Timestamps
  occurredAt: Date;
  createdAt: Date;
}
```

### Automatic Activity Creation
```typescript
// Email received
{
  type: 'email_received',
  title: 'Email from John Doe',
  entityType: 'contact',
  entityId: 'contact_123',
  metadata: {
    subject: 'Re: Proposal',
    emailId: 'email_456',
    threadId: 'thread_789'
  }
}

// Meeting held
{
  type: 'meeting_held',
  title: 'Discovery Call with John Doe',
  entityType: 'contact',
  entityId: 'contact_123',
  metadata: {
    duration: 1800, // seconds
    attendees: ['john@haste.nyc', 'team@ourcompany.com'],
    recordingUrl: 'https://...',
    transcriptId: 'transcript_123'
  }
}
```

## Custom Fields

### Defining Custom Fields
```typescript
mutation CreateCustomField($input: CreateCustomFieldInput!) {
  createCustomField(input: $input) {
    id
    fieldName
    label
    fieldType
    required
    options
  }
}

// Example: Create a dropdown field
{
  "input": {
    "objectType": "contact",
    "fieldName": "leadSource",
    "label": "Lead Source",
    "fieldType": "select",
    "required": false,
    "options": [
      {"value": "website", "label": "Website"},
      {"value": "referral", "label": "Referral"},
      {"value": "event", "label": "Event"},
      {"value": "coldOutreach", "label": "Cold Outreach"}
    ]
  }
}
```

### Field Types
- `text` - Single line text
- `textarea` - Multi-line text
- `number` - Numeric values
- `currency` - Money fields
- `date` - Date picker
- `datetime` - Date and time
- `boolean` - Checkbox
- `select` - Dropdown single select
- `multiselect` - Multiple selection
- `url` - Web addresses
- `email` - Email addresses
- `phone` - Phone numbers

### Using Custom Fields
```typescript
// Set custom field values
mutation UpdateContactCustomFields($id: ID!, $fields: JSON!) {
  updateContact(id: $id, input: { customFields: $fields }) {
    id
    customFields
  }
}

// Query custom fields
query GetContactWithCustomFields($id: ID!) {
  contact(id: $id) {
    id
    customFields
    customFieldDefinitions {
      fieldName
      label
      fieldType
      required
    }
  }
}
```

## Tags & Segmentation

### Tag Management
```typescript
// Create tag
mutation CreateTag($input: CreateTagInput!) {
  createTag(input: $input) {
    id
    name
    color
    description
    contactCount
  }
}

// Tag contacts
mutation TagContacts($contactIds: [ID!]!, $tagIds: [ID!]!) {
  tagContacts(contactIds: $contactIds, tagIds: $tagIds) {
    success
    taggedCount
  }
}

// Get contacts by tag
query GetContactsByTag($tagId: ID!) {
  contactsByTag(tagId: $tagId) {
    nodes {
      id
      email
      fullName
    }
    totalCount
  }
}
```

### Smart Segments
Create dynamic segments based on criteria:
```typescript
mutation CreateSegment($input: CreateSegmentInput!) {
  createSegment(input: $input) {
    id
    name
    criteria
    contactCount
    isDynamic
  }
}

// Example: High-value leads
{
  "input": {
    "name": "High-Value Leads",
    "isDynamic": true,
    "criteria": {
      "and": [
        {"field": "score", "operator": "gte", "value": 80},
        {"field": "lifecycleStage", "operator": "in", "value": ["lead", "MQL"]},
        {"field": "customFields.budget", "operator": "gte", "value": 10000}
      ]
    }
  }
}
```

## Search & Filtering

### Full-Text Search
```typescript
// Search with highlighting
query SearchContacts($query: String!) {
  searchContacts(query: $query) {
    nodes {
      id
      email
      fullName
      company
      highlights {
        field
        snippet // e.g., "...meeting with <mark>John</mark> next week..."
      }
    }
  }
}
```

### Semantic Search
```typescript
// Search by meaning using AI embeddings
query SemanticSearch($query: String!) {
  semanticSearchContacts(query: $query) {
    nodes {
      id
      relevanceScore
      explanation // AI explanation of why this matched
    }
  }
}

// Example queries:
// "contacts interested in AI solutions"
// "people who mentioned budget constraints"
// "decision makers at tech companies"
```

### Advanced Filtering
```typescript
query FilterContacts($filters: ContactFilters!) {
  contacts(filters: $filters, first: 50) {
    nodes {
      id
      email
      fullName
      score
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}

// Complex filter example
{
  "filters": {
    "and": [
      {"field": "score", "operator": "between", "value": [70, 100]},
      {"field": "lastActivityAt", "operator": "gte", "value": "2024-01-01"},
      {
        "or": [
          {"field": "company", "operator": "contains", "value": "Tech"},
          {"field": "tags", "operator": "includes", "value": ["technology"]}
        ]
      }
    ]
  }
}
```

### Saved Views
```typescript
mutation SaveView($input: SaveViewInput!) {
  saveView(input: $input) {
    id
    name
    filters
    columns
    sortBy
    isDefault
  }
}
```

## Bulk Operations

### Bulk Update
```typescript
mutation BulkUpdateContacts($ids: [ID!]!, $update: BulkUpdateInput!) {
  bulkUpdateContacts(ids: $ids, update: $update) {
    success
    updatedCount
    errors {
      contactId
      error
    }
  }
}

// Example: Update lifecycle stage
{
  "ids": ["contact_1", "contact_2", "contact_3"],
  "update": {
    "lifecycleStage": "SQL",
    "customFields": {
      "qualifiedDate": "2024-01-15"
    }
  }
}
```

### Bulk Delete
```typescript
mutation BulkDeleteContacts($ids: [ID!]!) {
  bulkDeleteContacts(ids: $ids) {
    success
    deletedCount
  }
}
```

### Bulk Tag Operations
```typescript
mutation BulkTagOperations($input: BulkTagInput!) {
  bulkTagOperations(input: $input) {
    success
    affectedCount
  }
}

// Add and remove tags in one operation
{
  "input": {
    "contactIds": ["contact_1", "contact_2"],
    "addTags": ["customer", "high-value"],
    "removeTags": ["prospect"]
  }
}
```

## Import/Export

### Import Contacts
```typescript
mutation ImportContacts($input: ImportContactsInput!) {
  importContacts(input: $input) {
    importId
    status
    totalRows
    validRows
    errors {
      row
      field
      error
    }
  }
}

// CSV Import
{
  "input": {
    "fileId": "file_123", // Uploaded via REST API
    "mapping": {
      "Email": "email",
      "First Name": "firstName",
      "Last Name": "lastName",
      "Company": "company",
      "Annual Revenue": "customFields.annualRevenue"
    },
    "options": {
      "updateExisting": true,
      "skipInvalid": false,
      "notifyOnComplete": true
    }
  }
}
```

### Export Contacts
```typescript
mutation ExportContacts($input: ExportContactsInput!) {
  exportContacts(input: $input) {
    exportId
    status
    downloadUrl
    expiresAt
  }
}

// Export with filters
{
  "input": {
    "format": "csv",
    "filters": {
      "tags": ["customer"],
      "createdAfter": "2024-01-01"
    },
    "fields": [
      "email",
      "firstName",
      "lastName",
      "company",
      "score",
      "customFields.budget"
    ]
  }
}
```

### Import Status Tracking
```typescript
subscription ImportProgress($importId: ID!) {
  importProgress(importId: $importId) {
    status
    progress
    processedRows
    successCount
    errorCount
    currentRow
  }
}
```

## AI Enrichment

### Automatic Enrichment
When a contact is created or updated:
1. Email validation and deliverability check
2. Social profile discovery
3. Company information lookup
4. Professional details enrichment
5. Behavioral insights generation

### Enrichment Sources
```typescript
interface EnrichmentData {
  isEnriched: boolean;
  enrichedAt?: Date;
  sources: EnrichmentSource[];
  
  // Professional
  currentCompany?: string;
  currentTitle?: string;
  previousCompanies?: Company[];
  skills?: string[];
  education?: Education[];
  
  // Social
  linkedinProfile?: LinkedInProfile;
  twitterProfile?: TwitterProfile;
  githubProfile?: GitHubProfile;
  
  // Contact
  phoneNumbers?: PhoneNumber[];
  emailAddresses?: Email[];
  
  // Demographics
  location?: Location;
  timezone?: string;
  languages?: string[];
  
  // Behavioral
  interests?: string[];
  technologies?: string[];
  buyingIntentSignals?: Signal[];
}
```

### Manual Enrichment Trigger
```typescript
mutation EnrichContact($id: ID!, $sources: [String!]) {
  enrichContact(id: $id, sources: $sources) {
    id
    enrichmentData
    enrichmentStatus
  }
}
```

### AI Insights Generation
```typescript
interface AIInsights {
  // Summary
  summary: string;
  lastUpdated: Date;
  
  // Predictions
  predictedValue: number;
  churnRisk: RiskLevel;
  upsellProbability: number;
  
  // Engagement
  engagementScore: number;
  engagementTrend: Trend;
  preferredChannel: CommunicationChannel;
  bestTimeToContact: TimeRange;
  
  // Recommendations
  nextBestAction: ActionRecommendation;
  talkingPoints: string[];
  personalizedPitches: Pitch[];
  
  // Personality
  personalityInsights?: PersonalityProfile;
  communicationStyle?: CommunicationStyle;
}
```

## Performance Optimization

### Database Indexes
```sql
-- Email lookup (unique)
CREATE UNIQUE INDEX idx_contacts_email ON contacts(workspace_id, email) WHERE deleted_at IS NULL;

-- Search optimization
CREATE INDEX idx_contacts_search ON contacts USING gin(
  to_tsvector('english', 
    coalesce(first_name, '') || ' ' || 
    coalesce(last_name, '') || ' ' || 
    coalesce(email, '') || ' ' || 
    coalesce(company, '')
  )
);

-- Score-based queries
CREATE INDEX idx_contacts_score ON contacts(workspace_id, score DESC);

-- Activity tracking
CREATE INDEX idx_contacts_last_activity ON contacts(workspace_id, last_activity_at DESC);

-- Custom field queries
CREATE INDEX idx_contacts_custom_fields ON contacts USING gin(custom_fields);

-- Vector similarity (AI search)
CREATE INDEX idx_contacts_embedding ON contacts USING ivfflat (embedding vector_cosine_ops);
```

### Caching Strategy
```typescript
// Redis cache keys
const cacheKeys = {
  contact: (id: string) => `contact:${id}`,
  contactList: (workspaceId: string, hash: string) => `contacts:${workspaceId}:${hash}`,
  enrichment: (email: string) => `enrichment:${email}`,
  aiInsights: (contactId: string) => `ai:contact:${contactId}`,
  searchResults: (query: string) => `search:${createHash(query)}`
};

// Cache TTLs
const cacheTTL = {
  contact: 5 * 60, // 5 minutes
  contactList: 60, // 1 minute
  enrichment: 24 * 60 * 60, // 24 hours
  aiInsights: 60 * 60, // 1 hour
  searchResults: 5 * 60 // 5 minutes
};
```

### Query Optimization
```typescript
// Use DataLoader for N+1 prevention
const contactLoader = new DataLoader(async (ids: string[]) => {
  const contacts = await prisma.contact.findMany({
    where: { id: { in: ids } }
  });
  return ids.map(id => contacts.find(c => c.id === id));
});

// Efficient pagination with cursor
query GetContacts($cursor: String, $limit: Int = 50) {
  contacts(after: $cursor, first: $limit) {
    edges {
      node {
        id
        email
        fullName
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

### Bulk Processing
```typescript
// Process large contact lists in batches
async function processContactsInBatches(
  contactIds: string[],
  batchSize: number = 100
) {
  const batches = chunk(contactIds, batchSize);
  
  for (const batch of batches) {
    await queue.add('process-contacts', {
      contactIds: batch
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });
  }
}
```

## Best Practices

### Data Quality
1. **Email Validation**: Always validate emails before saving
2. **Duplicate Prevention**: Check for existing contacts by email
3. **Data Normalization**: Consistent formatting for phones, names
4. **Required Fields**: Enforce minimum data requirements
5. **Regular Cleanup**: Archive old, inactive contacts

### Privacy & Security
1. **Data Access**: Implement row-level security
2. **PII Handling**: Encrypt sensitive fields
3. **Audit Trail**: Log all contact data changes
4. **GDPR Compliance**: Support right to deletion
5. **Export Controls**: Limit bulk exports

### UI/UX Guidelines
1. **Fast Search**: Show results as user types
2. **Smart Defaults**: Pre-fill from enrichment
3. **Inline Editing**: Edit without page refresh
4. **Bulk Actions**: Support multi-select operations
5. **Undo Support**: Allow reverting changes

### Integration Patterns
```typescript
// Webhook on contact change
{
  "event": "contact.updated",
  "data": {
    "id": "contact_123",
    "changes": {
      "score": { "old": 70, "new": 85 },
      "lifecycleStage": { "old": "lead", "new": "SQL" }
    },
    "triggeredBy": "automation_456"
  }
}

// Event-driven enrichment
on('contact.created', async (contact) => {
  await queue.add('enrich-contact', {
    contactId: contact.id,
    email: contact.email
  });
});

// Activity aggregation
on('activity.created', async (activity) => {
  if (activity.contactId) {
    await updateContactMetrics(activity.contactId);
  }
});
```

## Related Documentation

- [Database Schema](../architecture/database-schema.md) - Complete data model
- [GraphQL API](../api/graphql-schema.md) - API reference
- [AI Integration](./ai-integration.md) - AI enrichment details
- [Email Sync](./email-sync.md) - Email integration
- [Import Guide](../guides/import-contacts.md) - Detailed import instructions

## Advanced Use Cases

### Lead Scoring Model
```typescript
// Custom lead scoring based on your data
interface LeadScoringModel {
  // Demographic scoring
  demographic: {
    title: { weight: 10, patterns: ['CEO', 'VP', 'Director'] },
    company: { weight: 5, minEmployees: 50 },
    industry: { weight: 8, preferred: ['Technology', 'Finance'] }
  },
  
  // Behavioral scoring
  behavioral: {
    emailOpens: { weight: 2, multiplier: 1 },
    emailClicks: { weight: 5, multiplier: 2 },
    websiteVisits: { weight: 3, multiplier: 1.5 },
    contentDownloads: { weight: 10, multiplier: 3 }
  },
  
  // Engagement recency
  recency: {
    lastActivity: { weight: 20, decayDays: 30 }
  }
}
```

### Relationship Intelligence
```typescript
// Map decision-making units
interface DecisionMakingUnit {
  opportunity: Deal;
  contacts: {
    champion?: Contact;
    decisionMaker?: Contact;
    influencers: Contact[];
    blockers: Contact[];
  };
  strength: number; // 0-100
  risks: Risk[];
  recommendations: string[];
}
```

### Predictive Analytics
```typescript
// AI-powered predictions
interface ContactPredictions {
  // Purchase likelihood
  purchaseProbability: number;
  estimatedDealSize: number;
  expectedCloseDate: Date;
  
  // Risk analysis
  churnRisk: number;
  competitorRisk: string[];
  
  // Opportunities
  upsellOpportunities: Product[];
  crossSellOpportunities: Product[];
  
  // Optimal engagement
  bestChannel: 'email' | 'phone' | 'linkedin' | 'meeting';
  bestTime: { day: string; hour: number };
  messagingTone: 'formal' | 'casual' | 'technical';
}
```

---

*Platform Version: 1.0.0*  
*Last Updated: 2024-01-15*