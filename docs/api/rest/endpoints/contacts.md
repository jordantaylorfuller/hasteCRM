# Contacts API

## Overview

The Contacts API allows you to manage individual contacts in your CRM. Contacts represent people you interact with, whether they're leads, customers, or other stakeholders.

## Contact Object

```json
{
  "id": "cont_1234567890",
  "email": "john.doe@haste.nyc",
  "firstName": "John",
  "lastName": "Doe",
  "fullName": "John Doe",
  "phone": "+1-555-0123",
  "mobile": "+1-555-9876",
  "title": "VP of Sales",
  "department": "Sales",
  "company": {
    "id": "comp_1234567890",
    "name": "Acme Corp"
  },
  "address": {
    "street": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "postalCode": "94105",
    "country": "USA"
  },
  "social": {
    "linkedin": "https://linkedin.com/in/johndoe",
    "twitter": "https://twitter.com/johndoe"
  },
  "tags": ["vip", "decision-maker"],
  "customFields": {
    "leadSource": "Website",
    "industry": "Technology"
  },
  "score": 85,
  "status": "active",
  "lifecycle": "customer",
  "owner": {
    "id": "usr_1234567890",
    "name": "Jane Smith"
  },
  "lastActivity": "2024-01-15T10:30:00Z",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

## Endpoints

### List Contacts

Retrieve a paginated list of contacts.

```http
GET /v1/contacts
```

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| cursor | string | Pagination cursor |
| limit | integer | Number of results (1-100, default: 50) |
| search | string | Search query (searches name, email, company) |
| status | string | Filter by status: active, inactive, bounced |
| lifecycle | string | Filter by lifecycle: lead, opportunity, customer |
| tag | string | Filter by tag (can be used multiple times) |
| owner | string | Filter by owner user ID |
| company | string | Filter by company ID |
| created_after | datetime | Filter by creation date |
| created_before | datetime | Filter by creation date |
| updated_after | datetime | Filter by last update |
| sort | string | Sort field: created_at, updated_at, last_name, score |

#### Example Request

```http
GET /v1/contacts?lifecycle=lead&tag=vip&sort=-score&limit=20
```

#### Response

```json
{
  "data": [
    {
      "id": "cont_1234567890",
      "email": "john.doe@haste.nyc",
      "firstName": "John",
      "lastName": "Doe",
      // ... full contact object
    }
  ],
  "meta": {
    "cursor": {
      "next": "eyJpZCI6MTczfQ",
      "hasMore": true
    }
  }
}
```

### Get Contact

Retrieve a single contact by ID.

```http
GET /v1/contacts/:id
```

#### Response

```json
{
  "data": {
    "id": "cont_1234567890",
    "email": "john.doe@haste.nyc",
    // ... full contact object
  }
}
```

### Create Contact

Create a new contact.

```http
POST /v1/contacts
```

#### Request Body

```json
{
  "email": "john.doe@haste.nyc",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1-555-0123",
  "title": "VP of Sales",
  "companyId": "comp_1234567890",
  "address": {
    "street": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "postalCode": "94105",
    "country": "USA"
  },
  "tags": ["vip", "decision-maker"],
  "customFields": {
    "leadSource": "Website"
  },
  "lifecycle": "lead",
  "ownerId": "usr_1234567890"
}
```

#### Response

```json
{
  "data": {
    "id": "cont_1234567890",
    "email": "john.doe@haste.nyc",
    // ... full contact object
  }
}
```

### Update Contact

Update an existing contact.

```http
PATCH /v1/contacts/:id
```

#### Request Body

Only include fields you want to update.

```json
{
  "title": "Senior VP of Sales",
  "lifecycle": "opportunity",
  "score": 90,
  "customFields": {
    "lastMeeting": "2024-01-15"
  }
}
```

### Delete Contact

Delete a contact.

```http
DELETE /v1/contacts/:id
```

#### Response

```json
{
  "data": {
    "message": "Contact deleted successfully"
  }
}
```

### Merge Contacts

Merge duplicate contacts.

```http
POST /v1/contacts/merge
```

#### Request Body

```json
{
  "primaryId": "cont_1234567890",
  "duplicateIds": ["cont_0987654321", "cont_1122334455"]
}
```

#### Response

```json
{
  "data": {
    "id": "cont_1234567890",
    "mergedCount": 2,
    // ... merged contact object
  }
}
```

## Bulk Operations

### Bulk Create

Create multiple contacts in a single request.

```http
POST /v1/contacts/bulk
```

#### Request Body

```json
{
  "contacts": [
    {
      "email": "john.doe@haste.nyc",
      "firstName": "John",
      "lastName": "Doe"
    },
    {
      "email": "jane.smith@haste.nyc",
      "firstName": "Jane",
      "lastName": "Smith"
    }
  ]
}
```

#### Response

```json
{
  "data": {
    "created": 2,
    "failed": 0,
    "contacts": [
      {
        "id": "cont_1234567890",
        "email": "john.doe@haste.nyc"
      },
      {
        "id": "cont_0987654321",
        "email": "jane.smith@haste.nyc"
      }
    ]
  }
}
```

### Bulk Update

Update multiple contacts by filter.

```http
PATCH /v1/contacts/bulk
```

#### Request Body

```json
{
  "filter": {
    "tag": "lead",
    "lifecycle": "lead"
  },
  "update": {
    "lifecycle": "opportunity",
    "tags": {
      "add": ["qualified"],
      "remove": ["cold"]
    }
  }
}
```

### Bulk Delete

Delete multiple contacts.

```http
DELETE /v1/contacts/bulk
```

#### Request Body

```json
{
  "ids": ["cont_1234567890", "cont_0987654321"]
}
```

## Contact Activities

### List Activities

Get activities for a contact.

```http
GET /v1/contacts/:id/activities
```

#### Response

```json
{
  "data": [
    {
      "id": "act_1234567890",
      "type": "email",
      "subject": "Follow-up on our call",
      "timestamp": "2024-01-15T10:30:00Z",
      "user": {
        "id": "usr_1234567890",
        "name": "Jane Smith"
      }
    }
  ]
}
```

### Add Note

Add a note to a contact.

```http
POST /v1/contacts/:id/notes
```

#### Request Body

```json
{
  "content": "Discussed pricing, very interested in premium plan",
  "private": false
}
```

## Contact Tags

### Add Tags

Add tags to a contact.

```http
POST /v1/contacts/:id/tags
```

#### Request Body

```json
{
  "tags": ["vip", "decision-maker"]
}
```

### Remove Tags

Remove tags from a contact.

```http
DELETE /v1/contacts/:id/tags
```

#### Request Body

```json
{
  "tags": ["cold-lead"]
}
```

## Contact Score

### Update Score

Manually update a contact's score.

```http
POST /v1/contacts/:id/score
```

#### Request Body

```json
{
  "score": 85,
  "reason": "Attended webinar and downloaded whitepaper"
}
```

## Search

### Advanced Search

Search contacts with complex queries.

```http
POST /v1/contacts/search
```

#### Request Body

```json
{
  "query": {
    "and": [
      {
        "field": "lifecycle",
        "operator": "equals",
        "value": "lead"
      },
      {
        "field": "score",
        "operator": "greater_than",
        "value": 70
      },
      {
        "or": [
          {
            "field": "tags",
            "operator": "contains",
            "value": "enterprise"
          },
          {
            "field": "customFields.dealSize",
            "operator": "greater_than",
            "value": 50000
          }
        ]
      }
    ]
  },
  "sort": [
    {
      "field": "score",
      "order": "desc"
    }
  ],
  "limit": 50
}
```

## Export

### Export Contacts

Export contacts to CSV or Excel.

```http
POST /v1/contacts/export
```

#### Request Body

```json
{
  "format": "csv",
  "filter": {
    "lifecycle": "customer"
  },
  "fields": [
    "email",
    "firstName",
    "lastName",
    "company.name",
    "lifecycle",
    "score"
  ]
}
```

#### Response

```json
{
  "data": {
    "exportId": "exp_1234567890",
    "status": "processing",
    "downloadUrl": null
  }
}
```

Check export status:

```http
GET /v1/exports/exp_1234567890
```

## Webhooks

Contact events that trigger webhooks:

- `contact.created`
- `contact.updated`
- `contact.deleted`
- `contact.merged`
- `contact.lifecycle_changed`
- `contact.score_changed`

## Error Codes

| Code | Description |
|------|-------------|
| CONTACT_NOT_FOUND | Contact with specified ID not found |
| DUPLICATE_EMAIL | Contact with this email already exists |
| INVALID_LIFECYCLE | Invalid lifecycle stage |
| MERGE_CONFLICT | Cannot merge contacts due to conflicts |
| BULK_LIMIT_EXCEEDED | Bulk operation exceeds maximum limit |