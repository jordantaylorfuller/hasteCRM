# REST API Documentation

## Table of Contents
1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Base URL & Versioning](#base-url--versioning)
4. [Request/Response Format](#requestresponse-format)
5. [Error Handling](#error-handling)
6. [Pagination](#pagination)
7. [Core Endpoints](#core-endpoints)
8. [Security Best Practices](#security-best-practices)
9. [Rate Limiting](#rate-limiting)
10. [Examples & SDKs](#examples--sdks)

## Overview

While the hasteCRM primarily uses GraphQL for its API, certain operations are better suited for REST endpoints. This includes file uploads, webhooks, OAuth callbacks, and real-time event streaming. All REST endpoints follow consistent patterns for authentication, error handling, and response formats.

## Authentication

All REST API endpoints require authentication using JWT tokens obtained through the GraphQL API.

### Request Headers
```http
Authorization: Bearer your-jwt-token-here
Content-Type: application/json
X-Workspace-ID: workspace_uuid (optional, defaults to user's primary workspace)
```

### Example Request
```bash
curl -X GET https://api.hastecrm.com/v1/contacts \
  -H "Authorization: Bearer your-jwt-token-here" \
  -H "Content-Type: application/json"
```

## Base URL & Versioning

```
Production: https://api.hastecrm.com/v1
Staging: https://staging-api.hastecrm.com/v1
Development: http://localhost:4000/v1
```

## Standard Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "version": "1.0.0",
    "requestId": "request_123abc"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": {
      "field": "email",
      "value": "invalid-email"
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "request_123abc"
  }
}
```

### Error Codes
| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `RATE_LIMITED` | 429 | Too many requests |
| `SERVER_ERROR` | 500 | Internal server error |
| `CONFLICT` | 409 | Resource conflict (e.g., duplicate) |
| `PAYLOAD_TOO_LARGE` | 413 | Request size exceeds limit |
| `UNPROCESSABLE_ENTITY` | 422 | Semantic validation error |
| `SERVICE_UNAVAILABLE` | 503 | Temporary service issue |

## 📄 Pagination

All list endpoints support cursor-based pagination for efficient data retrieval.

### Pagination Parameters
```http
GET /v1/contacts?cursor=eyJpZCI6ImNvbnRhY3RfMTIzIn0&limit=50
```

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `cursor` | string | null | - | Opaque cursor for next page |
| `limit` | integer | 20 | 100 | Number of items per page |
| `direction` | string | "next" | - | "next" or "prev" |

### Paginated Response
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "hasNext": true,
      "hasPrev": false,
      "nextCursor": "eyJpZCI6ImNvbnRhY3RfNDU2In0",
      "prevCursor": null,
      "total": 1234,
      "currentPage": 1,
      "totalPages": 25
    }
  }
}
```

### Pagination Best Practices
1. Always use cursors for consistent pagination
2. Don't construct cursors manually
3. Handle edge cases (empty results, last page)
4. Implement retry logic for cursor expiration

## File Upload Endpoints

### Upload File
Upload files for attachments, profile pictures, or documents.

```http
POST /v1/files/upload
```

**Request:**
```bash
curl -X POST https://api.hastecrm.com/v1/files/upload \
  -H "Content-Type: multipart/form-data" \
  -H "Authorization: Bearer your-jwt-token-here" \
  -F "file=@document.pdf" \
  -F "type=attachment" \
  -F "entityType=contact" \
  -F "entityId=contact_123"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "file_789xyz",
    "filename": "document.pdf",
    "size": 1048576,
    "mimeType": "application/pdf",
    "url": "https://storage.hastecrm.com/files/file_789xyz",
    "thumbnailUrl": "https://storage.hastecrm.com/thumbnails/file_789xyz",
    "uploadedAt": "2024-01-15T10:30:00Z",
    "metadata": {
      "entityType": "contact",
      "entityId": "contact_123"
    }
  }
}
```

### Get File
```http
GET /v1/files/:fileId
```

### Delete File
```http
DELETE /v1/files/:fileId
```

### Generate Upload URL (for large files)
```http
POST /v1/files/upload-url
```

**Request:**
```json
{
  "filename": "large-video.mp4",
  "size": 104857600,
  "mimeType": "video/mp4"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://storage.hastecrm.com/upload/...",
    "fileId": "file_abc123",
    "expiresAt": "2024-01-15T11:00:00Z"
  }
}
```

## Webhook Endpoints

### Gmail Push Notifications
Receive real-time Gmail updates.

```http
POST /v1/webhooks/gmail
```

**Headers:**
```http
X-Goog-Channel-ID: channel_123
X-Goog-Message-Number: 1
X-Goog-Resource-ID: resource_456
X-Goog-Resource-State: sync
X-Goog-Resource-URI: https://www.googleapis.com/gmail/v1/users/me/messages
```

**Request Body:**
```json
{
  "message": {
    "data": "eyJlbWFpbEFkZHJlc3MiOiAidXNlckBleGFtcGxlLmNvbSIsICJoaXN0b3J5SWQiOiAiMTIzNDU2In0=",
    "messageId": "msg_789",
    "publishTime": "2024-01-15T10:30:00Z"
  }
}
```

### SendGrid Events
Track email delivery events.

```http
POST /v1/webhooks/sendgrid
```

**Request Body:**
```json
[
  {
    "event": "delivered",
    "email": "recipient@example.com",
    "timestamp": 1705318200,
    "smtp-id": "<14c5d75ce93.dfd.64b469@ismtpd-555>",
    "sg_event_id": "sendgrid_event_123",
    "sg_message_id": "sendgrid_message_456",
    "crm_tracking_id": "tracking_789"
  }
]
```

### Stripe Events
Handle subscription updates.

```http
POST /v1/webhooks/stripe
```

**Headers:**
```http
Stripe-Signature: t=1705318200,v1=signature...
```

### Custom Webhooks
Register custom webhooks for automation triggers.

```http
POST /v1/webhooks/custom/:webhookId
```

## OAuth Callback Endpoints

### Google OAuth
```http
GET /v1/auth/google/callback?code=AUTH_CODE&state=STATE_TOKEN
```

**Response (Redirect):**
```
Location: https://app.hastecrm.com/auth/success?token=your-jwt-token-here
```

### Microsoft OAuth
```http
GET /v1/auth/microsoft/callback?code=AUTH_CODE&state=STATE_TOKEN
```

### LinkedIn OAuth
```http
GET /v1/auth/linkedin/callback?code=AUTH_CODE&state=STATE_TOKEN
```

## Export Endpoints

### Export Contacts
Export contacts in various formats.

```http
POST /v1/export/contacts
```

**Request:**
```json
{
  "format": "csv",
  "filters": {
    "tags": ["customer", "high-value"],
    "createdAfter": "2024-01-01"
  },
  "fields": [
    "email",
    "firstName",
    "lastName",
    "company",
    "customFields.budget"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "exportId": "export_123",
    "status": "processing",
    "estimatedTime": 30,
    "websocketChannel": "export_123_progress"
  }
}
```

### Get Export Status
```http
GET /v1/export/:exportId/status
```

### Download Export
```http
GET /v1/export/:exportId/download
```

**Response:**
```
Content-Type: text/csv
Content-Disposition: attachment; filename="contacts_2024-01-15.csv"

email,firstName,lastName,company,budget
john@example.com,John,Doe,Acme Corp,50000
...
```

## Email Tracking Endpoints

### Track Email Open
```http
GET /v1/track/open/:trackingId.gif
```

**Response:**
- Returns a 1x1 transparent GIF
- Records open event with IP, user agent, timestamp

### Track Link Click
```http
GET /v1/track/click/:trackingId/:linkId
```

**Response:**
- Redirects to target URL
- Records click event with link details

### Unsubscribe
```http
GET /v1/unsubscribe/:token
POST /v1/unsubscribe/:token
```

## Search Endpoints

### Global Search
Search across all entities.

```http
GET /v1/search?q=john&types=contact,deal,email&limit=20
```

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "type": "contact",
        "id": "contact_123",
        "title": "John Doe",
        "subtitle": "CEO at Acme Corp",
        "url": "/contacts/contact_123",
        "highlights": {
          "firstName": "<mark>John</mark>",
          "email": "<mark>john</mark>@example.com"
        }
      }
    ],
    "facets": {
      "types": {
        "contact": 15,
        "deal": 3,
        "email": 45
      }
    },
    "total": 63,
    "took": 125
  }
}
```

### Autocomplete
```http
GET /v1/autocomplete?type=contact&field=company&q=acm&limit=10
```

## Health & Status Endpoints

### Health Check
```http
GET /v1/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "email": "healthy",
    "ai": "healthy"
  }
}
```

### Readiness Check
```http
GET /v1/ready
```

### Metrics
```http
GET /v1/metrics
```

**Response (Prometheus format):**
```
# HELP api_requests_total Total API requests
# TYPE api_requests_total counter
api_requests_total{method="GET",endpoint="/v1/contacts"} 1234

