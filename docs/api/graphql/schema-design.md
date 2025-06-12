# GraphQL Schema Design

## Overview

The hasteCRM GraphQL API follows a schema-first design approach with strong typing and clear separation of concerns. This document outlines our schema design principles and patterns.

## Design Principles

### 1. Domain-Driven Design
- Each domain (contacts, deals, emails) has its own module
- Clear boundaries between domains
- Shared types in common module

### 2. Relay Specification
- Implements Node interface for all entities
- Cursor-based pagination for lists
- Global object identification

### 3. Strong Typing
- No nullable fields without reason
- Clear input/output type separation
- Comprehensive enum types

## Core Schema Structure

```graphql
# Root Types
type Query {
  viewer: User!
  node(id: ID!): Node
  nodes(ids: [ID!]!): [Node]!
}

type Mutation {
  # Domain-specific mutations
}

type Subscription {
  # Real-time updates
}

# Node Interface (Relay)
interface Node {
  id: ID!
}

# Pagination
interface Connection {
  edges: [Edge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

interface Edge {
  node: Node!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}
```

## Domain Schemas

### User & Authentication

```graphql
type User implements Node {
  id: ID!
  email: String!
  firstName: String
  lastName: String
  fullName: String!
  avatarUrl: String
  role: UserRole!
  workspaces: WorkspaceConnection!
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum UserRole {
  SUPER_ADMIN
  ADMIN
  USER
  VIEWER
}

type AuthPayload {
  user: User!
  accessToken: String!
  refreshToken: String!
}
```

### Contacts

```graphql
type Contact implements Node {
  id: ID!
  firstName: String
  lastName: String
  fullName: String!
  email: String
  phone: String
  title: String
  company: Company
  avatarUrl: String
  
  # Metadata
  source: ContactSource!
  status: ContactStatus!
  score: Int!
  tags: [Tag!]!
  customFields: [CustomField!]!
  
  # Related data
  activities(
    first: Int
    after: String
    filter: ActivityFilter
  ): ActivityConnection!
  
  deals(
    first: Int
    after: String
    filter: DealFilter
  ): DealConnection!
  
  emails(
    first: Int
    after: String
    filter: EmailFilter
  ): EmailConnection!
  
  # Timestamps
  lastActivityAt: DateTime
  createdAt: DateTime!
  updatedAt: DateTime!
}

input CreateContactInput {
  firstName: String
  lastName: String
  email: String
  phone: String
  title: String
  companyId: ID
  customFields: [CustomFieldInput!]
}

input UpdateContactInput {
  id: ID!
  firstName: String
  lastName: String
  email: String
  phone: String
  title: String
  companyId: ID
  customFields: [CustomFieldInput!]
}
```

### Companies

```graphql
type Company implements Node {
  id: ID!
  name: String!
  domain: String
  website: String
  logoUrl: String
  description: String
  
  # Details
  industry: String
  size: String
  revenue: BigInt
  foundedYear: Int
  
  # Related data
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
  
  # Timestamps
  createdAt: DateTime!
  updatedAt: DateTime!
}
```

### Deals & Pipelines

```graphql
type Pipeline implements Node {
  id: ID!
  name: String!
  type: PipelineType!
  stages: [Stage!]!
  isDefault: Boolean!
  color: String!
  
  deals(
    first: Int
    after: String
    filter: DealFilter
  ): DealConnection!
  
  statistics: PipelineStatistics!
}

type Stage implements Node {
  id: ID!
  name: String!
  order: Int!
  probability: Int!
  color: String!
  pipeline: Pipeline!
  
  deals(
    first: Int
    after: String
  ): DealConnection!
}

type Deal implements Node {
  id: ID!
  title: String!
  value: Money!
  probability: Int!
  closeDate: DateTime
  status: DealStatus!
  
  # Relationships
  pipeline: Pipeline!
  stage: Stage!
  owner: User!
  company: Company
  contacts: [Contact!]!
  
  # Activity
  activities(
    first: Int
    after: String
  ): ActivityConnection!
  
  # Timestamps
  createdAt: DateTime!
  updatedAt: DateTime!
  closedAt: DateTime
}

# Custom Scalar
scalar Money
```

### Activities & Timeline

