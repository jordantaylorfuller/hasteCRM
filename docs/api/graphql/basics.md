# GraphQL API Basics

## Introduction

GraphQL is the primary API interface for the hasteCRM platform, providing a flexible and efficient way to query and mutate data. This guide covers the fundamentals of using our GraphQL API.

## Getting Started

### Endpoint

```
https://api.hastecrm.com/graphql
```

### Authentication

Include your JWT token in the Authorization header:

```bash
Authorization: Bearer YOUR_JWT_TOKEN
```

### Your First Query

```graphql
query GetMe {
  me {
    id
    email
    firstName
    lastName
    workspace {
      id
      name
    }
  }
}
```

## Basic Queries

### Fetching a Single Item

```graphql
query GetContact($id: ID!) {
  contact(id: $id) {
    id
    email
    firstName
    lastName
    company
    createdAt
  }
}
```

Variables:
```json
{
  "id": "contact_123"
}
```

### Fetching Multiple Items

```graphql
query ListContacts {
  contacts(first: 10) {
    edges {
      node {
        id
        email
        firstName
        lastName
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

### Filtering Data

```graphql
query FilterContacts {
  contacts(
    filter: {
      status: ACTIVE
      createdAfter: "2024-01-01"
    }
    first: 20
  ) {
    edges {
      node {
        id
        email
        status
        createdAt
      }
    }
  }
}
```

## Basic Mutations

### Creating Data

```graphql
mutation CreateContact($input: CreateContactInput!) {
  createContact(input: $input) {
    id
    email
    firstName
    lastName
    createdAt
  }
}
```

Variables:
```json
{
  "input": {
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "company": "Acme Corp"
  }
}
```

### Updating Data

```graphql
mutation UpdateContact($id: ID!, $input: UpdateContactInput!) {
  updateContact(id: $id, input: $input) {
    id
    email
    company
    updatedAt
  }
}
```

### Deleting Data

```graphql
mutation DeleteContact($id: ID!) {
  deleteContact(id: $id)
}
```

## Working with Relationships

### Nested Queries

```graphql
query ContactWithDetails {
  contact(id: "contact_123") {
    id
    email
    company {
      id
      name
      industry
    }
    deals {
      id
      title
      value
      stage {
        name
      }
    }
    recentActivities(first: 5) {
      type
      title
      occurredAt
    }
  }
}
```

### Including Related Data

```graphql
query DealWithRelations {
  deal(id: "deal_456") {
    id
    title
    value
    contact {
      email
      phone
    }
    pipeline {
      name
      stages {
        name
        order
      }
    }
  }
}
```

## Pagination

### Cursor-based Pagination

```graphql
query PaginatedContacts($cursor: String) {
  contacts(first: 20, after: $cursor) {
    edges {
      node {
        id
        email
      }
      cursor
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    totalCount
  }
}
```

### Pagination Loop Example

```javascript
async function getAllContacts() {
  const contacts = [];
  let hasNextPage = true;
  let cursor = null;
  
  while (hasNextPage) {
    const result = await client.query({
      query: PAGINATED_CONTACTS,
      variables: { cursor }
    });
    
    contacts.push(...result.data.contacts.edges.map(e => e.node));
    hasNextPage = result.data.contacts.pageInfo.hasNextPage;
    cursor = result.data.contacts.pageInfo.endCursor;
  }
  
  return contacts;
}
```

## Error Handling

### Query Errors

GraphQL errors are returned in a standard format:

```json
{
  "errors": [
    {
      "message": "Contact not found",
      "extensions": {
        "code": "NOT_FOUND",
        "id": "contact_123"
      },
      "path": ["contact"]
    }
  ],
  "data": {
    "contact": null
  }
}
```

### Handling Errors in Code

```javascript
try {
  const result = await client.query({ query: GET_CONTACT });
  
  if (result.errors) {
    // Handle GraphQL errors
    result.errors.forEach(error => {
      console.error(`Error: ${error.message}`);
    });
  }
  
  // Use data
  const contact = result.data.contact;
} catch (error) {
  // Handle network errors
  console.error('Network error:', error);
}
```

## Common Patterns

### Search Queries

```graphql
query SearchContacts($query: String!) {
  searchContacts(query: $query, limit: 10) {
    id
    email
    firstName
    lastName
    company
    score # Relevance score
  }
}
```

### Bulk Operations

```graphql
mutation BulkUpdateContacts($ids: [ID!]!, $input: BulkUpdateInput!) {
  bulkUpdateContacts(ids: $ids, input: $input) {
    successCount
    failureCount
    failures {
      id
      error
    }
  }
}
```

### Conditional Fields

```graphql
query ContactWithOptionalData($includeDeals: Boolean = false) {
  contact(id: "contact_123") {
    id
    email
    deals @include(if: $includeDeals) {
      id
      title
      value
    }
  }
}
```

## Using Fragments

### Defining Fragments

```graphql
fragment ContactBasics on Contact {
  id
  email
  firstName
  lastName
}

fragment ContactDetails on Contact {
  ...ContactBasics
  company
  phone
  createdAt
  updatedAt
}

query GetContactWithFragments {
  contact(id: "contact_123") {
    ...ContactDetails
    deals {
      id
      title
    }
  }
}
```

## Response Formatting

### Aliases

```graphql
query ContactComparison {
  oldContact: contact(id: "contact_123") {
    email
    updatedAt
  }
  newContact: contact(id: "contact_456") {
    email
    updatedAt
  }
}
```

### Custom Field Names

```graphql
query RenamedFields {
  contact(id: "contact_123") {
    contactId: id
    emailAddress: email
    fullName: firstName
    companyName: company
  }
}
```

## Development Tools

### GraphQL Playground

Access the interactive GraphQL IDE at:
```
http://localhost:4000/graphql
```

Features:
- Auto-complete
- Schema documentation
- Query history
- Variable editor

### Introspection Query

```graphql
query IntrospectionQuery {
  __schema {
    types {
      name
      kind
      description
    }
  }
}
```

## Best Practices

### 1. Request Only What You Need

❌ **Bad:**
```graphql
query GetEverything {
  contact(id: "123") {
    # Requesting all fields
    id
    email
    firstName
    lastName
    phone
    company
    # ... 50 more fields
  }
}
```

✅ **Good:**
```graphql
query GetContactEmail {
  contact(id: "123") {
    id
    email
  }
}
```

### 2. Use Variables

❌ **Bad:**
```graphql
query {
  contact(id: "contact_123") {
    email
  }
}
```

✅ **Good:**
```graphql
query GetContact($id: ID!) {
  contact(id: $id) {
    email
  }
}
```

### 3. Name Your Operations

❌ **Bad:**
```graphql
query {
  me {
    email
  }
}
```

✅ **Good:**
```graphql
query GetCurrentUser {
  me {
    email
  }
}
```

## Next Steps

- Learn about [Advanced GraphQL Patterns](./advanced.md)
- Explore the [Complete Schema Reference](./reference.md)
- Understand [Real-time Subscriptions](./advanced.md#subscriptions)
- Optimize with [Performance Best Practices](./advanced.md#performance)