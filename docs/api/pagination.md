# Pagination Guide

## Overview

The hasteCRM platform uses cursor-based pagination for efficient data retrieval across all APIs. This guide covers pagination patterns for GraphQL, REST, and real-time data streams.

## Cursor-Based Pagination

### Why Cursor Pagination?

- **Stable**: New items don't affect existing pages
- **Efficient**: No need to count total records
- **Scalable**: Works well with large datasets
- **Real-time friendly**: Handles frequently changing data

## GraphQL Pagination

### Basic Pagination Query

```graphql
query GetContacts($first: Int!, $after: String) {
  contacts(first: $first, after: $after) {
    edges {
      node {
        id
        email
        firstName
        lastName
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

Variables:
```json
{
  "first": 20,
  "after": null
}
```

### Backward Pagination

```graphql
query GetContactsPrevious($last: Int!, $before: String) {
  contacts(last: $last, before: $before) {
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
  }
}
```

### Complete Pagination Example

```javascript
async function* paginateContacts(client, pageSize = 20) {
  let hasNextPage = true;
  let cursor = null;
  
  while (hasNextPage) {
    const { data } = await client.query({
      query: GET_CONTACTS,
      variables: {
        first: pageSize,
        after: cursor
      }
    });
    
    // Yield current page results
    for (const edge of data.contacts.edges) {
      yield edge.node;
    }
    
    // Update pagination state
    hasNextPage = data.contacts.pageInfo.hasNextPage;
    cursor = data.contacts.pageInfo.endCursor;
  }
}

// Usage
for await (const contact of paginateContacts(apolloClient)) {
  console.log(contact.email);
}
```

## REST API Pagination

### Request Format

```http
GET /v1/contacts?cursor=eyJpZCI6MTIzfQ&limit=50
```

### Response Format

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "contact_123",
        "email": "john@example.com"
      }
      // ... more items
    ],
    "pagination": {
      "hasNext": true,
      "hasPrev": false,
      "nextCursor": "eyJpZCI6MTczfQ",
      "prevCursor": null,
      "total": 1234,
      "currentPage": 1,
      "totalPages": 25
    }
  }
}
```

### REST Pagination Example

```javascript
class PaginatedAPI {
  constructor(baseURL, token) {
    this.baseURL = baseURL;
    this.headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }
  
  async *paginate(endpoint, limit = 50) {
    let cursor = null;
    let hasNext = true;
    
    while (hasNext) {
      const url = new URL(`${this.baseURL}${endpoint}`);
      url.searchParams.set('limit', limit);
      if (cursor) {
        url.searchParams.set('cursor', cursor);
      }
      
      const response = await fetch(url, {
        headers: this.headers
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error.message);
      }
      
      // Yield items from current page
      for (const item of data.data.items) {
        yield item;
      }
      
      // Update pagination state
      hasNext = data.data.pagination.hasNext;
      cursor = data.data.pagination.nextCursor;
    }
  }
}

// Usage
const api = new PaginatedAPI('https://api.haste.nyc/v1', token);

for await (const contact of api.paginate('/contacts')) {
  console.log(contact.email);
}
```

## Pagination Parameters

### Common Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `first`/`limit` | Integer | 20 | Items per page (max: 100) |
| `after`/`cursor` | String | null | Cursor for next page |
| `before` | String | null | Cursor for previous page (GraphQL only) |
| `last` | Integer | - | Items from end (GraphQL only) |

### Filtering with Pagination