```graphql
type Activity implements Node {
  id: ID!
  type: ActivityType!
  title: String!
  description: String
  metadata: JSON!
  
  # Relationships
  user: User!
  contact: Contact
  company: Company
  deal: Deal
  
  # Timestamp
  createdAt: DateTime!
}

enum ActivityType {
  EMAIL_SENT
  EMAIL_RECEIVED
  CALL_MADE
  CALL_RECEIVED
  MEETING_SCHEDULED
  MEETING_COMPLETED
  NOTE_ADDED
  TASK_CREATED
  TASK_COMPLETED
  DEAL_CREATED
  DEAL_UPDATED
  CONTACT_CREATED
  CONTACT_UPDATED
}

type ActivityConnection implements Connection {
  edges: [ActivityEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type ActivityEdge implements Edge {
  node: Activity!
  cursor: String!
}
```

## Query Patterns

### Viewer Pattern
```graphql
query GetViewer {
  viewer {
    id
    email
    fullName
    workspaces {
      edges {
        node {
          id
          name
          role
        }
      }
    }
  }
}
```

### Connection Queries
```graphql
query GetContacts($first: Int!, $after: String, $filter: ContactFilter) {
  viewer {
    workspace {
      contacts(first: $first, after: $after, filter: $filter) {
        edges {
          node {
            id
            fullName
            email
            company {
              name
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
    }
  }
}
```

### Node Query
```graphql
query GetNode($id: ID!) {
  node(id: $id) {
    ... on Contact {
      fullName
      email
    }
    ... on Company {
      name
      domain
    }
    ... on Deal {
      title
      value
    }
  }
}
```

## Mutation Patterns

### Create Mutations
```graphql
mutation CreateContact($input: CreateContactInput!) {
  createContact(input: $input) {
    contact {
      id
      fullName
      email
    }
    errors {
      field
      message
    }
  }
}
```

### Update Mutations
```graphql
mutation UpdateContact($input: UpdateContactInput!) {
  updateContact(input: $input) {
    contact {
      id
      fullName
      email
    }
    errors {
      field
      message
    }
  }
}
```

### Batch Operations
```graphql
mutation BatchUpdateContacts($ids: [ID!]!, $data: UpdateContactData!) {
  batchUpdateContacts(ids: $ids, data: $data) {
    updatedCount
    contacts {
      id
      fullName
    }
    errors {
      field
      message
    }
  }
}
```

## Subscription Patterns

### Entity Updates
```graphql
subscription OnContactUpdated($contactId: ID!) {
  contactUpdated(contactId: $contactId) {
    id
    fullName
    email
    updatedAt
  }
}
```

### Activity Feed
```graphql
subscription OnActivity($workspaceId: ID!) {
  activityCreated(workspaceId: $workspaceId) {
    id
    type
    title
    user {
      fullName
    }
    createdAt
  }
}
```

## Error Handling

### Field Errors
```graphql
type FieldError {
  field: String!
  message: String!
  code: ErrorCode!
}

enum ErrorCode {
  REQUIRED
  INVALID
  DUPLICATE
  NOT_FOUND
  FORBIDDEN
  RATE_LIMITED
}
```

### Mutation Response Pattern
```graphql
type ContactMutationPayload {
  contact: Contact
  errors: [FieldError!]
  userErrors: [String!] @deprecated(reason: "Use errors field")
}
```

## Custom Scalars

```graphql
scalar DateTime
scalar Date
scalar Time
scalar JSON
scalar EmailAddress
scalar URL
scalar PhoneNumber
scalar Money
scalar BigInt
```

## Directives

```graphql
directive @auth(requires: UserRole = USER) on FIELD_DEFINITION
directive @deprecated(reason: String!) on FIELD_DEFINITION | ENUM_VALUE
directive @rateLimit(window: Int!, max: Int!) on FIELD_DEFINITION
directive @workspace on FIELD_DEFINITION
```

## Best Practices

### 1. Naming Conventions
- Types: PascalCase
- Fields: camelCase
- Enums: SCREAMING_SNAKE_CASE
- Input types: suffix with "Input"
- Payloads: suffix with "Payload"

### 2. Nullability
- Required fields are non-null
- Lists are non-null but can be empty
- Error fields are nullable

### 3. Pagination
- Always use cursor-based pagination
- Default page size: 20
- Maximum page size: 100

### 4. Filtering
- Use input objects for complex filters
- Support common operators (eq, contains, gt, lt)
- Allow combining filters with AND/OR

### 5. Security
- Always check workspace context
- Implement field-level permissions
- Rate limit expensive queries
- Limit query depth