# HELP api_request_duration_seconds API request duration
# TYPE api_request_duration_seconds histogram
api_request_duration_seconds_bucket{le="0.1"} 1000
```

## Admin Endpoints

### Workspace Usage
```http
GET /v1/admin/workspace/usage
```

**Response:**
```json
{
  "success": true,
  "data": {
    "contacts": {
      "count": 5234,
      "limit": 10000,
      "percentage": 52.34
    },
    "emails": {
      "sent": 12453,
      "limit": 50000,
      "percentage": 24.91
    },
    "storage": {
      "used": 5368709120,
      "limit": 10737418240,
      "percentage": 50.0
    },
    "aiCredits": {
      "used": 4523,
      "limit": 10000,
      "percentage": 45.23
    }
  }
}
```

### Audit Logs
```http
GET /v1/admin/audit-logs?startDate=2024-01-01&endDate=2024-01-15&limit=100
```

## Real-time Endpoints

### Server-Sent Events (SSE)
```http
GET /v1/events/stream
```

**Headers:**
```http
Accept: text/event-stream
Cache-Control: no-cache
```

**Response Stream:**
```
event: contact_updated
data: {"id":"contact_123","changes":{"score":85}}

event: email_received
data: {"id":"email_456","from":"client@example.com","subject":"Re: Proposal"}

