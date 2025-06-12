# GraphQL Schema Documentation

## Overview

The hasteCRM uses GraphQL as its primary API interface, providing a flexible and efficient way to query and mutate data. This document details the complete GraphQL schema, best practices, and implementation guidelines.

> **Quick Links:**
> - 🚀 [GraphQL Basics Guide](/docs/api/graphql/basics.md) - New to GraphQL? Start here
> - 🔐 [Authentication Guide](/docs/api/auth-guide.md) - JWT, OAuth, and security
> - ❌ [Error Handling Guide](/docs/api/errors.md) - Unified error codes and handling
> - 📄 [Pagination Guide](/docs/api/pagination.md) - Cursor-based pagination patterns
> - ⚡ [Rate Limiting Guide](/docs/api/rate-limiting.md) - Quotas and best practices

## Table of Contents

1. [Core Schema](#core-schema)
2. [Type Definitions](#type-definitions)
3. [Queries](#queries)
4. [Mutations](#mutations)
5. [Subscriptions](#subscriptions)
6. [Authentication & Authorization](#authentication--authorization)
7. [Error Handling](#error-handling)
8. [Performance & Optimization](#performance--optimization)
9. [Best Practices](#best-practices)

## Core Schema

### Base Types

```graphql
scalar DateTime
scalar JSON
scalar EmailAddress
scalar URL
scalar UUID

interface Node {
  id: ID!
}

interface Timestamped {
  createdAt: DateTime!
  updatedAt: DateTime!
}

interface SoftDeletable {
  deletedAt: DateTime
}
```

## Type Definitions

### User & Authentication

```graphql
type User implements Node & Timestamped {
  id: ID!
  email: EmailAddress!
  firstName: String!
  lastName: String!
  fullName: String!
  avatar: URL
  role: UserRole!
  workspaces: [WorkspaceMember!]!
  preferences: JSON
  lastLoginAt: DateTime
  emailVerified: Boolean!
  twoFactorEnabled: Boolean!
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum UserRole {
  OWNER
  ADMIN
  MEMBER
  VIEWER
}

type WorkspaceMember {
  id: ID!
  user: User!
  workspace: Workspace!
  role: UserRole!
  joinedAt: DateTime!
}

type Workspace implements Node & Timestamped {
  id: ID!
  name: String!
  slug: String!
  logo: URL
  settings: WorkspaceSettings!
  members: [WorkspaceMember!]!
  subscription: Subscription
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

### Contact Management

```graphql
type Contact implements Node & Timestamped & SoftDeletable {
  id: ID!
  email: EmailAddress!
  firstName: String
  lastName: String
  fullName: String!
  phone: String
  company: String
  jobTitle: String
  avatar: URL
  score: Float!
  lifecycleStage: LifecycleStage!
  tags: [Tag!]!
  customFields: JSON
  source: String
  sourceDetails: JSON
  
  # Relationships
  activities: [Activity!]!
  emails: [Email!]!
  deals: [Deal!]!
  notes: [Note!]!
  tasks: [Task!]!
  
  # AI Features
  aiInsights: ContactInsights
  enrichmentData: EnrichmentData
  
  # Metadata
  owner: User!
  workspace: Workspace!
  createdAt: DateTime!
  updatedAt: DateTime!
  deletedAt: DateTime
}

enum LifecycleStage {
  LEAD
  MQL
  SQL
  OPPORTUNITY
  CUSTOMER
  EVANGELIST
}

type ContactInsights {
  summary: String!
  personality: PersonalityProfile
  buyingStyle: BuyingStyle
  communicationPreferences: CommunicationPreferences
  interests: [String!]!
  painPoints: [String!]!
  decisionMakingRole: String
  recommendedApproach: String!
  nextBestAction: String
}
```

### Deal Management

```graphql
type Deal implements Node & Timestamped & SoftDeletable {
  id: ID!
  name: String!
  value: Float!
  currency: String!
  probability: Float!
  expectedCloseDate: DateTime
  stage: DealStage!
  pipeline: Pipeline!
  
  # Relationships
  contacts: [Contact!]!
  company: Company
  activities: [Activity!]!
  notes: [Note!]!
  tasks: [Task!]!
  
  # AI Features
  aiAnalysis: DealAnalysis
  predictedOutcome: PredictedOutcome
  
  # Metadata
  owner: User!
  workspace: Workspace!
  createdAt: DateTime!
  updatedAt: DateTime!
  deletedAt: DateTime
  closedAt: DateTime
  lostReason: String
}

type DealStage {
  id: ID!
  name: String!
  order: Int!
  probability: Float!
  pipeline: Pipeline!
}

type Pipeline {
  id: ID!
  name: String!
  stages: [DealStage!]!
  isDefault: Boolean!
  workspace: Workspace!
}
```

### Email & Communication

```graphql
type Email implements Node & Timestamped {
  id: ID!
  messageId: String!
  threadId: String!
  subject: String
  from: EmailAddress!
  to: [EmailAddress!]!
  cc: [EmailAddress!]
  bcc: [EmailAddress!]
  body: String!
  bodyText: String!
  snippet: String!
  
  # Email metadata
  sentAt: DateTime!
  receivedAt: DateTime!
  isRead: Boolean!
  isStarred: Boolean!
  labels: [String!]!
  
  # Tracking
  openedAt: DateTime
  clickedAt: DateTime
  repliedAt: DateTime
  bouncedAt: DateTime
  
  # Relationships
  contact: Contact
  deal: Deal
  thread: EmailThread
  attachments: [Attachment!]!
  
  # AI Features
  aiSummary: String
  sentiment: SentimentAnalysis
  actionItems: [ActionItem!]!
  
  # Metadata
  workspace: Workspace!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type EmailThread {
  id: ID!
  subject: String!
  emails: [Email!]!
  participants: [Contact!]!
  lastEmailAt: DateTime!
  emailCount: Int!
  aiSummary: String
}
```

### Activities & Tasks

```graphql
type Activity implements Node & Timestamped {
  id: ID!
  type: ActivityType!
  subject: String!
  description: String
  startTime: DateTime!
  endTime: DateTime
  duration: Int
  
  # Relationships
  contact: Contact
  deal: Deal
  participants: [User!]!
  
  # Metadata
  owner: User!
  workspace: Workspace!
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum ActivityType {
  CALL
  MEETING
  EMAIL
  NOTE
  TASK
}

type Task implements Node & Timestamped {
  id: ID!
  title: String!
  description: String
  dueDate: DateTime!
  priority: TaskPriority!
  status: TaskStatus!
  
  # Relationships
  contact: Contact
  deal: Deal
  assignee: User!
  
  # Metadata
  workspace: Workspace!
  createdAt: DateTime!
  updatedAt: DateTime!
  completedAt: DateTime
}

enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  COMPLETED
  CANCELLED
}
```

## Queries

### Contact Queries

```graphql
type Query {
  # Get single contact
  contact(id: ID!): Contact
  
  # List contacts with filtering and pagination
  contacts(
    filter: ContactFilter
    sort: ContactSort
    pagination: PaginationInput
  ): ContactConnection!
  
  # Search contacts
  searchContacts(
    query: String!
    filters: ContactFilter
    limit: Int = 10
  ): [Contact!]!
  
  # Get contact insights
  contactInsights(id: ID!): ContactInsights
  
  # Get similar contacts
  similarContacts(
    contactId: ID!
    limit: Int = 5
  ): [Contact!]!
}

input ContactFilter {
  lifecycleStage: [LifecycleStage!]
  tags: [String!]
  scoreMin: Float
  scoreMax: Float
  createdAfter: DateTime
  createdBefore: DateTime
  hasEmail: Boolean
  hasPhone: Boolean
  owner: ID
}

input ContactSort {
  field: ContactSortField!
  direction: SortDirection!
}

enum ContactSortField {
  CREATED_AT
  UPDATED_AT
  SCORE
  LAST_ACTIVITY
  NAME
  EMAIL
}

enum SortDirection {
  ASC
  DESC
}
```

### Deal Queries

```graphql
type Query {
  # Get single deal
  deal(id: ID!): Deal
  
  # List deals with filtering
  deals(
    filter: DealFilter
    sort: DealSort
    pagination: PaginationInput
  ): DealConnection!
  
  # Get pipeline
  pipeline(id: ID!): Pipeline
  
  # List pipelines
  pipelines: [Pipeline!]!
  
  # Deal analytics
  dealAnalytics(
    pipelineId: ID
    dateRange: DateRangeInput!
  ): DealAnalytics!
}

input DealFilter {
  pipeline: ID
  stage: ID
  owner: ID
  minValue: Float
  maxValue: Float
  probability: FloatRange
  expectedCloseDateRange: DateRangeInput
  includeClosedDeals: Boolean
}
```

### Email Queries

```graphql
type Query {
  # Get single email
  email(id: ID!): Email
  
  # List emails
  emails(
    filter: EmailFilter
    sort: EmailSort
    pagination: PaginationInput
  ): EmailConnection!
  
  # Get email thread
  emailThread(id: ID!): EmailThread
  
  # Search emails
  searchEmails(
    query: String!
    filters: EmailFilter
    limit: Int = 20
  ): [Email!]!
}

input EmailFilter {
  from: EmailAddress
  to: EmailAddress
  subject: String
  hasAttachment: Boolean
  isRead: Boolean
  isStarred: Boolean
  sentAfter: DateTime
  sentBefore: DateTime
  labels: [String!]
}
```

## Mutations

### Contact Mutations

```graphql
type Mutation {
  # Create contact
  createContact(input: CreateContactInput!): Contact!
  
  # Update contact
  updateContact(id: ID!, input: UpdateContactInput!): Contact!
  
  # Delete contact (soft delete)
  deleteContact(id: ID!): DeleteResult!
  
  # Merge contacts
  mergeContacts(
    primaryId: ID!
    mergeIds: [ID!]!
  ): Contact!
  
  # Bulk operations
  bulkUpdateContacts(
    ids: [ID!]!
    input: BulkUpdateContactInput!
  ): BulkUpdateResult!
  
  # AI operations
  enrichContact(id: ID!): Contact!
  generateContactInsights(id: ID!): ContactInsights!
}

input CreateContactInput {
  email: EmailAddress!
  firstName: String
  lastName: String
  phone: String
  company: String
  jobTitle: String
  lifecycleStage: LifecycleStage
  tags: [String!]
  customFields: JSON
  source: String
  sourceDetails: JSON
  ownerId: ID
}

input UpdateContactInput {
  firstName: String
  lastName: String
  phone: String
  company: String
  jobTitle: String
  lifecycleStage: LifecycleStage
  score: Float
  tags: [String!]
  customFields: JSON
  ownerId: ID
}
```

### Deal Mutations

```graphql
type Mutation {
  # Create deal
  createDeal(input: CreateDealInput!): Deal!
  
  # Update deal
  updateDeal(id: ID!, input: UpdateDealInput!): Deal!
  
  # Move deal stage
  moveDealStage(
    dealId: ID!
    stageId: ID!
  ): Deal!
  
  # Close deal
  closeDeal(
    id: ID!
    won: Boolean!
    reason: String
  ): Deal!
  
  # Delete deal
  deleteDeal(id: ID!): DeleteResult!
  
  # AI operations
  analyzeDeal(id: ID!): DealAnalysis!
  predictDealOutcome(id: ID!): PredictedOutcome!
}

input CreateDealInput {
  name: String!
  value: Float!
  currency: String!
  pipelineId: ID!
  stageId: ID!
  contactIds: [ID!]
  companyId: ID
  expectedCloseDate: DateTime
  ownerId: ID
}
```

### Email Mutations

```graphql
type Mutation {
  # Send email
  sendEmail(input: SendEmailInput!): Email!
  
  # Save draft
  saveDraft(input: DraftEmailInput!): Email!
  
  # Update email
  updateEmail(
    id: ID!
    input: UpdateEmailInput!
  ): Email!
  
  # Mark as read/unread
  markEmailRead(id: ID!, read: Boolean!): Email!
  
  # Star/unstar email
  starEmail(id: ID!, starred: Boolean!): Email!
  
  # AI operations
  generateEmailContent(
    input: GenerateEmailInput!
  ): GeneratedEmail!
  
  enhanceEmailContent(
    content: String!
    style: EmailStyle!
  ): String!
}

input SendEmailInput {
  to: [EmailAddress!]!
  cc: [EmailAddress!]
  bcc: [EmailAddress!]
  subject: String!
  body: String!
  attachmentIds: [ID!]
  trackOpens: Boolean
  trackClicks: Boolean
  scheduleSendAt: DateTime
}
```

## Subscriptions

```graphql
type Subscription {
  # Contact updates
  contactUpdated(id: ID!): Contact!
  contactCreated(workspaceId: ID!): Contact!
  contactDeleted(workspaceId: ID!): ID!
  
  # Deal updates
  dealUpdated(id: ID!): Deal!
  dealStageChanged(pipelineId: ID!): DealStageChange!
  dealClosed(workspaceId: ID!): Deal!
  
  # Email updates
  emailReceived(workspaceId: ID!): Email!
  emailSent(workspaceId: ID!): Email!
  emailStatusChanged(id: ID!): EmailStatusChange!
  
  # Real-time notifications
  notification(userId: ID!): Notification!
}

type DealStageChange {
  deal: Deal!
  previousStage: DealStage!
  newStage: DealStage!
  changedBy: User!
  changedAt: DateTime!
}

type EmailStatusChange {
  email: Email!
  status: EmailStatus!
  timestamp: DateTime!
}

enum EmailStatus {
  SENT
  DELIVERED
  OPENED
  CLICKED
  BOUNCED
  COMPLAINED
}
```

## Authentication & Authorization

> 📖 **See Also:** [Complete Authentication Guide](/docs/api/auth-guide.md) for detailed JWT, OAuth 2.0, and MFA implementation.

### Directives

```graphql
directive @auth on FIELD_DEFINITION | OBJECT
directive @hasRole(roles: [UserRole!]!) on FIELD_DEFINITION
directive @owner on FIELD_DEFINITION
directive @workspace on FIELD_DEFINITION

# Usage examples
type Query {
  # Requires authentication
  me: User! @auth
  
  # Requires specific roles
  workspaceSettings: WorkspaceSettings! @auth @hasRole(roles: [OWNER, ADMIN])
  
  # Owner-only access
  myContacts: [Contact!]! @auth @owner
  
  # Workspace isolation
  contacts: [Contact!]! @auth @workspace
}
```

### Context

```typescript
interface GraphQLContext {
  user: User | null;
  workspace: Workspace | null;
  permissions: Permission[];
  dataloaders: DataLoaders;
  services: Services;
}
```

## Error Handling

> 📖 **See Also:** [Complete Error Handling Guide](/docs/api/errors.md) for unified error codes across all APIs and recovery strategies.

### Error Types

```graphql
interface Error {
  message: String!
  code: String!
  path: [String!]
}

type ValidationError implements Error {
  message: String!
  code: String!
  path: [String!]
  field: String!
  value: String
}

type AuthenticationError implements Error {
  message: String!
  code: String!
  path: [String!]
}

type AuthorizationError implements Error {
  message: String!
  code: String!
  path: [String!]
  requiredRole: UserRole
}

type NotFoundError implements Error {
  message: String!
  code: String!
  path: [String!]
  resource: String!
  id: ID!
}

union AppError = ValidationError | AuthenticationError | AuthorizationError | NotFoundError
```

### Error Codes

```typescript
enum ErrorCode {
  // Authentication
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // Authorization
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  
  // Resources
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  
  // Rate limiting
  RATE_LIMITED = 'RATE_LIMITED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  
  // Server errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE'
}
```

## Performance & Optimization

> 📖 **See Also:** [Rate Limiting Guide](/docs/api/rate-limiting.md) for complexity limits and optimization strategies.

### Query Complexity

```graphql
# Query complexity calculation
type Query {
  # Complexity: 1 + (10 * limit)
  contacts(limit: Int = 20): [Contact!]! 
    @complexity(value: 1, multipliers: ["limit"])
  
  # Complexity: 1 + nested field complexity
  contact(id: ID!): Contact 
    @complexity(value: 1)
  
  # Complexity: 10 + (5 * limit)
  searchContacts(query: String!, limit: Int = 10): [Contact!]! 
    @complexity(value: 10, multipliers: ["limit"])
}

type Contact {
  # Simple fields: complexity 1
  id: ID! @complexity(value: 1)
  email: String! @complexity(value: 1)
  
  # Computed fields: higher complexity
  aiInsights: ContactInsights @complexity(value: 5)
  
  # Nested queries: multiplied complexity
  activities(limit: Int = 10): [Activity!]! 
    @complexity(value: 1, multipliers: ["limit"])
}

# Maximum allowed complexity: 1000
```

### DataLoader Implementation

```typescript
// Batch loading to prevent N+1 queries
const createDataLoaders = () => ({
  userLoader: new DataLoader(async (ids: string[]) => {
    const users = await prisma.user.findMany({
      where: { id: { in: ids } }
    });
    return ids.map(id => users.find(u => u.id === id));
  }),
  
  contactLoader: new DataLoader(async (ids: string[]) => {
    const contacts = await prisma.contact.findMany({
      where: { id: { in: ids } }
    });
    return ids.map(id => contacts.find(c => c.id === id));
  }),
  
  // Nested relationship loader
  contactActivitiesLoader: new DataLoader(async (contactIds: string[]) => {
    const activities = await prisma.activity.findMany({
      where: { contactId: { in: contactIds } },
      orderBy: { createdAt: 'desc' }
    });
    
    return contactIds.map(id => 
      activities.filter(a => a.contactId === id)
    );
  })
});
```

### Caching Strategy

```graphql
type Query {
  # Cache for 5 minutes
  currentUser: User! @cacheControl(maxAge: 300)
  
  # Cache for 1 hour
  workspaceSettings: WorkspaceSettings! @cacheControl(maxAge: 3600)
  
  # No cache for real-time data
  recentActivities: [Activity!]! @cacheControl(maxAge: 0)
}
```

## Best Practices

### 1. Pagination

> 📖 **See Also:** [Complete Pagination Guide](/docs/api/pagination.md) for advanced patterns and examples.

Always use cursor-based pagination for large datasets:

```graphql
type ContactConnection {
  edges: [ContactEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type ContactEdge {
  node: Contact!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

### 2. Field Selection

Be selective with fields to minimize payload:

```graphql
# Bad - fetches everything
query {
  contacts {
    id
    email
    firstName
    lastName
    activities {
      id
      type
      subject
      description
      startTime
      endTime
    }
  }
}

# Good - fetch only needed fields
query {
  contacts {
    id
    fullName
    email
    activities(limit: 5) {
      id
      type
      subject
    }
  }
}
```

### 3. Batching Mutations

Use bulk operations when possible:

```graphql
mutation {
  bulkUpdateContacts(
    ids: ["1", "2", "3"]
    input: { lifecycleStage: CUSTOMER }
  ) {
    successCount
    failureCount
    errors {
      id
      message
    }
  }
}
```

### 4. Error Handling

Always handle errors gracefully:

```graphql
query GetContact($id: ID!) {
  contact(id: $id) {
    id
    email
    fullName
  }
}

# Response with error
{
  "data": {
    "contact": null
  },
  "errors": [{
    "message": "Contact not found",
    "code": "NOT_FOUND",
    "path": ["contact"],
    "extensions": {
      "resource": "Contact",
      "id": "123"
    }
  }]
}
```

### 5. Schema Evolution

Use deprecation for backward compatibility:

```graphql
type Contact {
  # Deprecated field
  name: String @deprecated(reason: "Use fullName instead")
  
  # New field
  fullName: String!
  
  # Deprecated enum value
  lifecycleStage: LifecycleStage!
}

enum LifecycleStage {
  LEAD
  MARKETING_QUALIFIED @deprecated(reason: "Use MQL")
  MQL
  SALES_QUALIFIED @deprecated(reason: "Use SQL")
  SQL
  OPPORTUNITY
  CUSTOMER
}
```

## Testing

### Query Testing

```typescript
describe('Contact Queries', () => {
  it('should fetch contact with nested data', async () => {
    const query = `
      query GetContact($id: ID!) {
        contact(id: $id) {
          id
          email
          aiInsights {
            summary
            nextBestAction
          }
        }
      }
    `;
    
    const result = await graphqlRequest(query, { id: 'contact_123' });
    
    expect(result.data.contact).toBeDefined();
    expect(result.data.contact.email).toBe('test@haste.nyc');
    expect(result.data.contact.aiInsights).toBeDefined();
  });
});
```

### Performance Testing

```bash
# Load test GraphQL endpoints
pnpm graphql:load-test

# Profile query performance
pnpm graphql:profile
```

---

**Documentation Version**: 1.0  
**Last Updated**: 2024-01-15