#### GraphQL
```graphql
query FilteredContacts($first: Int!, $after: String, $filter: ContactFilter) {
  contacts(first: $first, after: $after, filter: $filter) {
    edges {
      node {
        id
        email
        status
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

Variables:
```json
{
  "first": 20,
  "after": null,
  "filter": {
    "status": "ACTIVE",
    "createdAfter": "2024-01-01"
  }
}
```

#### REST
```http
GET /v1/contacts?cursor=xxx&limit=20&filter[status]=active&filter[created_after]=2024-01-01
```

## Sorting with Pagination

### GraphQL Sorting

```graphql
query SortedContacts($first: Int!, $after: String, $orderBy: ContactOrderBy) {
  contacts(first: $first, after: $after, orderBy: $orderBy) {
    edges {
      node {
        id
        email
        createdAt
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

Variables:
```json
{
  "first": 20,
  "orderBy": {
    "field": "CREATED_AT",
    "direction": "DESC"
  }
}
```

### REST Sorting

```http
GET /v1/contacts?cursor=xxx&limit=20&sort=-created_at,last_name
```

Sort syntax:
- `-field` for descending
- `field` for ascending
- Comma-separated for multiple sorts

## Efficient Pagination Patterns

### 1. Batch Processing

```javascript
async function batchProcess(api, processor, batchSize = 100) {
  const batch = [];
  
  for await (const item of api.paginate('/contacts', batchSize)) {
    batch.push(item);
    
    if (batch.length >= batchSize) {
      await processor(batch);
      batch.length = 0; // Clear batch
    }
  }
  
  // Process remaining items
  if (batch.length > 0) {
    await processor(batch);
  }
}

// Usage
await batchProcess(api, async (contacts) => {
  console.log(`Processing ${contacts.length} contacts`);
  // Bulk operations here
}, 100);
```

### 2. Parallel Pagination

```javascript
async function parallelPaginate(api, endpoints) {
  const iterators = endpoints.map(endpoint => 
    api.paginate(endpoint)[Symbol.asyncIterator]()
  );
  
  const results = await Promise.all(
    iterators.map(async (iterator) => {
      const items = [];
      for await (const item of iterator) {
        items.push(item);
      }
      return items;
    })
  );
  
  return results;
}

// Usage
const [contacts, deals, emails] = await parallelPaginate(api, [
  '/contacts',
  '/deals',
  '/emails'
]);
```

### 3. Streaming Results

```javascript
async function streamToFile(api, endpoint, filename) {
  const writeStream = fs.createWriteStream(filename);
  
  for await (const item of api.paginate(endpoint)) {
    writeStream.write(JSON.stringify(item) + '\n');
  }
  
  writeStream.end();
}
```

## Real-time Pagination

### Handling Updates During Pagination

```javascript
class RealtimePaginatedList {
  constructor(api, endpoint, websocket) {
    this.api = api;
    this.endpoint = endpoint;
    this.websocket = websocket;
    this.items = new Map();
    this.newItems = [];
  }
  
  async initialize() {
    // Load initial data
    for await (const item of this.api.paginate(this.endpoint)) {
      this.items.set(item.id, item);
    }
    
    // Subscribe to updates
    this.websocket.on('item:created', (item) => {
      this.newItems.push(item);
    });
    
    this.websocket.on('item:updated', (item) => {
      this.items.set(item.id, item);
    });
    
    this.websocket.on('item:deleted', (item) => {
      this.items.delete(item.id);
    });
  }
  
  getItems() {
    // Merge new items with existing
    return [...this.newItems, ...this.items.values()];
  }
}
```

## Performance Optimization

### 1. Cursor Caching

```javascript
class CachedPaginator {
  constructor(api) {
    this.api = api;
    this.cursorCache = new Map();
  }
  
  async getPage(endpoint, pageNumber, pageSize = 20) {
    const cacheKey = `${endpoint}:${pageNumber}:${pageSize}`;
    
    // Check if we have a cursor for this page
    let cursor = this.cursorCache.get(cacheKey);
    
    if (!cursor && pageNumber > 1) {
      // Need to paginate to get cursor
      await this.paginateToPage(endpoint, pageNumber, pageSize);
      cursor = this.cursorCache.get(cacheKey);
    }
    
    // Fetch the page
    const response = await this.api.get(endpoint, {
      cursor,
      limit: pageSize
    });
    
    // Cache the next cursor
    if (response.pagination.nextCursor) {
      const nextKey = `${endpoint}:${pageNumber + 1}:${pageSize}`;
      this.cursorCache.set(nextKey, response.pagination.nextCursor);
    }
    
    return response;
  }
}
```

### 2. Prefetching

```javascript
class PrefetchPaginator {
  constructor(api, prefetchPages = 2) {
    this.api = api;
    this.prefetchPages = prefetchPages;
    this.cache = new Map();
  }
  
  async *paginate(endpoint, pageSize = 20) {
    let cursor = null;
    let hasNext = true;
    let pageIndex = 0;
    
    // Start prefetching
    this.prefetchNext(endpoint, cursor, pageSize, pageIndex);
    
    while (hasNext) {
      const cacheKey = `${cursor || 'initial'}`;
      
      // Wait for page if not cached
      while (!this.cache.has(cacheKey)) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      const page = this.cache.get(cacheKey);
      this.cache.delete(cacheKey);
      
      // Yield items
      for (const item of page.items) {
        yield item;
      }
      
      // Update state
      hasNext = page.pagination.hasNext;
      cursor = page.pagination.nextCursor;
      pageIndex++;
      
      // Prefetch next pages
      if (hasNext) {
        this.prefetchNext(endpoint, cursor, pageSize, pageIndex);
      }
    }
  }
  
  async prefetchNext(endpoint, cursor, pageSize, currentPage) {
    const promises = [];
    let nextCursor = cursor;
    
    for (let i = 0; i < this.prefetchPages; i++) {
      const cacheKey = `${nextCursor || 'initial'}`;
      
      if (!this.cache.has(cacheKey)) {
        promises.push(
          this.fetchPage(endpoint, nextCursor, pageSize)
            .then(page => {
              this.cache.set(cacheKey, page);
              nextCursor = page.pagination.nextCursor;
            })
        );
      }
    }
    
    await Promise.all(promises);
  }
}
```

## Error Handling in Pagination

### Handling Cursor Expiration

```javascript
async function robustPaginate(api, endpoint, options = {}) {
  const { onError, maxRetries = 3 } = options;
  let retries = 0;
  
  async function* paginate(cursor = null) {
    try {
      const response = await api.get(endpoint, { cursor });
      
      for (const item of response.items) {
        yield item;
      }
      
      if (response.pagination.hasNext) {
        yield* paginate(response.pagination.nextCursor);
      }
    } catch (error) {
      if (error.code === 'CURSOR_EXPIRED' && retries < maxRetries) {
        retries++;
        console.log('Cursor expired, restarting pagination');
        yield* paginate(null); // Start from beginning
      } else {
        if (onError) {
          onError(error);
        } else {
          throw error;
        }
      }
    }
  }
  
  yield* paginate();
}
```

## Best Practices

### 1. Choose Appropriate Page Size

```javascript
// Small pages for real-time UI
const uiPaginator = api.paginate('/contacts', 20);

// Large pages for batch processing
const batchPaginator = api.paginate('/contacts', 100);

// Maximum efficiency for exports
const exportPaginator = api.paginate('/contacts', 1000);
```

### 2. Handle Empty Results

```javascript
async function safePageinate(api, endpoint) {
  const results = [];
  let hasData = false;
  
  for await (const item of api.paginate(endpoint)) {
    hasData = true;
    results.push(item);
  }
  
  if (!hasData) {
    console.log('No data found');
  }
  
  return results;
}
```

### 3. Progress Tracking

```javascript
async function paginateWithProgress(api, endpoint, onProgress) {
  let processed = 0;
  const startTime = Date.now();
  
  for await (const item of api.paginate(endpoint)) {
    processed++;
    
    if (processed % 100 === 0) {
      const elapsed = Date.now() - startTime;
      const rate = processed / (elapsed / 1000);
      
      onProgress({
        processed,
        rate: Math.round(rate),
        elapsed
      });
    }
    
    yield item;
  }
}

// Usage
for await (const contact of paginateWithProgress(api, '/contacts', (stats) => {
  console.log(`Processed: ${stats.processed} (${stats.rate}/sec)`);
})) {
  // Process contact
}
```

## Testing Pagination

### Mock Paginated Responses

```javascript
function createMockPaginator(items, pageSize = 2) {
  return {
    async *paginate() {
      for (let i = 0; i < items.length; i += pageSize) {
        const page = items.slice(i, i + pageSize);
        for (const item of page) {
          yield item;
        }
      }
    }
  };
}

// Test
const mockApi = createMockPaginator([
  { id: 1, name: 'Item 1' },
  { id: 2, name: 'Item 2' },
  { id: 3, name: 'Item 3' }
]);

const results = [];
for await (const item of mockApi.paginate()) {
  results.push(item);
}
```