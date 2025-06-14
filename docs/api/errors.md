# Error Handling Guide

## Overview

All hasteCRM APIs use consistent error codes and formats to help you handle errors gracefully.

## Error Response Format

### REST API Errors

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": {
      "field": "email",
      "value": "invalid-email"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123abc"
  }
}
```

### GraphQL Errors

```json
{
  "errors": [
    {
      "message": "Contact not found",
      "extensions": {
        "code": "NOT_FOUND",
        "timestamp": "2024-01-15T10:30:00Z",
        "path": ["contact"],
        "id": "contact_123"
      }
    }
  ],
  "data": null
}
```

### WebSocket Errors

```json
{
  "type": "error",
  "error": {
    "code": "SUBSCRIPTION_FAILED",
    "message": "Unable to subscribe to resource",
    "resource": "contact_123",
    "reason": "PERMISSION_DENIED"
  }
}
```

## Common Error Codes

### Authentication Errors (4xx)

| Code              | HTTP Status | Description                       | Action              |
| ----------------- | ----------- | --------------------------------- | ------------------- |
| `UNAUTHENTICATED` | 401         | Missing or invalid authentication | Provide valid token |
| `TOKEN_EXPIRED`   | 401         | JWT token has expired             | Refresh token       |
| `TOKEN_INVALID`   | 401         | Malformed or invalid token        | Get new token       |
| `API_KEY_INVALID` | 401         | Invalid API key                   | Check API key       |
| `MFA_REQUIRED`    | 401         | Multi-factor auth required        | Provide MFA code    |

### Authorization Errors (403)

| Code                       | HTTP Status | Description                    | Action            |
| -------------------------- | ----------- | ------------------------------ | ----------------- |
| `FORBIDDEN`                | 403         | Access denied                  | Check permissions |
| `INSUFFICIENT_PERMISSIONS` | 403         | Missing required permissions   | Request access    |
| `WORKSPACE_ACCESS_DENIED`  | 403         | No access to workspace         | Switch workspace  |
| `RESOURCE_ACCESS_DENIED`   | 403         | No access to specific resource | Check ownership   |

### Validation Errors (400)

| Code                     | HTTP Status | Description             | Action                   |
| ------------------------ | ----------- | ----------------------- | ------------------------ |
| `VALIDATION_ERROR`       | 400         | Input validation failed | Fix input data           |
| `INVALID_INPUT`          | 400         | Malformed request data  | Check request format     |
| `MISSING_REQUIRED_FIELD` | 400         | Required field missing  | Add missing field        |
| `INVALID_FIELD_VALUE`    | 400         | Field value invalid     | Correct field value      |
| `DUPLICATE_RESOURCE`     | 409         | Resource already exists | Use different identifier |

### Resource Errors (404)

| Code                  | HTTP Status | Description                | Action            |
| --------------------- | ----------- | -------------------------- | ----------------- |
| `NOT_FOUND`           | 404         | Resource not found         | Check resource ID |
| `ENDPOINT_NOT_FOUND`  | 404         | API endpoint doesn't exist | Check API docs    |
| `WORKSPACE_NOT_FOUND` | 404         | Workspace doesn't exist    | Verify workspace  |

### Rate Limiting (429)

| Code               | HTTP Status | Description                  | Action             |
| ------------------ | ----------- | ---------------------------- | ------------------ |
| `RATE_LIMITED`     | 429         | Too many requests            | Wait and retry     |
| `QUOTA_EXCEEDED`   | 429         | API quota exceeded           | Upgrade plan       |
| `CONCURRENT_LIMIT` | 429         | Too many concurrent requests | Reduce parallelism |

### Server Errors (5xx)

| Code                  | HTTP Status | Description              | Action                     |
| --------------------- | ----------- | ------------------------ | -------------------------- |
| `INTERNAL_ERROR`      | 500         | Unexpected server error  | Retry later                |
| `SERVICE_UNAVAILABLE` | 503         | Service temporarily down | Wait and retry             |
| `GATEWAY_TIMEOUT`     | 504         | Request timeout          | Retry with smaller request |

## Handling Errors

### JavaScript/TypeScript

```typescript
// REST API Error Handling
async function makeAPICall() {
  try {
    const response = await fetch("/api/v1/contacts", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle API errors
      switch (data.error.code) {
        case "TOKEN_EXPIRED":
          await refreshToken();
          return makeAPICall(); // Retry

        case "RATE_LIMITED":
          const retryAfter = response.headers.get("X-RateLimit-Reset");
          await sleep(retryAfter * 1000);
          return makeAPICall(); // Retry

        case "VALIDATION_ERROR":
          console.error("Validation failed:", data.error.details);
          throw new ValidationError(data.error);

        default:
          throw new APIError(data.error);
      }
    }

    return data.data;
  } catch (error) {
    if (error instanceof TypeError) {
      // Network error
      console.error("Network error:", error);
      throw new NetworkError("Unable to connect to API");
    }
    throw error;
  }
}

