# REST API Overview

## Introduction

The hasteCRM REST API provides a comprehensive set of endpoints for integrating with external systems and building custom applications. While our primary API is GraphQL-based, the REST API offers a familiar interface for developers who prefer RESTful conventions.

## Base URL

```
Production: https://api.haste.nyc/v1
Staging: https://api-staging.haste.nyc/v1
Development: http://localhost:4000/v1
```

## Authentication

All REST API requests require authentication using either:

1. **Bearer Token** (recommended)
```http
Authorization: Bearer YOUR_ACCESS_TOKEN
```

2. **API Key** (for server-to-server)
```http
X-API-Key: YOUR_API_KEY
```

## Request Format

- All requests must include `Content-Type: application/json`
- Request bodies must be valid JSON
- Date/time values should be in ISO 8601 format
- All text should be UTF-8 encoded

## Response Format

```json
{
  "data": {
    // Response data
  },
  "meta": {
    "requestId": "req_1234567890",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Error Response

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested resource was not found",
    "details": {
      "resource": "contact",
      "id": "123"
    }
  },
  "meta": {
    "requestId": "req_1234567890",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## HTTP Status Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 422 | Unprocessable Entity |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

## Rate Limiting

- **Default limit**: 1000 requests per hour
- **Burst limit**: 100 requests per minute
- Rate limit headers included in all responses:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

## Pagination

List endpoints support pagination using cursor-based pagination:

```http
GET /v1/contacts?cursor=eyJpZCI6MTIzfQ&limit=50
```

Response includes pagination metadata:

```json
{
  "data": [...],
  "meta": {
    "cursor": {
      "next": "eyJpZCI6MTczfQ",
      "previous": "eyJpZCI6NzN9",
      "hasMore": true
    }
  }
}
```

## Filtering

Use query parameters for filtering:

```http
GET /v1/contacts?status=active&created_after=2024-01-01
```

## Sorting

Use the `sort` parameter with field names:

```http
GET /v1/contacts?sort=-created_at,last_name
```

- Prefix with `-` for descending order
- Default is ascending order

## Field Selection

Use the `fields` parameter to specify which fields to return:

```http
GET /v1/contacts?fields=id,email,first_name,last_name
```

## Versioning

The API version is included in the URL path. We follow semantic versioning and maintain backward compatibility within major versions.

Current version: `v1`

## Available Endpoints

### Core Resources

- [Authentication](./authentication.md) - Login, logout, token management
- [Contacts](./endpoints/contacts.md) - Contact management
- [Companies](./endpoints/companies.md) - Company management
- [Deals](./endpoints/deals.md) - Deal and pipeline management
- [Activities](./endpoints/activities.md) - Activity tracking
- [Users](./endpoints/users.md) - User management
- [Workspaces](./endpoints/workspaces.md) - Workspace settings

### Communication

- [Emails](./endpoints/emails.md) - Email sync and sending
- [Campaigns](./endpoints/campaigns.md) - Email campaigns
- [Sequences](./endpoints/sequences.md) - Email sequences

### AI Features

- [AI Assistant](./endpoints/ai-assistant.md) - AI-powered features
- [Insights](./endpoints/insights.md) - AI-generated insights

### Integration

- [Webhooks](./endpoints/webhooks.md) - Event notifications
- [API Keys](./endpoints/api-keys.md) - API key management

## Common Patterns

### Creating Resources

```http
POST /v1/contacts
Content-Type: application/json

{
  "email": "john.doe@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "company": "Acme Corp"
}
```

### Updating Resources

```http
PATCH /v1/contacts/123
Content-Type: application/json

{
  "phone": "+1-555-0123"
}
```

### Bulk Operations

```http
POST /v1/contacts/bulk
Content-Type: application/json

{
  "operations": [
    {
      "method": "create",
      "data": { ... }
    },
    {
      "method": "update",
      "id": "123",
      "data": { ... }
    }
  ]
}
```

## SDKs and Libraries

Official SDKs are available for:

- JavaScript/TypeScript
- Python
- Ruby
- PHP
- Go

See [SDK Documentation](./sdks.md) for installation and usage.

## Testing

Use our sandbox environment for testing:

- Base URL: `https://api-sandbox.aicrm.com/v1`
- Test API keys available in your dashboard
- Data is reset daily

## Support

- Documentation: https://docs.aicrm.com
- API Status: https://status.aicrm.com
- Support: api-support@aicrm.com