event: ping
data: {"timestamp":"2024-01-15T10:30:00Z"}
```

### WebSocket Connection
```
wss://api.hastecrm.com/v1/ws
```

**Authentication:**
```json
{
  "type": "auth",
  "token": "JWT_TOKEN"
}
```

**Subscribe to channels:**
```json
{
  "type": "subscribe",
  "channels": ["contacts", "deals", "activities"]
}
```

## Rate Limiting

### Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1705318800
```

### Rate Limits by Endpoint
| Endpoint Pattern | Limit | Window |
|-----------------|-------|---------|
| `/v1/auth/*` | 10 | 1 minute |
| `/v1/files/upload` | 100 | 1 hour |
| `/v1/export/*` | 10 | 1 hour |
| `/v1/search` | 100 | 1 minute |
| `/v1/track/*` | 10000 | 1 hour |
| Default | 1000 | 1 hour |

## Utility Endpoints

### Generate IDs
```http
POST /v1/utils/generate-id
```

**Request:**
```json
{
  "type": "contact",
  "count": 5
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ids": [
      "contact_abc123",
      "contact_def456",
      "contact_ghi789",
      "contact_jkl012",
      "contact_mno345"
    ]
  }
}
```

### Validate Email
```http
POST /v1/utils/validate-email
```

**Request:**
```json
{
  "email": "john@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "deliverable": true,
    "disposable": false,
    "role": false,
    "free": false,
    "syntax": {
      "valid": true
    },
    "mx": {
      "valid": true,
      "records": ["mx1.example.com", "mx2.example.com"]
    }
  }
}
```

