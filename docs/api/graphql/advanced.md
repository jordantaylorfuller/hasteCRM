# GraphQL Advanced Guide

## Overview

This guide covers advanced GraphQL patterns, performance optimization, and best practices for building scalable applications with the hasteCRM GraphQL API.

> **Prerequisites:**
>
> - Completed [GraphQL Basics Guide](./basics.md)
> - Understanding of GraphQL fundamentals
> - Familiarity with our [Authentication Guide](../auth-guide.md)

## Table of Contents

1. [Query Optimization](#query-optimization)
2. [Advanced Patterns](#advanced-patterns)
3. [Real-time Subscriptions](#real-time-subscriptions)
4. [Batch Operations](#batch-operations)
5. [Error Handling Strategies](#error-handling-strategies)
6. [Caching Strategies](#caching-strategies)
7. [Security Best Practices](#security-best-practices)
8. [Performance Monitoring](#performance-monitoring)

## Query Optimization

### DataLoader Pattern

Prevent N+1 queries with batching and caching:

```javascript
const DataLoader = require("dataloader");

// Create loaders
const createLoaders = () => ({
  contactLoader: new DataLoader(async (ids) => {
    const contacts = await db.contacts.findMany({
      where: { id: { in: ids } },
    });

    // Map results to match input order
    return ids.map((id) => contacts.find((c) => c.id === id));
  }),

  // Nested relationship loader
  contactActivitiesLoader: new DataLoader(async (contactIds) => {
    const activities = await db.activities.findMany({
      where: { contactId: { in: contactIds } },
      orderBy: { occurredAt: "desc" },
    });

    // Group by contact
    return contactIds.map((id) => activities.filter((a) => a.contactId === id));
  }),
});

// Use in resolvers
const resolvers = {
  Query: {
    contact: (parent, { id }, { loaders }) => loaders.contactLoader.load(id),
  },
  Contact: {
    activities: (contact, args, { loaders }) =>
      loaders.contactActivitiesLoader.load(contact.id),
  },
};
```

### Query Complexity Analysis

Implement complexity limits to prevent expensive queries:

```javascript
const depthLimit = require("graphql-depth-limit");
const costAnalysis = require("graphql-cost-analysis");

// Define field costs
const fieldCosts = {
  Query: {
    contacts: { complexity: 1, multiplier: "first" },
    searchContacts: { complexity: 10, multiplier: "limit" },
  },
  Contact: {
    activities: { complexity: 1, multiplier: "first" },
    aiInsights: { complexity: 5 },
  },
};

// Apollo Server configuration
const server = new ApolloServer({
  validationRules: [
    depthLimit(5), // Max query depth
    costAnalysis({
      maximumCost: 1000,
      defaultCost: 1,
      scalarCost: 1,
      objectCost: 0,
      listFactor: 10,
      introspectionCost: 1000,
      createError: (max, actual) =>
        new Error(`Query complexity ${actual} exceeds maximum of ${max}`),
    }),
  ],
});
```

### Fragment Optimization

Use fragments for reusable field selections:

```graphql
# Define reusable fragments
fragment ContactBasics on Contact {
  id
  email
  firstName
  lastName
  company
  score
}

fragment ContactWithActivities on Contact {
  ...ContactBasics
  activities(first: 5) {
    nodes {
      id
      type
      title
      occurredAt
    }
  }
}

# Use in queries
query GetContacts {
  contacts(first: 20) {
    nodes {
      ...ContactWithActivities
    }
  }
}
```

### Persisted Queries

Reduce bandwidth and improve security:

```javascript
// Client-side
import { createPersistedQueryLink } from "@apollo/client/link/persisted-queries";
import { sha256 } from "crypto-hash";

const persistedQueryLink = createPersistedQueryLink({
  sha256,
  useGETForHashedQueries: true,
});

// Server-side
const server = new ApolloServer({
  persistedQueries: {
    cache: new InMemoryLRUCache({
      maxSize: 1000,
    }),
  },
});
```

## Advanced Patterns

### Relay-Style Pagination

Implement cursor-based pagination with connections:

```graphql
type ContactConnection {
  edges: [ContactEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type ContactEdge {
  node: Contact!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

# Query with Relay pagination
query GetContactsRelay($first: Int!, $after: String) {
  contacts(first: $first, after: $after) {
    edges {
      node {
        id
        email
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

### Optimistic UI Updates

```javascript
const CREATE_CONTACT = gql`
  mutation CreateContact($input: CreateContactInput!) {
    createContact(input: $input) {
      id
      email
      firstName
      lastName
    }
  }
`;

function CreateContactForm() {
  const [createContact] = useMutation(CREATE_CONTACT, {
    optimisticResponse: {
      createContact: {
        __typename: "Contact",
        id: "temp-" + Date.now(),
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
      },
    },
    update: (cache, { data: { createContact } }) => {
      // Update cache with new contact
      cache.modify({
        fields: {
          contacts(existingContacts = []) {
            const newContactRef = cache.writeFragment({
              data: createContact,
              fragment: gql`
                fragment NewContact on Contact {
                  id
                  email
                  firstName
                  lastName
                }
              `,
            });
            return [...existingContacts, newContactRef];
          },
        },
      });
    },
  });
}
```

### Conditional Fields

Query fields based on runtime conditions:

```graphql
query GetContact($id: ID!, $includeActivities: Boolean!) {
  contact(id: $id) {
    id
    email
    firstName
    lastName

    # Conditional field
    activities(first: 10) @include(if: $includeActivities) {
      nodes {
        id
        type
        title
      }
    }

    # Skip directive
    aiInsights @skip(if: $skipAI) {
      summary
      nextBestAction
    }
  }
}
```

### Union Types for Search

```graphql
union SearchResult = Contact | Company | Deal | Email

query GlobalSearch($query: String!) {
  search(query: $query) {
    ... on Contact {
      id
      email
      fullName
      company
    }
    ... on Company {
      id
      name
      domain
      industry
    }
    ... on Deal {
      id
      title
      value
      stage
    }
    ... on Email {
      id
      subject
      from
      sentAt
    }
  }
}
```

## Real-time Subscriptions

### WebSocket Setup

```javascript
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";

const wsLink = new GraphQLWsLink(
  createClient({
    url: "wss://api.haste.nyc/graphql",
    connectionParams: {
      authorization: `Bearer ${getToken()}`,
    },
    on: {
      connected: () => console.log("Connected to WebSocket"),
      error: (error) => console.error("WebSocket error:", error),
    },
  }),
);

// Split link for queries/mutations vs subscriptions
const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === "OperationDefinition" &&
      definition.operation === "subscription"
    );
  },
  wsLink,
  httpLink,
);
```

### Subscription Examples

```javascript
// Contact updates subscription
const CONTACT_UPDATED = gql`
  subscription ContactUpdated($id: ID!) {
    contactUpdated(id: $id) {
      id
      score
      lifecycleStage
      lastActivityAt
      aiInsights {
        summary
        nextBestAction
      }
    }
  }
`;

function ContactDetails({ contactId }) {
  const { data, loading } = useSubscription(CONTACT_UPDATED, {
    variables: { id: contactId },
    onSubscriptionData: ({ subscriptionData }) => {
      console.log("Contact updated:", subscriptionData);
    },
  });

  return <div>{/* Render contact */}</div>;
}

// Multiple subscriptions
const WORKSPACE_ACTIVITY = gql`
  subscription WorkspaceActivity($workspaceId: ID!) {
    contactCreated(workspaceId: $workspaceId) {
      id
      email
      createdBy {
        fullName
      }
    }
    dealClosed(workspaceId: $workspaceId) {
      id
      title
      value
      won
    }
  }
`;
```

## Batch Operations

### Bulk Mutations

```graphql
mutation BulkOperations(
  $createContacts: [CreateContactInput!]!
  $updateContacts: [UpdateContactInput!]!
  $deleteContactIds: [ID!]!
) {
  # Create multiple contacts
  bulkCreateContacts(input: $createContacts) {
    success
    contacts {
      id
      email
    }
    errors {
      index
      message
    }
  }

  # Update multiple contacts
  bulkUpdateContacts(input: $updateContacts) {
    success
    updatedCount
    errors {
      id
      message
    }
  }

  # Delete multiple contacts
  bulkDeleteContacts(ids: $deleteContactIds) {
    success
    deletedCount
  }
}
```

### Transaction Pattern

```javascript
// Wrap multiple operations in a transaction
const TRANSACTION_MUTATION = gql`
  mutation ExecuteTransaction($operations: [TransactionOperation!]!) {
    transaction(operations: $operations) {
      success
      results {
        operationId
        data
        error
      }
      rollbackReason
    }
  }
`;

const operations = [
  {
    id: "op1",
    type: "CREATE_CONTACT",
    input: { email: "john@haste.nyc", firstName: "John" },
  },
  {
    id: "op2",
    type: "CREATE_DEAL",
    input: {
      title: "New Deal",
      contactId: { ref: "op1.id" }, // Reference previous operation
    },
  },
];
```

## Error Handling Strategies

### Comprehensive Error Handling

```javascript
const errorLink = onError(
  ({ graphQLErrors, networkError, operation, forward }) => {
    if (graphQLErrors) {
      graphQLErrors.forEach(({ message, locations, path, extensions }) => {
        // Handle different error types
        switch (extensions?.code) {
          case "UNAUTHENTICATED":
            // Refresh token
            return refreshToken().then(() => forward(operation));

          case "RATE_LIMITED":
            // Implement retry with backoff
            const retryAfter = extensions.retryAfter || 60;
            return new Observable((observer) => {
              setTimeout(() => {
                forward(operation).subscribe(observer);
              }, retryAfter * 1000);
            });

          case "VALIDATION_ERROR":
            // Show user-friendly error
            showValidationError(extensions.field, message);
            break;

          default:
            console.error(`GraphQL error: ${message}`);
        }
      });
    }

    if (networkError) {
      console.error(`Network error: ${networkError}`);

      // Retry on network errors
      if (networkError.statusCode >= 500) {
        return retryLink.request(operation);
      }
    }
  },
);
```

### Field-Level Errors

```graphql
type ContactResult {
  contact: Contact
  error: ContactError
}

type ContactError {
  code: String!
  message: String!
  field: String
}

query GetContactSafe($id: ID!) {
  contactResult(id: $id) {
    contact {
      id
      email
    }
    error {
      code
      message
    }
  }
}
```

## Caching Strategies

### Apollo Cache Configuration

```javascript
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        contacts: {
          // Pagination handling
          keyArgs: ["filter", "sort"],
          merge(existing = [], incoming, { args }) {
            const merged = existing.slice(0);
            const offset = args?.offset || 0;

            for (let i = 0; i < incoming.length; i++) {
              merged[offset + i] = incoming[i];
            }

            return merged;
          },
        },
      },
    },
    Contact: {
      fields: {
        activities: {
          // Separate cache by pagination args
          keyArgs: ["filter", "sort"],
          merge(existing, incoming) {
            return incoming;
          },
        },
      },
    },
  },
});
```

### Cache Updates

```javascript
// Update cache after mutation
const [updateContact] = useMutation(UPDATE_CONTACT, {
  update(cache, { data: { updateContact } }) {
    // Update the specific contact
    cache.writeFragment({
      id: cache.identify(updateContact),
      fragment: gql`
        fragment UpdatedContact on Contact {
          score
          lifecycleStage
          lastActivityAt
        }
      `,
      data: updateContact,
    });

    // Update query results
    cache.modify({
      fields: {
        contacts(existingContacts, { readField }) {
          return existingContacts.map((contactRef) => {
            if (readField("id", contactRef) === updateContact.id) {
              return cache.writeFragment({
                data: updateContact,
                fragment: gql`
                  fragment _ on Contact {
                    id
                  }
                `,
              });
            }
            return contactRef;
          });
        },
      },
    });
  },
});
```

### Background Refetch

```javascript
// Refetch stale data in background
const { data, refetch } = useQuery(GET_CONTACTS, {
  fetchPolicy: "cache-and-network",
  nextFetchPolicy: "cache-first",
  pollInterval: 300000, // 5 minutes
  onCompleted: (data) => {
    // Check if data is stale
    const lastFetch = cache.extract().__META__?.lastFetch;
    if (Date.now() - lastFetch > 3600000) {
      // 1 hour
      refetch();
    }
  },
});
```

## Security Best Practices

### Query Whitelisting

```javascript
// Server-side query whitelisting
const server = new ApolloServer({
  validationRules: [
    require("graphql-query-whitelist")({
      whitelist: {
        GetContacts: fs.readFileSync("./queries/GetContacts.graphql", "utf8"),
        CreateContact: fs.readFileSync(
          "./queries/CreateContact.graphql",
          "utf8",
        ),
      },
    }),
  ],
});
```

### Field-Level Authorization

```javascript
const resolvers = {
  Contact: {
    // Sensitive field authorization
    ssn: async (contact, args, { user }) => {
      if (!user.permissions.includes("view:sensitive_data")) {
        throw new ForbiddenError("Insufficient permissions");
      }
      return contact.ssn;
    },

    // Owner-only fields
    privateNotes: async (contact, args, { user }) => {
      if (contact.ownerId !== user.id) {
        return null;
      }
      return contact.privateNotes;
    },
  },
};
```

### Rate Limiting

```javascript
// Implement query-specific rate limits
const rateLimitDirective =
  (defaultLimit = 60, defaultWindow = 60) =>
  (next, source, args, context) => {
    const limit = args.limit || defaultLimit;
    const window = args.window || defaultWindow;
    const key = `${context.user.id}:${context.fieldName}`;

    return rateLimiter
      .check(key, limit, window)
      .then(() => next())
      .catch(() => {
        throw new Error("Rate limit exceeded");
      });
  };