// GraphQL Error Handling
async function graphqlQuery(query, variables) {
  const response = await client.query({ query, variables });

  if (response.errors) {
    const error = response.errors[0];

    switch (error.extensions.code) {
      case "UNAUTHENTICATED":
        await refreshAuth();
        return graphqlQuery(query, variables);

      case "NOT_FOUND":
        return null; // Handle gracefully

      default:
        throw new GraphQLError(error);
    }
  }

  return response.data;
}
```

### Python

```python
import time
from typing import Optional, Dict, Any

class APIError(Exception):
    def __init__(self, code: str, message: str, details: Optional[Dict] = None):
        self.code = code
        self.message = message
        self.details = details
        super().__init__(self.message)

class APIClient:
    def __init__(self, token: str):
        self.token = token
        self.session = requests.Session()

    def request(self, method: str, path: str, **kwargs) -> Dict[str, Any]:
        headers = kwargs.pop('headers', {})
        headers['Authorization'] = f'Bearer {self.token}'

        max_retries = 3
        retry_count = 0

        while retry_count < max_retries:
            try:
                response = self.session.request(
                    method,
                    f'https://api.haste.nyc/v1{path}',
                    headers=headers,
                    **kwargs
                )

                data = response.json()

                if not response.ok:
                    error = data['error']

                    # Handle specific errors
                    if error['code'] == 'TOKEN_EXPIRED':
                        self.refresh_token()
                        continue

                    elif error['code'] == 'RATE_LIMITED':
                        retry_after = int(response.headers.get('X-RateLimit-Reset', 60))
                        time.sleep(retry_after)
                        continue

                    elif error['code'] == 'SERVICE_UNAVAILABLE':
                        retry_count += 1
                        time.sleep(2 ** retry_count)  # Exponential backoff
                        continue

                    raise APIError(error['code'], error['message'], error.get('details'))

                return data['data']

            except requests.exceptions.RequestException as e:
                retry_count += 1
                if retry_count >= max_retries:
                    raise APIError('NETWORK_ERROR', str(e))
                time.sleep(2 ** retry_count)
```

### Error Recovery Strategies

#### 1. Exponential Backoff

```javascript
async function withExponentialBackoff(fn, maxRetries = 5) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on client errors
      if (error.code && error.code.startsWith("4")) {
        throw error;
      }

      // Calculate delay: 2^i * 1000ms with jitter
      const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
```

#### 2. Circuit Breaker

```javascript
class CircuitBreaker {
  constructor(fn, options = {}) {
    this.fn = fn;
    this.failures = 0;
    this.successes = 0;
    this.state = "CLOSED"; // CLOSED, OPEN, HALF_OPEN
    this.threshold = options.threshold || 5;
    this.timeout = options.timeout || 60000; // 1 minute
    this.resetTimer = null;
  }

