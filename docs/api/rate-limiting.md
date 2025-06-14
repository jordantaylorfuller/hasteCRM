# Rate Limiting Guide

## Overview

The hasteCRM platform implements rate limiting to ensure fair usage and protect system stability. This guide covers rate limits across all APIs.

## Rate Limit Headers

All API responses include rate limit information:

```http
X-RateLimit-Limit: 1000        # Maximum requests allowed in window
X-RateLimit-Remaining: 999     # Requests remaining in current window
X-RateLimit-Reset: 1705318800  # Unix timestamp when window resets
X-RateLimit-Window: 3600       # Window duration in seconds
```

## API Rate Limits

### GraphQL API

| Plan         | Queries/Hour | Mutations/Hour | Complexity/Query |
| ------------ | ------------ | -------------- | ---------------- |
| Free         | 1,000        | 100            | 1,000            |
| Starter      | 10,000       | 1,000          | 5,000            |
| Professional | 50,000       | 5,000          | 10,000           |
| Enterprise   | Custom       | Custom         | Custom           |

### REST API

| Endpoint Category | Free        | Starter     | Professional | Enterprise |
| ----------------- | ----------- | ----------- | ------------ | ---------- |
| General           | 1,000/hour  | 10,000/hour | 50,000/hour  | Custom     |
| File Upload       | 100/hour    | 500/hour    | 2,000/hour   | Custom     |
| Export            | 10/hour     | 50/hour     | 200/hour     | Custom     |
| Search            | 100/min     | 500/min     | 2,000/min    | Custom     |
| Webhooks          | 10,000/hour | 50,000/hour | 200,000/hour | Custom     |

### WebSocket Limits

| Plan         | Connections | Messages/Min | Subscriptions |
| ------------ | ----------- | ------------ | ------------- |
| Free         | 10          | 100          | 50            |
| Starter      | 100         | 1,000        | 500           |
| Professional | 1,000       | 10,000       | 5,000         |
| Enterprise   | Custom      | Custom       | Custom        |

## Handling Rate Limits

### Checking Current Usage

```javascript
async function checkRateLimits() {
  const response = await fetch("/api/v1/rate-limits", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return {
    limit: parseInt(response.headers.get("X-RateLimit-Limit")),
    remaining: parseInt(response.headers.get("X-RateLimit-Remaining")),
    reset: new Date(parseInt(response.headers.get("X-RateLimit-Reset")) * 1000),
    window: parseInt(response.headers.get("X-RateLimit-Window")),
  };
}
```

### Exponential Backoff

```javascript
class RateLimitHandler {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 5;
    this.baseDelay = options.baseDelay || 1000;
    this.maxDelay = options.maxDelay || 32000;
  }

  async executeWithRetry(fn) {
    let lastError;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const result = await fn();
        return result;
      } catch (error) {
        if (error.status !== 429) {
          throw error; // Not a rate limit error
        }

        lastError = error;

        // Get retry delay from header or calculate
        const retryAfter = error.headers?.get("Retry-After");
        const delay = retryAfter
          ? parseInt(retryAfter) * 1000
          : Math.min(this.baseDelay * Math.pow(2, attempt), this.maxDelay);

        console.log(`Rate limited. Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}

// Usage
const rateLimitHandler = new RateLimitHandler();

const data = await rateLimitHandler.executeWithRetry(async () => {
  return await api.query({ query: GET_CONTACTS });
});
```

### Proactive Rate Limiting

```javascript
class RateLimiter {
  constructor(limit, window) {
    this.limit = limit;
    this.window = window; // in milliseconds
    this.requests = [];
  }

  async acquire() {
    const now = Date.now();

    // Remove old requests outside the window
    this.requests = this.requests.filter((time) => now - time < this.window);

    if (this.requests.length >= this.limit) {
      // Calculate wait time
      const oldestRequest = this.requests[0];
      const waitTime = this.window - (now - oldestRequest);

      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return this.acquire(); // Retry
    }

    this.requests.push(now);
  }

  async execute(fn) {
    await this.acquire();
    return fn();
  }
}

// Usage: 100 requests per minute
const limiter = new RateLimiter(100, 60000);

for (const item of items) {
  await limiter.execute(async () => {
    await api.updateContact(item.id, item.data);
  });
}
```

## Rate Limit Strategies

### 1. Request Batching

```javascript
// Instead of individual requests
for (const contact of contacts) {
  await api.updateContact(contact.id, { status: "active" });
}

// Use bulk operations
await api.bulkUpdateContacts({
  ids: contacts.map((c) => c.id),
  data: { status: "active" },
});
```

### 2. Caching

```javascript
class CachedAPI {
  constructor(api, ttl = 300000) {
    // 5 minutes
    this.api = api;
    this.cache = new Map();
    this.ttl = ttl;
  }

  async get(key, fetcher) {
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.data;
    }

    const data = await fetcher();
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });

    return data;
  }
}

const cachedAPI = new CachedAPI(api);

// Cached request
const contact = await cachedAPI.get(`contact:${id}`, () => api.getContact(id));
```

### 3. Request Prioritization

```javascript
class PriorityQueue {
  constructor(rateLimiter) {
    this.rateLimiter = rateLimiter;
    this.queues = {
      high: [],
      medium: [],
      low: [],
    };
    this.processing = false;
  }

