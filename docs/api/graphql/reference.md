# GraphQL Schema Reference

## Overview

Complete reference documentation for the hasteCRM GraphQL API schema. This document provides detailed information about every type, field, enum, and directive available in the API.

> **Quick Links:**
> - [GraphQL Basics Guide](./basics.md) - Getting started
> - [GraphQL Advanced Guide](./advanced.md) - Advanced patterns
> - [Authentication Guide](../auth-guide.md) - Security setup
> - [Error Codes](../errors.md) - Error reference

## Table of Contents

1. [Scalars](#scalars)
2. [Enums](#enums)
3. [Interfaces](#interfaces)
4. [Object Types](#object-types)
5. [Input Types](#input-types)
6. [Queries](#queries)
7. [Mutations](#mutations)
8. [Subscriptions](#subscriptions)
9. [Directives](#directives)

## Scalars

### Built-in Scalars

| Scalar | Description | Example |
|--------|-------------|---------|
| `ID` | Unique identifier | `"contact_123abc"` |
| `String` | UTF-8 character sequence | `"John Doe"` |
| `Int` | 32-bit signed integer | `42` |
| `Float` | Double-precision floating-point | `99.99` |
| `Boolean` | True or false | `true` |

### Custom Scalars

```graphql
scalar DateTime      # ISO 8601 date-time string
scalar Date         # ISO 8601 date string
scalar Time         # ISO 8601 time string
scalar EmailAddress # Valid email address
scalar URL          # Valid URL
scalar JSON         # Arbitrary JSON value
scalar UUID         # UUID v4 string
scalar PhoneNumber  # E.164 format phone number
scalar Currency     # ISO 4217 currency code
scalar Decimal      # Arbitrary precision decimal
```

### Scalar Examples

```graphql
{
  createdAt: "2024-01-15T10:30:00Z"      # DateTime
  birthday: "1990-01-15"                 # Date
  meetingTime: "14:30:00"                # Time
  email: "john@haste.nyc"              # EmailAddress
  website: "https://haste.nyc"         # URL
  metadata: { custom: "data" }           # JSON
  id: "550e8400-e29b-41d4-a716-446655440000" # UUID
  phone: "+14155552671"                  # PhoneNumber
  currency: "USD"                        # Currency
  price: "99.99"                         # Decimal
}
```

## Enums

### UserRole

```graphql
enum UserRole {
  OWNER      # Workspace owner with full permissions
  ADMIN      # Administrative access
  MEMBER     # Standard user access
  VIEWER     # Read-only access
}
```

### LifecycleStage

```graphql
enum LifecycleStage {
  LEAD         # New, unqualified contact
  MQL          # Marketing Qualified Lead
  SQL          # Sales Qualified Lead
  OPPORTUNITY  # Active sales opportunity
  CUSTOMER     # Closed-won customer
  EVANGELIST   # Customer advocate
}
```

### ActivityType

```graphql
enum ActivityType {
  EMAIL_SENT
  EMAIL_RECEIVED
  EMAIL_OPENED
  EMAIL_CLICKED
  MEETING_HELD
  MEETING_SCHEDULED
  CALL_MADE
  CALL_RECEIVED
  NOTE_ADDED
  TASK_CREATED
  TASK_COMPLETED
  DEAL_CREATED
  DEAL_UPDATED
  DEAL_WON
  DEAL_LOST
  CONTACT_CREATED
  CONTACT_UPDATED
  CUSTOM
}
```

### TaskPriority

```graphql
enum TaskPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}
```

### TaskStatus

```graphql
enum TaskStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  CANCELLED
}
```

### DealStatus

```graphql
enum DealStatus {
  OPEN
  WON
  LOST
}
```

### SortDirection

```graphql
enum SortDirection {
  ASC   # Ascending order
  DESC  # Descending order
}
```

### ErrorCode

```graphql
enum ErrorCode {
  # Authentication
  UNAUTHENTICATED
  INVALID_TOKEN
  TOKEN_EXPIRED
  
  # Authorization
  FORBIDDEN
  INSUFFICIENT_PERMISSIONS
  
  # Validation
  VALIDATION_ERROR
  INVALID_INPUT
  
  # Resources
  NOT_FOUND
  ALREADY_EXISTS
  
  # Rate limiting
  RATE_LIMITED
  QUOTA_EXCEEDED
  
  # Server
  INTERNAL_ERROR
  SERVICE_UNAVAILABLE
}
```

## Interfaces

### Node

```graphql
interface Node {
  id: ID!
}
```

### Timestamped

```graphql
interface Timestamped {
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

### SoftDeletable

```graphql
interface SoftDeletable {
  deletedAt: DateTime
}
```

### Connection

```graphql
interface Connection {
  edges: [Edge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}
```

### Edge

```graphql
interface Edge {
  node: Node!
  cursor: String!
}
```

### Error

```graphql
interface Error {
  message: String!
  code: ErrorCode!
  path: [String!]
}
```

## Object Types

### User

```graphql
type User implements Node & Timestamped {
  # Identity
  id: ID!
  email: EmailAddress!
  firstName: String!
  lastName: String!
  fullName: String!
  avatar: URL
  
  # Authentication
  emailVerified: Boolean!
  twoFactorEnabled: Boolean!
  lastLoginAt: DateTime
  
  # Relationships
  workspaces: [WorkspaceMember!]!
  ownedContacts(first: Int, after: String): ContactConnection!
  assignedTasks(first: Int, after: String): TaskConnection!
  
  # Preferences
  preferences: UserPreferences!
  notificationSettings: NotificationSettings!
  
  # Timestamps
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

### Contact

```graphql
type Contact implements Node & Timestamped & SoftDeletable {
  # Identity
  id: ID!
  email: EmailAddress!
  firstName: String
  lastName: String
  fullName: String!
  phone: PhoneNumber
  mobile: PhoneNumber
  
  # Professional
  company: String
  title: String
  department: String
  website: URL
  
  # Location
  address: Address
  timezone: String
  
  # Social
  linkedinUrl: URL
  twitterHandle: String
  facebookUrl: URL
  
  # Metadata
  source: ContactSource!
  sourceDetails: JSON
  score: Int!
  lifecycleStage: LifecycleStage!
  tags: [Tag!]!
  customFields: JSON
  
  # AI & Enrichment
  enrichmentData: EnrichmentData
  aiInsights: ContactInsights
  
  # Relationships
  owner: User!
  company: Company
  activities(
    first: Int
    after: String
    filter: ActivityFilter
  ): ActivityConnection!
  emails(
    first: Int
    after: String
    filter: EmailFilter
  ): EmailConnection!
  deals(
    filter: DealFilter
  ): [Deal!]!
  notes(
    first: Int
    after: String
  ): NoteConnection!
  tasks(
    first: Int
    after: String
    filter: TaskFilter
  ): TaskConnection!
  
  # Computed fields
  daysSinceLastActivity: Int
  engagementScore: Float!
  predictedChurnRisk: Float
  
  # Timestamps
  lastActivityAt: DateTime
  lastContactedAt: DateTime
  createdAt: DateTime!
  updatedAt: DateTime!
  deletedAt: DateTime
}
```

### Company

```graphql
type Company implements Node & Timestamped & SoftDeletable {
  # Identity
  id: ID!
  name: String!
  domain: String
  website: URL
  
  # Details
  industry: String
  companySize: CompanySize
  annualRevenue: Decimal
  currency: Currency!
  description: String
  
  # Location
  headquarters: Address
  offices: [Address!]!
  timezone: String
  
  # Contact
  phone: PhoneNumber
  email: EmailAddress
  
  # Social
  linkedinUrl: URL
  twitterHandle: String
  facebookUrl: URL
  
  # Enrichment
  enrichmentData: CompanyEnrichmentData
  logoUrl: URL
  technologies: [String!]!
  
  # AI
  aiInsights: CompanyInsights
  industryClassification: IndustryClassification
  
  # Metadata
  customFields: JSON
  tags: [Tag!]!
  
  # Relationships
  parentCompany: Company
  subsidiaries: [Company!]!
  contacts(
    first: Int
    after: String
    filter: ContactFilter
  ): ContactConnection!
  deals(
    first: Int
    after: String
    filter: DealFilter
  ): DealConnection!
  owner: User!
  
  # Tracking
  employeeCount: Int
  foundedYear: Int
  lastActivityAt: DateTime
  
  # Timestamps
  createdAt: DateTime!
  updatedAt: DateTime!
  deletedAt: DateTime
}
```

### Deal

```graphql
type Deal implements Node & Timestamped & SoftDeletable {
  # Identity
  id: ID!
  title: String!
  description: String
  
  # Value
  value: Decimal!
  currency: Currency!
  probability: Float!
  expectedCloseDate: Date
  
  # Pipeline
  pipeline: Pipeline!
  stage: DealStage!
  status: DealStatus!
  
  # Relationships
  contacts: [Contact!]!
  company: Company
  owner: User!
  collaborators: [User!]!
  
  # Activities
  activities(
    first: Int
    after: String
    filter: ActivityFilter
  ): ActivityConnection!
  notes(
    first: Int
    after: String
  ): NoteConnection!
  tasks(
    first: Int
    after: String
    filter: TaskFilter
  ): TaskConnection!
  emails(
    first: Int
    after: String
  ): EmailConnection!
  
  # AI
  aiAnalysis: DealAnalysis
  predictedOutcome: PredictedOutcome
  riskFactors: [RiskFactor!]!
  
  # Metadata
  customFields: JSON
  tags: [Tag!]!
  
  # Tracking
  stageHistory: [StageHistoryEntry!]!
  wonReason: String
  lostReason: String
  competitorName: String
  
  # Timestamps
  stageEnteredAt: DateTime!
  lastActivityAt: DateTime
  closedAt: DateTime
  createdAt: DateTime!
  updatedAt: DateTime!
  deletedAt: DateTime
}
```

### Email

```graphql
type Email implements Node & Timestamped {
  # Identity
  id: ID!
  messageId: String!
  threadId: String!
  
  # Headers
  subject: String
  from: EmailParticipant!
  to: [EmailParticipant!]!
  cc: [EmailParticipant!]
  bcc: [EmailParticipant!]
  replyTo: EmailAddress
  
  # Content
  bodyHtml: String!
  bodyText: String!
  snippet: String!
  attachments: [Attachment!]!
  
  # Metadata
  folder: String!
  labels: [String!]!
  isRead: Boolean!
  isStarred: Boolean!
  isImportant: Boolean!
  isDraft: Boolean!
  
  # Tracking
  trackingId: String
  openedAt: DateTime
  clickedAt: DateTime
  bouncedAt: DateTime
  deliveredAt: DateTime
  
  # Relationships
  contact: Contact
  deal: Deal
  thread: EmailThread
  
  # AI
  aiSummary: String
  sentiment: SentimentAnalysis
  actionItems: [ActionItem!]!
  category: EmailCategory
  priority: EmailPriority
  
  # Timestamps
  sentAt: DateTime!
  receivedAt: DateTime!
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

### Activity

```graphql
type Activity implements Node & Timestamped {
  # Identity
  id: ID!
  type: ActivityType!
  title: String!
  description: String
  
  # Relationships
  contact: Contact
  company: Company
  deal: Deal
  user: User!
  
  # Metadata
  metadata: JSON!
  duration: Int # seconds
  outcome: String
  
  # Timestamps
  occurredAt: DateTime!
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

### Task

```graphql
type Task implements Node & Timestamped & SoftDeletable {
  # Identity
  id: ID!
  title: String!
  description: String
  type: TaskType!
  
  # Scheduling
  dueDate: Date!
  dueTime: Time
  reminderMinutes: Int
  
  # Status
  priority: TaskPriority!
  status: TaskStatus!
  
  # Relationships
  contact: Contact
  company: Company
  deal: Deal
  assignee: User!
  assignedBy: User
  
  # Recurrence
  recurrenceRule: RecurrenceRule
  recurrenceParent: Task
  
  # Completion
  completedAt: DateTime
  completedBy: User
  
  # Timestamps
  createdAt: DateTime!
  updatedAt: DateTime!
  deletedAt: DateTime
}
```

### Note

```graphql
type Note implements Node & Timestamped & SoftDeletable {
  # Content
  id: ID!
  content: String!
  contentHtml: String
  
  # Relationships
  contact: Contact
  company: Company
  deal: Deal
  author: User!
  
  # Metadata
  isPinned: Boolean!
  mentions: [User!]!
  attachments: [Attachment!]!
  
  # Timestamps
  createdAt: DateTime!
  updatedAt: DateTime!
  deletedAt: DateTime
}
```

## Input Types

### CreateContactInput

```graphql
input CreateContactInput {
  # Required
  email: EmailAddress!
  
  # Optional identity
  firstName: String
  lastName: String
  phone: PhoneNumber
  mobile: PhoneNumber
  
  # Professional
  company: String
  companyId: ID
  title: String
  department: String
  
  # Location
  address: AddressInput
  timezone: String
  
  # Social
  linkedinUrl: URL
  twitterHandle: String
  website: URL
  
  # Metadata
  source: ContactSource
  lifecycleStage: LifecycleStage
  tags: [String!]
  customFields: JSON
  ownerId: ID
}
```

### UpdateContactInput

```graphql
input UpdateContactInput {
  # Identity
  firstName: String
  lastName: String
  phone: PhoneNumber
  mobile: PhoneNumber
  
  # Professional
  company: String
  companyId: ID
  title: String
  department: String
  
  # Location
  address: AddressInput
  timezone: String
  
  # Social
  linkedinUrl: URL
  twitterHandle: String
  website: URL
  
  # Metadata
  lifecycleStage: LifecycleStage
  score: Int
  tags: [String!]
  customFields: JSON
  ownerId: ID
}
```

### ContactFilter

```graphql
input ContactFilter {
  # Basic filters
  search: String
  email: StringFilter
  company: StringFilter
  
  # Metadata filters
  lifecycleStage: [LifecycleStage!]
  tags: [String!]
  source: [ContactSource!]
  
  # Numeric filters
  score: IntFilter
  daysSinceLastActivity: IntFilter
  
  # Date filters
  createdAt: DateTimeFilter
  updatedAt: DateTimeFilter
  lastActivityAt: DateTimeFilter
  
  # Relationship filters
  ownerId: ID
  hasDeals: Boolean
  hasActivities: Boolean
  
  # Logical operators
  and: [ContactFilter!]
  or: [ContactFilter!]
  not: ContactFilter
}
```

### StringFilter

```graphql
input StringFilter {
  eq: String       # Equals
  ne: String       # Not equals
  in: [String!]    # In list
  notIn: [String!] # Not in list
  contains: String # Contains substring
  startsWith: String
  endsWith: String
  regex: String    # Regular expression
}
```

### IntFilter

```graphql
input IntFilter {
  eq: Int
  ne: Int
  gt: Int      # Greater than
  gte: Int     # Greater than or equal
  lt: Int      # Less than
  lte: Int     # Less than or equal
  in: [Int!]
  notIn: [Int!]
  between: IntRange
}
```

### DateTimeFilter

```graphql
input DateTimeFilter {
  eq: DateTime
  ne: DateTime
  gt: DateTime
  gte: DateTime
  lt: DateTime
  lte: DateTime
  between: DateTimeRange
  # Relative filters
  past: Duration   # e.g., "7d", "1m", "1y"
  future: Duration
}
```

### ContactSort

```graphql
input ContactSort {
  field: ContactSortField!
  direction: SortDirection!
}

enum ContactSortField {
  CREATED_AT
  UPDATED_AT
  LAST_ACTIVITY_AT
  SCORE
  EMAIL
  FIRST_NAME
  LAST_NAME
  COMPANY
}
```

### PaginationInput

```graphql
input PaginationInput {
  # Cursor-based
  first: Int
  after: String
  last: Int
  before: String
  
  # Offset-based (deprecated)
  limit: Int
  offset: Int
}
```

## Queries

### Contact Queries

```graphql
type Query {
  # Single contact
  contact(id: ID!): Contact
  
  # Contact list with filtering
  contacts(
    filter: ContactFilter
    sort: [ContactSort!]
    first: Int = 20
    after: String
  ): ContactConnection!
  
  # Search contacts
  searchContacts(
    query: String!
    filter: ContactFilter
    first: Int = 20
  ): ContactSearchConnection!
  
  # Similar contacts (AI-powered)
  similarContacts(
    contactId: ID!
    first: Int = 10
  ): [Contact!]!
  
  # Contact insights
  contactInsights(id: ID!): ContactInsights
  
  # Export contacts
  exportContacts(
    filter: ContactFilter
    format: ExportFormat!
    fields: [String!]
  ): Export!
}
```

### Company Queries

```graphql
type Query {
  # Single company
  company(id: ID!): Company
  
  # Company list
  companies(
    filter: CompanyFilter
    sort: [CompanySort!]
    first: Int = 20
    after: String
  ): CompanyConnection!
  
  # Search companies
  searchCompanies(
    query: String!
    filter: CompanyFilter
    first: Int = 20
  ): CompanySearchConnection!
  
  # Company insights
  companyInsights(id: ID!): CompanyInsights
}
```

### Deal Queries

```graphql
type Query {
  # Single deal
  deal(id: ID!): Deal
  
  # Deal list
  deals(
    filter: DealFilter
    sort: [DealSort!]
    first: Int = 20
    after: String
  ): DealConnection!
  
  # Pipeline
  pipeline(id: ID!): Pipeline
  pipelines: [Pipeline!]!
  
  # Deal analytics
  dealAnalytics(
    pipelineId: ID
    dateRange: DateRangeInput!
  ): DealAnalytics!
  
  # Deal predictions
  dealPredictions(
    dealId: ID!
  ): DealPredictions!
}
```

### Activity Queries

```graphql
type Query {
  # Activity feed
  activities(
    filter: ActivityFilter
    first: Int = 50
    after: String
  ): ActivityConnection!
  
  # Activity analytics
  activityAnalytics(
    dateRange: DateRangeInput!
    groupBy: ActivityGroupBy!
  ): ActivityAnalytics!
}
```

### User & Workspace Queries

```graphql
type Query {
  # Current user
  me: User!
  
  # User by ID
  user(id: ID!): User
  
  # Current workspace
  currentWorkspace: Workspace!
  
  # Workspace members
  workspaceMembers(
    first: Int = 50
    after: String
  ): WorkspaceMemberConnection!
}
```

## Mutations

### Contact Mutations

```graphql
type Mutation {
  # CRUD operations
  createContact(input: CreateContactInput!): Contact!
  updateContact(id: ID!, input: UpdateContactInput!): Contact!
  deleteContact(id: ID!): DeleteResult!
  
  # Bulk operations
  bulkCreateContacts(
    input: [CreateContactInput!]!
  ): BulkCreateResult!
  
  bulkUpdateContacts(
    ids: [ID!]!
    input: BulkUpdateContactInput!
  ): BulkUpdateResult!
  
  bulkDeleteContacts(ids: [ID!]!): BulkDeleteResult!
  
  # Special operations
  mergeContacts(
    primaryId: ID!
    mergeIds: [ID!]!
  ): Contact!
  
  enrichContact(id: ID!): Contact!
  
  generateContactInsights(id: ID!): ContactInsights!
}
```

### Deal Mutations

```graphql
type Mutation {
  # CRUD operations
  createDeal(input: CreateDealInput!): Deal!
  updateDeal(id: ID!, input: UpdateDealInput!): Deal!
  deleteDeal(id: ID!): DeleteResult!
  
  # Stage management
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
  
  # AI operations
  analyzeDeal(id: ID!): DealAnalysis!
  predictDealOutcome(id: ID!): PredictedOutcome!
}
```

### Email Mutations

```graphql
type Mutation {
  # Send email
  sendEmail(input: SendEmailInput!): Email!
  
  # Draft management
  saveDraft(input: DraftEmailInput!): Email!
  updateDraft(id: ID!, input: DraftEmailInput!): Email!
  deleteDraft(id: ID!): DeleteResult!
  
  # Email actions
  markEmailRead(id: ID!, read: Boolean!): Email!
  starEmail(id: ID!, starred: Boolean!): Email!
  moveEmail(id: ID!, folder: String!): Email!
  
  # AI operations
  generateEmailContent(
    input: GenerateEmailInput!
  ): GeneratedEmail!
  
  enhanceEmailContent(
    content: String!
    style: EmailStyle!
  ): String!
}
```

### Task Mutations

```graphql
type Mutation {
  # CRUD operations
  createTask(input: CreateTaskInput!): Task!
  updateTask(id: ID!, input: UpdateTaskInput!): Task!
  deleteTask(id: ID!): DeleteResult!
  
  # Task actions
  completeTask(id: ID!): Task!
  reopenTask(id: ID!): Task!
  assignTask(id: ID!, assigneeId: ID!): Task!
  
  # Bulk operations
  bulkCreateTasks(
    input: [CreateTaskInput!]!
  ): BulkCreateResult!
  
  bulkCompleteTasks(ids: [ID!]!): BulkUpdateResult!
}
```

### Note Mutations

```graphql
type Mutation {
  # CRUD operations
  createNote(input: CreateNoteInput!): Note!
  updateNote(id: ID!, input: UpdateNoteInput!): Note!
  deleteNote(id: ID!): DeleteResult!
  
  # Note actions
  pinNote(id: ID!, pinned: Boolean!): Note!
}
```

## Subscriptions

### Contact Subscriptions

```graphql
type Subscription {
  # Contact events
  contactCreated(workspaceId: ID!): Contact!
  contactUpdated(id: ID!): Contact!
  contactDeleted(workspaceId: ID!): ID!
  
  # Batch updates
  contactsUpdated(
    filter: ContactFilter
  ): ContactUpdateEvent!
}
```

### Deal Subscriptions

```graphql
type Subscription {
  # Deal events
  dealCreated(pipelineId: ID): Deal!
  dealUpdated(id: ID!): Deal!
  dealStageChanged(pipelineId: ID!): DealStageChange!
  dealClosed(workspaceId: ID!): Deal!
}
```

### Activity Subscriptions

```graphql
type Subscription {
  # Activity feed
  activityCreated(
    filter: ActivityFilter
  ): Activity!
  
  # Email events
  emailReceived(workspaceId: ID!): Email!
  emailSent(workspaceId: ID!): Email!
  emailStatusChanged(id: ID!): EmailStatusChange!
}
```

### Real-time Notifications

```graphql
type Subscription {
  # User notifications
  notification(userId: ID!): Notification!
  
  # Workspace events
  workspaceEvent(workspaceId: ID!): WorkspaceEvent!
}
```

## Directives

### Schema Directives

```graphql
# Authentication required
directive @auth on FIELD_DEFINITION | OBJECT

# Role-based access
directive @hasRole(
  roles: [UserRole!]!
) on FIELD_DEFINITION

# Owner-only access
directive @owner on FIELD_DEFINITION

# Workspace isolation
directive @workspace on FIELD_DEFINITION

# Deprecated field
directive @deprecated(
  reason: String = "No longer supported"
) on FIELD_DEFINITION | ENUM_VALUE

# Field complexity
directive @complexity(
  value: Int!
  multipliers: [String!]
) on FIELD_DEFINITION

# Rate limiting
directive @rateLimit(
  limit: Int!
  window: Int! # seconds
) on FIELD_DEFINITION

# Caching
directive @cacheControl(
  maxAge: Int # seconds
  scope: CacheControlScope
) on OBJECT | FIELD_DEFINITION
```

### Query Directives

```graphql
# Include field conditionally
directive @include(
  if: Boolean!
) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT

# Skip field conditionally
directive @skip(
  if: Boolean!
) on FIELD | FRAGMENT_SPREAD | INLINE_FRAGMENT

# Defer field loading
directive @defer(
  if: Boolean
  label: String
) on FRAGMENT_SPREAD | INLINE_FRAGMENT

# Stream list fields
directive @stream(
  if: Boolean
  initialCount: Int!
  label: String
) on FIELD
```

## Complete Example

```graphql
# Complex query with all features
query GetWorkspaceData(
  $contactFilter: ContactFilter!
  $dealFilter: DealFilter!
  $includeAnalytics: Boolean!
  $includeAI: Boolean!
) {
  currentWorkspace {
    id
    name
    subscription {
      plan
      status
      limits {
        contacts
        emails
        aiCredits
      }
    }
  }
  
  contacts(filter: $contactFilter, first: 50) {
    edges {
      node {
        ...ContactDetails
        aiInsights @include(if: $includeAI) {
          summary
          nextBestAction
          predictedValue
        }
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
  
  deals(filter: $dealFilter, first: 20) {
    edges {
      node {
        ...DealDetails
        predictedOutcome @include(if: $includeAI) {
          probability
          expectedCloseDate
          confidence
        }
      }
    }
  }
  
  analytics @include(if: $includeAnalytics) {
    contacts {
      total
      byStage {
        stage
        count
      }
    }
    deals {
      pipeline
      totalValue
      averageDealSize
      conversionRate
    }
  }
}

fragment ContactDetails on Contact {
  id
  email
  fullName
  company
  score
  lifecycleStage
  lastActivityAt
  owner {
    id
    fullName
  }
}

fragment DealDetails on Deal {
  id
  title
  value
  stage {
    id
    name
  }
  probability
  expectedCloseDate
  contacts {
    id
    fullName
  }
}
```

## Related Documentation

- [GraphQL Basics Guide](./basics.md) - Getting started
- [GraphQL Advanced Guide](./advanced.md) - Advanced patterns
- [API Comparison](../README.md) - REST vs GraphQL vs WebSocket
- [Authentication Guide](../auth-guide.md) - Security implementation
- [Error Handling](../errors.md) - Error codes and handling

---

*Schema Version: 1.0*  
*Last Updated: 2024-01-15*