// Apply to schema
const schema = makeExecutableSchema({
  typeDefs: `
    directive @rateLimit(
      limit: Int
      window: Int
    ) on FIELD_DEFINITION
    
    type Query {
      expensiveQuery: Result @rateLimit(limit: 10, window: 3600)
    }
  `,
  schemaDirectives: {
    rateLimit: rateLimitDirective,
  },
});
```

## Performance Monitoring

### Query Tracing

```javascript
const server = new ApolloServer({
  plugins: [
    {
      requestDidStart() {
        return {
          willSendResponse(requestContext) {
            // Log slow queries
            const { response, request } = requestContext;
            const tracing = response.extensions?.tracing;

            if (tracing && tracing.duration > 1000000000) {
              // 1 second
              console.warn("Slow query detected:", {
                query: request.query,
                duration: tracing.duration / 1000000, // Convert to ms
                resolvers: tracing.execution.resolvers
                  .filter((r) => r.duration > 100000000) // 100ms
                  .map((r) => ({
                    path: r.path.join("."),
                    duration: r.duration / 1000000,
                  })),
              });
            }
          },
        };
      },
    },
  ],
});
```

### Custom Metrics

```javascript
// Prometheus metrics
const promClient = require("prom-client");

const queryDuration = new promClient.Histogram({
  name: "graphql_query_duration_seconds",
  help: "GraphQL query duration",
  labelNames: ["operationName", "operationType"],
});