  add(fn, priority = "medium") {
    this.queues[priority].push(fn);
    this.process();
  }

  async process() {
    if (this.processing) return;
    this.processing = true;

    while (this.hasRequests()) {
      const fn = this.getNext();
      await this.rateLimiter.execute(fn);
    }

    this.processing = false;
  }

  hasRequests() {
    return Object.values(this.queues).some((q) => q.length > 0);
  }

  getNext() {
    if (this.queues.high.length > 0) {
      return this.queues.high.shift();
    }
    if (this.queues.medium.length > 0) {
      return this.queues.medium.shift();
    }
    return this.queues.low.shift();
  }
}
```

## GraphQL Complexity Limits

### Understanding Complexity

```graphql
# Each field has a complexity cost
query ExpensiveQuery {
  contacts(first: 100) {
    # Cost: 100
    edges {
      node {
        id # Cost: 1
        deals(first: 10) {
          # Cost: 10 * 100 = 1000
          id
          activities(first: 5) {
            # Cost: 5 * 10 * 100 = 5000
            id
          }
        }
      }
    }
  }
}
# Total complexity: 6101 (may exceed limit)
```

### Optimizing Queries

```graphql
# Better: Use specific field selection
query OptimizedQuery {
  contacts(first: 20) {
    edges {
      node {
        id
        email
        recentDeals: deals(
          first: 3
          orderBy: { field: CREATED_AT, direction: DESC }
        ) {
          id
          value
        }
      }
    }
  }
}
```

## Webhook Rate Limits

### Delivery Limits

- Maximum webhook endpoints: 100 per workspace
- Delivery attempts: 6 per event
- Timeout: 10 seconds per delivery

### Webhook Throttling

```javascript
// Webhook receiver with rate limiting
const webhookLimiter = new RateLimiter(100, 60000); // 100/min

app.post("/webhook", async (req, res) => {
  // Quick acknowledgment
  res.status(200).send("OK");

  // Process with rate limiting
  webhookLimiter.add(async () => {
    await processWebhook(req.body);
  });
});
```

## Best Practices

### 1. Monitor Usage

```javascript
// Track API usage
class UsageMonitor {
  constructor() {
    this.usage = new Map();
  }

  track(endpoint, remaining, limit) {
    this.usage.set(endpoint, {
      remaining,
      limit,
      percentage: (remaining / limit) * 100,
      timestamp: Date.now(),
    });

    // Alert if running low
    if (remaining < limit * 0.1) {
      console.warn(`Low rate limit for ${endpoint}: ${remaining}/${limit}`);
    }
  }

  getUsage() {
    return Object.fromEntries(this.usage);
  }
}
```

### 2. Implement Circuit Breakers

```javascript
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failures = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.state = "CLOSED";
    this.nextAttempt = Date.now();
  }

  async execute(fn) {
    if (this.state === "OPEN") {
      if (Date.now() < this.nextAttempt) {
        throw new Error("Circuit breaker is OPEN");
      }
      this.state = "HALF_OPEN";
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    this.state = "CLOSED";
  }

  onFailure(error) {
    if (error.status === 429) {
      this.failures++;

      if (this.failures >= this.threshold) {
        this.state = "OPEN";
        this.nextAttempt = Date.now() + this.timeout;
      }
    }
  }
}
```

### 3. Use Webhooks for Heavy Operations

Instead of polling:

```javascript
// ❌ Bad: Polling
setInterval(async () => {
  const updates = await api.getContactUpdates();
  processUpdates(updates);
}, 5000);

// ✅ Good: Webhooks
api.subscribeToWebhook({
  url: "https://your-app.com/webhooks/contacts",
  events: ["contact.updated", "contact.created"],
});
```

## Rate Limit Errors

### Error Response

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded",
    "details": {
      "limit": 1000,
      "window": "1 hour",
      "reset": "2024-01-15T11:00:00Z",
      "retryAfter": 1234
    }
  }
}
```

### Handling Different APIs

```javascript
class UnifiedRateLimitHandler {
  async handle(error, api) {
    if (!this.isRateLimitError(error)) {
      throw error;
    }

    switch (api) {
      case "graphql":
        return this.handleGraphQLRateLimit(error);
      case "rest":
        return this.handleRESTRateLimit(error);
      case "websocket":
        return this.handleWebSocketRateLimit(error);
    }
  }

  isRateLimitError(error) {
    return (
      error.status === 429 ||
      error.code === "RATE_LIMITED" ||
      error.extensions?.code === "RATE_LIMITED"
    );
  }

  async wait(seconds) {
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }
}
```

## Quota Management

### Checking Quotas

```graphql
query GetQuotas {
  me {
    workspace {
      quotas {
        api {
          used
          limit
          resetAt
        }
        storage {
          used
          limit
        }
        aiCredits {
          used
          limit
          resetAt
        }
      }
    }
  }
}
```

### Quota Alerts

```javascript
async function monitorQuotas() {
  const quotas = await api.getQuotas();

  Object.entries(quotas).forEach(([resource, quota]) => {
    const usage = (quota.used / quota.limit) * 100;

    if (usage > 90) {
      alert(`Critical: ${resource} quota at ${usage}%`);
    } else if (usage > 75) {
      warn(`Warning: ${resource} quota at ${usage}%`);
    }
  });
}
```
