# API Guide

## Overview

hasteCRM provides both GraphQL and REST APIs. GraphQL is the primary interface for complex operations, while REST handles specific use cases like file uploads and webhooks.

## Authentication

All API requests require authentication using JWT tokens.

### Login

```bash
POST /api/auth/login
{
  "email": "user@haste.nyc",
  "password": "password"
}

Response:
{
  "accessToken": "jwt-token",
  "refreshToken": "refresh-token",
  "user": { "id": "123", "email": "user@haste.nyc" }
}
```

### Using Tokens

```bash
# GraphQL
Authorization: Bearer <accessToken>

# REST
Authorization: Bearer <accessToken>
```

## GraphQL API

### Endpoint

```
POST https://api.haste.nyc/graphql
```

### Common Queries

#### Get Current User

```graphql
query GetViewer {
  viewer {
    id
    email
    firstName
    lastName
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

#### List Contacts

```graphql
query ListContacts($first: Int!, $after: String) {
  contacts(first: $first, after: $after) {
    edges {
      node {
        id
        firstName
        lastName
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
```

### Common Mutations

#### Create Contact

```graphql
mutation CreateContact($input: CreateContactInput!) {
  createContact(input: $input) {
    contact {
      id
      firstName
      lastName
      email
    }
    errors {
      field
      message
    }
  }
}

variables: {
  "input": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "companyId": "company-123"
  }
}
```

### Subscriptions

#### Real-time Contact Updates

```graphql
subscription OnContactCreated($workspaceId: ID!) {
  contactCreated(workspaceId: $workspaceId) {
    id
    firstName
    lastName
    email
    createdAt
  }
}
```

## REST API

### Base URL

```
https://api.haste.nyc/v1
```

### File Upload

```bash
POST /v1/files/upload
Content-Type: multipart/form-data

file: <binary>
```

### Export Contacts

```bash
POST /v1/contacts/export
{
  "format": "csv",
  "filters": {
    "status": "active"
  }
}
```

### Webhooks

#### Gmail Push Notifications

```bash
POST /v1/webhooks/gmail
{
  "message": {
    "data": "base64-encoded-data",
    "messageId": "msg-123"
  }
}
```

## Error Handling

### Error Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "fields": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

### Common Error Codes

- `UNAUTHORIZED` - Invalid or missing token
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Input validation failed
- `RATE_LIMITED` - Too many requests

## Rate Limiting

| Endpoint    | Authenticated | Limit    |
| ----------- | ------------- | -------- |
| GraphQL     | Yes           | 1000/min |
| REST API    | Yes           | 500/min  |
| File Upload | Yes           | 10/min   |

## Pagination

### Cursor-based (GraphQL)

```graphql
contacts(first: 20, after: "cursor123") {
  edges {
    node { ... }
    cursor
  }
  pageInfo {
    hasNextPage
    endCursor
  }
}
```

### Offset-based (REST)

```bash
GET /v1/contacts?page=2&limit=20
```

## Best Practices

1. **Use GraphQL for**:

   - Fetching related data
   - Real-time updates
   - Complex queries

2. **Use REST for**:

   - File operations
   - Webhooks
   - Simple CRUD operations

3. **Performance Tips**:
   - Request only needed fields
   - Use pagination for large lists
   - Cache responses when possible