const fieldResolution = new promClient.Histogram({
  name: "graphql_field_resolution_duration_seconds",
  help: "GraphQL field resolution duration",
  labelNames: ["parentType", "fieldName"],
});

// Track metrics
const server = new ApolloServer({
  plugins: [
    {
      requestDidStart() {
        const start = Date.now();

        return {
          willSendResponse(requestContext) {
            const duration = Date.now() - start;
            const { operationName, operation } = requestContext;

            queryDuration
              .labels(operationName, operation.operation)
              .observe(duration / 1000);
          },
        };
      },
    },
  ],
});
```

## Advanced Query Examples

### Recursive Queries

```graphql
# Company hierarchy
query GetCompanyHierarchy($id: ID!, $depth: Int = 3) {
  company(id: $id) {
    ...CompanyFields
    subsidiaries {
      ...CompanyFields
      subsidiaries @include(if: $depth > 1) {
        ...CompanyFields
        subsidiaries @include(if: $depth > 2) {
          ...CompanyFields
        }
      }
    }
  }
}

fragment CompanyFields on Company {
  id
  name
  domain
  employeeCount
}
```

### Complex Filtering

```graphql
query AdvancedContactSearch(
  $filter: ContactFilter!
  $sort: [ContactSort!]
  $first: Int!
  $after: String
) {
  contacts(
    filter: $filter
    sort: $sort
    first: $first
    after: $after
  ) {
    nodes {
      id
      email
      score
      # Computed fields
      engagementLevel
      daysSinceLastContact
      predictedChurnRisk
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    # Aggregations
    aggregations {
      scoreDistribution {
        bucket
        count
      }
      topCompanies {
        company
        count
      }
    }
  }
}

# Complex filter
variables: {
  filter: {
    and: [
      { score: { gte: 70 } },
      { lifecycleStage: { in: ["SQL", "opportunity"] } },
      {
        or: [
          { lastActivityAt: { gte: "2024-01-01" } },
          { tags: { contains: "high-priority" } }
        ]
      }
    ]
  },
  sort: [
    { field: "score", direction: DESC },
    { field: "lastActivityAt", direction: DESC }
  ]
}
```

## Related Documentation

- [GraphQL Basics Guide](./basics.md) - Getting started with GraphQL
- [GraphQL Schema Reference](./reference.md) - Complete schema documentation
- [Error Handling Guide](../errors.md) - Comprehensive error handling
- [Rate Limiting Guide](../rate-limiting.md) - API quotas and limits
- [Performance Guide](../../guides/performance.md) - System-wide optimization

---

_Last Updated: 2024-01-15_