### Parse Email Headers
```http
POST /v1/utils/parse-email
```

**Request:**
```json
{
  "headers": "From: John Doe <john@example.com>\nTo: jane@example.com\n...",
  "body": "Email body content..."
}
```

## Batch Operations

### Batch Request
Execute multiple operations in a single request.

```http
POST /v1/batch
```

**Request:**
```json
{
  "operations": [
    {
      "id": "op1",
      "method": "POST",
      "path": "/v1/contacts",
      "body": {
        "email": "john@example.com",
        "firstName": "John"
      }
    },
    {
      "id": "op2",
      "method": "PATCH",
      "path": "/v1/contacts/contact_123",
      "body": {
        "score": 85
      },
      "dependsOn": ["op1"]
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "op1",
        "status": 201,
        "body": {
          "id": "contact_789",
          "email": "john@example.com"
        }
      },
      {
        "id": "op2",
        "status": 200,
        "body": {
          "id": "contact_123",
          "score": 85
        }
      }
    ]
  }
}
```

## Example Integrations

### Python
```python
import requests

class HasteCRMAPI:
    def __init__(self, api_key, base_url="https://api.hastecrm.com/v1"):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    def upload_file(self, file_path, entity_type, entity_id):
        with open(file_path, 'rb') as f:
            files = {'file': f}
            data = {
                'type': 'attachment',
                'entityType': entity_type,
                'entityId': entity_id
            }
            response = requests.post(
                f"{self.base_url}/files/upload",
                headers={"Authorization": self.headers["Authorization"]},
                files=files,
                data=data
            )
            return response.json()

# Usage
api = HasteCRMAPI("your_api_key")
result = api.upload_file("document.pdf", "contact", "contact_123")
```

### Node.js
```javascript
const FormData = require('form-data');
const fs = require('fs');

class HasteCRMAPI {
  constructor(apiKey, baseUrl = 'https://api.hastecrm.com/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async uploadFile(filePath, entityType, entityId) {
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath));
    form.append('type', 'attachment');
    form.append('entityType', entityType);
    form.append('entityId', entityId);

    const response = await fetch(`${this.baseUrl}/files/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        ...form.getHeaders()
      },
      body: form
    });

    return response.json();
  }
}

// Usage
const api = new HasteCRMAPI('your_api_key');
const result = await api.uploadFile('document.pdf', 'contact', 'contact_123');
```

### cURL Examples
```bash
# Upload file
curl -X POST https://api.hastecrm.com/v1/files/upload \
  -H "Content-Type: multipart/form-data" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@document.pdf" \
  -F "type=attachment" \
  -F "entityType=contact" \
  -F "entityId=contact_123"

# Export contacts
curl -X POST https://api.hastecrm.com/v1/export/contacts \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "format": "csv",
    "filters": {"tags": ["customer"]},
    "fields": ["email", "firstName", "lastName"]
  }'

# Global search
curl -X GET "https://api.hastecrm.com/v1/search?q=john&types=contact,deal" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Stream events (SSE)
curl -N -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Accept: text/event-stream" \
  https://api.hastecrm.com/v1/events/stream