  async call(...args) {
    if (this.state === "OPEN") {
      throw new Error("Circuit breaker is OPEN");
    }

    try {
      const result = await this.fn(...args);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    if (this.state === "HALF_OPEN") {
      this.state = "CLOSED";
    }
  }

  onFailure() {
    this.failures++;
    if (this.failures >= this.threshold) {
      this.state = "OPEN";
      this.resetTimer = setTimeout(() => {
        this.state = "HALF_OPEN";
      }, this.timeout);
    }
  }
}
```

## Validation Error Details

### Field-Level Errors

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Multiple validation errors",
    "details": {
      "fields": {
        "email": ["Email is required", "Email format is invalid"],
        "phone": ["Phone number must be in E.164 format"],
        "customFields.budget": ["Budget must be a positive number"]
      }
    }
  }
}
```

### Handling Field Errors

```javascript
function handleValidationErrors(error) {
  if (error.code !== "VALIDATION_ERROR") return;

  const fieldErrors = error.details.fields;

  // Display errors next to form fields
  Object.entries(fieldErrors).forEach(([field, errors]) => {
    const fieldElement = document.querySelector(`[name="${field}"]`);
    if (fieldElement) {
      showFieldError(fieldElement, errors[0]);
    }
  });
}
```

## Rate Limiting

### Understanding Rate Limit Headers

```http
X-RateLimit-Limit: 1000        # Total requests allowed
X-RateLimit-Remaining: 999     # Requests remaining
X-RateLimit-Reset: 1705318800  # Unix timestamp when limit resets
X-RateLimit-Retry-After: 3600  # Seconds until you can retry
```

### Handling Rate Limits

```javascript
class RateLimitedClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.queue = [];
    this.processing = false;
  }

  async request(options) {
    return new Promise((resolve, reject) => {
      this.queue.push({ options, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const { options, resolve, reject } = this.queue.shift();

    try {
      const response = await fetch(this.baseURL + options.path, options);

      // Check rate limit headers
      const remaining = parseInt(response.headers.get("X-RateLimit-Remaining"));
      const reset = parseInt(response.headers.get("X-RateLimit-Reset"));

      if (remaining === 0) {
        // Wait until reset
        const waitTime = reset * 1000 - Date.now();
        await new Promise((r) => setTimeout(r, waitTime));
      }

      resolve(response);
    } catch (error) {
      reject(error);
    } finally {
      this.processing = false;
      // Process next request
      setTimeout(() => this.processQueue(), 100);
    }
  }
}
```

## Webhook Error Handling

### Webhook Delivery Failures

When webhook delivery fails, we retry with exponential backoff:

1. Immediate retry
2. 1 minute later
3. 5 minutes later
4. 30 minutes later
5. 2 hours later
6. 6 hours later

### Acknowledging Webhooks

Always return a 2xx status code quickly:

```javascript
app.post("/webhook", (req, res) => {
  // Acknowledge immediately
  res.status(200).send("OK");

  // Process asynchronously
  processWebhookAsync(req.body).catch((error) => {
    console.error("Webhook processing failed:", error);
    // Store for retry or alert
  });
});
```

## Best Practices

### 1. Always Handle Errors

```javascript
// ❌ Bad
const data = await api.getContact(id);

// ✅ Good
try {
  const data = await api.getContact(id);
} catch (error) {
  if (error.code === "NOT_FOUND") {
    // Handle missing contact
  } else {
    // Handle other errors
  }
}
```

### 2. Log Errors with Context

```javascript
function logError(error, context) {
  console.error({
    timestamp: new Date().toISOString(),
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
    context: {
      userId: context.userId,
      action: context.action,
      requestId: context.requestId,
    },
  });
}
```

### 3. Provide User-Friendly Messages

```javascript
function getUserMessage(error) {
  const messages = {
    TOKEN_EXPIRED: "Your session has expired. Please log in again.",
    RATE_LIMITED: "Too many requests. Please wait a moment.",
    VALIDATION_ERROR: "Please check your input and try again.",
    SERVICE_UNAVAILABLE:
      "Service temporarily unavailable. Please try again later.",
    INTERNAL_ERROR: "Something went wrong. Please try again.",
  };

  return messages[error.code] || "An unexpected error occurred.";
}
```

## Testing Error Scenarios

### Triggering Test Errors

Use these special IDs to trigger specific errors in development:

```javascript
// Triggers NOT_FOUND error
const contact = await api.getContact("error_not_found");

// Triggers RATE_LIMITED error
const contact = await api.getContact("error_rate_limit");

// Triggers INTERNAL_ERROR
const contact = await api.getContact("error_internal");
```

### Unit Testing Errors

```javascript
describe("Error Handling", () => {
  it("should retry on token expiration", async () => {
    // Mock expired token response
    fetchMock.mockResponseOnce(
      JSON.stringify({
        success: false,
        error: { code: "TOKEN_EXPIRED" },
      }),
      { status: 401 },
    );

    // Mock successful retry
    fetchMock.mockResponseOnce(
      JSON.stringify({
        success: true,
        data: { id: "contact_123" },
      }),
    );

    const result = await api.getContact("contact_123");
    expect(result.id).toBe("contact_123");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
```