```

## Migration from v0 to v1

### Breaking Changes
1. Authentication header changed from `X-API-Key` to `Authorization: Bearer`
2. Response format standardized with `success`, `data`, and `meta` fields
3. Error codes are now uppercase with underscores
4. File upload endpoint moved from `/files` to `/v1/files/upload`

### Deprecated Endpoints
These v0 endpoints are deprecated and will be removed:
- `/api/contacts` → Use `/v1/contacts` (or GraphQL preferred)
- `/api/search` → Use `/v1/search`
- `/api/export` → Use `/v1/export/:entity`

## Additional Resources

- [GraphQL API Documentation](./graphql-schema.md) - Primary API interface
- [WebSocket Documentation](./websockets.md) - Real-time communication
- [Webhook Configuration](./webhooks.md) - Setting up webhooks
- [Authentication Guide](../features/auth.md) - Detailed auth flows
- [API Client Libraries](https://github.com/hastecrm/client-libraries) - Official SDKs

## Support

For API support:
- **Status Page**: [status.hastecrm.com](https://status.hastecrm.com)
- **API Console**: [console.hastecrm.com](https://console.hastecrm.com)
- **Developer Forum**: [forum.hastecrm.com/api](https://forum.hastecrm.com/api)
- **Email**: api-support@hastecrm.com

---

## 🔒 Security Best Practices

### API Key Management
1. **Never expose API keys in client-side code**
   - Use environment variables
   - Implement proxy endpoints for frontend
   - Rotate keys regularly

2. **Use appropriate authentication flows**
   ```javascript
   // BAD: API key in frontend
   fetch('https://api.hastecrm.com/v1/contacts', {
     headers: { 'Authorization': 'Bearer sk_live_abc123' }
   });

   // GOOD: Proxy through backend
   fetch('/api/proxy/contacts', {
     credentials: 'include'
   });
   ```

3. **Implement IP allowlisting**
   - Restrict API access to known IPs
   - Use CIDR notation for ranges
   - Monitor for unauthorized access

### Request Validation
1. **Always validate input data**
   ```javascript
   // Input validation example
   const validateEmail = (email) => {
     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
     if (!emailRegex.test(email)) {
       throw new Error('Invalid email format');
     }
     return email.toLowerCase().trim();
   };
   ```

2. **Sanitize user input**
   - Prevent SQL injection
   - Escape special characters
   - Validate file uploads

3. **Use HTTPS everywhere**
   - Enforce TLS 1.2 or higher
   - Implement HSTS headers
   - Use certificate pinning for mobile apps

### Rate Limiting & DDoS Protection
1. **Implement client-side rate limiting**
   ```javascript
   class RateLimiter {
     constructor(maxRequests, timeWindow) {
       this.maxRequests = maxRequests;
       this.timeWindow = timeWindow;
       this.requests = [];
     }

     async execute(fn) {
       const now = Date.now();
       this.requests = this.requests.filter(t => now - t < this.timeWindow);
       
       if (this.requests.length >= this.maxRequests) {
         throw new Error('Rate limit exceeded');
       }
       
       this.requests.push(now);
       return await fn();
     }
   }
   ```

2. **Handle rate limit errors gracefully**
   - Implement exponential backoff
   - Queue requests when possible
   - Show user-friendly error messages

### Data Protection
1. **Encrypt sensitive data**
   - Use field-level encryption for PII
   - Implement key rotation
   - Store encryption keys separately

2. **Implement audit logging**
   ```json
   {
     "action": "contact.update",
     "userId": "user_123",
     "timestamp": "2024-01-15T10:30:00Z",
     "ip": "192.168.1.1",
     "changes": {
       "email": {
         "from": "old@example.com",
         "to": "new@example.com"
       }
     }
   }
   ```

3. **Follow GDPR/CCPA compliance**
   - Implement data deletion endpoints
   - Provide data export functionality
   - Maintain consent records

### Webhook Security
1. **Verify webhook signatures**
   ```javascript
   const crypto = require('crypto');

   function verifyWebhookSignature(payload, signature, secret) {
     const expectedSignature = crypto
       .createHmac('sha256', secret)
       .update(payload)
       .digest('hex');
     
     return crypto.timingSafeEqual(
       Buffer.from(signature),
       Buffer.from(expectedSignature)
     );
   }
   ```

2. **Implement webhook retry logic**
   - Exponential backoff
   - Maximum retry limits
   - Dead letter queues

### CORS Configuration
```javascript
// Restrictive CORS policy
const corsOptions = {
  origin: [
    'https://app.hastecrm.com',
    'https://staging.hastecrm.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours
};
```

## 🛠️ Advanced Examples

### Implementing Retry Logic
```javascript
class APIClient {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.baseURL = options.baseURL || 'https://api.hastecrm.com/v1';
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
  }

  async request(method, path, data = null, retries = 0) {
    try {
      const response = await fetch(`${this.baseURL}${path}`, {
        method,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : null,
      });

      if (!response.ok) {
        if (response.status === 429 && retries < this.maxRetries) {
          // Rate limited - retry with exponential backoff
          const delay = this.retryDelay * Math.pow(2, retries);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.request(method, path, data, retries + 1);
        }
        
        throw new Error(`API Error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (retries < this.maxRetries) {
        const delay = this.retryDelay * Math.pow(2, retries);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.request(method, path, data, retries + 1);
      }
      throw error;
    }
  }
}
```

### Streaming Large Datasets
```javascript
async function* streamContacts(apiClient) {
  let cursor = null;
  
  do {
    const response = await apiClient.request('GET', 
      `/contacts?cursor=${cursor || ''}&limit=100`
    );
    
    for (const contact of response.data.items) {
      yield contact;
    }
    
    cursor = response.data.pagination.nextCursor;
  } while (cursor);
}

// Usage
const client = new APIClient('your_api_key');
for await (const contact of streamContacts(client)) {
  console.log(contact.email);
}
```

### Webhook Handler with Queue
```javascript
const Queue = require('bull');
const webhookQueue = new Queue('webhooks');

// Webhook endpoint
app.post('/webhooks/gmail', async (req, res) => {
  // Verify signature
  if (!verifyGoogleSignature(req)) {
    return res.status(401).send('Unauthorized');
  }
  
  // Quick response
  res.status(200).send('OK');
  
  // Queue for processing
  await webhookQueue.add('process-gmail', {
    headers: req.headers,
    body: req.body,
    timestamp: new Date().toISOString()
  });
});

// Process webhook
webhookQueue.process('process-gmail', async (job) => {
  const { headers, body } = job.data;
  
  // Decode message
  const decodedData = Buffer.from(body.message.data, 'base64').toString();
  const messageData = JSON.parse(decodedData);
  
  // Process email update
  await processEmailUpdate(messageData);
});
```

### TypeScript SDK Example
```typescript
interface APIConfig {
  apiKey: string;
  baseURL?: string;
  timeout?: number;
}

interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    hasNext: boolean;
    hasPrev: boolean;
    nextCursor: string | null;
    prevCursor: string | null;
    total: number;
  };
}

class HasteCRMSDK {
  private config: APIConfig;
  
  constructor(config: APIConfig) {
    this.config = {
      baseURL: 'https://api.hastecrm.com/v1',
      timeout: 30000,
      ...config
    };
  }
  
  async contacts(): Promise<ContactsAPI> {
    return new ContactsAPI(this.config);
  }
  
  async files(): Promise<FilesAPI> {
    return new FilesAPI(this.config);
  }
}

class ContactsAPI {
  constructor(private config: APIConfig) {}
  
  async list(options?: {
    cursor?: string;
    limit?: number;
    filters?: Record<string, any>;
  }): Promise<PaginatedResponse<Contact>> {
    // Implementation
  }
  
  async create(data: CreateContactInput): Promise<Contact> {
    // Implementation
  }
  
  async update(id: string, data: UpdateContactInput): Promise<Contact> {
    // Implementation
  }
  
  async delete(id: string): Promise<void> {
    // Implementation
  }
}

// Usage
const crm = new HasteCRMSDK({ apiKey: process.env.CRM_API_KEY });
const contacts = await crm.contacts();
const result = await contacts.list({ limit: 50 });
```

*API Version: 1.0*  
*Last Updated: 2024-01-15*