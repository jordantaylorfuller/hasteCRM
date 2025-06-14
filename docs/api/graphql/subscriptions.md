# GraphQL Subscriptions Guide

## Overview

hasteCRM uses GraphQL subscriptions to provide real-time updates to connected clients. This guide covers the implementation of WebSocket-based subscriptions using Apollo Server and Redis PubSub.

## Architecture

### Technology Stack

- **Apollo Server**: GraphQL server with subscription support
- **GraphQL Subscriptions**: WebSocket protocol
- **Redis PubSub**: Scalable pub/sub for multi-instance deployments
- **Socket.io**: Fallback for older browsers

### Connection Flow

```
Client → WebSocket → Apollo Server → Redis PubSub → Event Emitters
                           ↓
                    Authentication
                           ↓
                    Context Setup
                           ↓
                    Subscription Handler
```

## Configuration

### Server Setup

```typescript
// apps/api/src/app.module.ts
import { GraphQLModule } from "@nestjs/graphql";
import { ApolloDriver, ApolloDriverConfig } from "@nestjs/apollo";
import { RedisPubSub } from "graphql-redis-subscriptions";

@Module({
  imports: [
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      useFactory: (configService: ConfigService) => ({
        autoSchemaFile: true,
        subscriptions: {
          "graphql-ws": {
            path: "/graphql",
            onConnect: async (context) => {
              const { connectionParams } = context;
              const token = connectionParams?.authorization;

              if (!token) {
                throw new Error("Missing auth token");
              }

              const user = await validateToken(token);
              return { user };
            },
            onDisconnect: async (context) => {
              // Cleanup logic
            },
          },
        },
        context: ({ req, connection }) => {
          if (connection) {
            // WebSocket connection
            return connection.context;
          }
          // HTTP request
          return { req };
        },
      }),
    }),
  ],
})
export class AppModule {}
```

### PubSub Configuration

```typescript
// apps/api/src/pubsub/pubsub.module.ts
import { Global, Module } from "@nestjs/common";
import { RedisPubSub } from "graphql-redis-subscriptions";
import Redis from "ioredis";

@Global()
@Module({
  providers: [
    {
      provide: "PUB_SUB",
      useFactory: (configService: ConfigService) => {
        const options = {
          host: configService.get("REDIS_HOST"),
          port: configService.get("REDIS_PORT"),
          password: configService.get("REDIS_PASSWORD"),
          retryStrategy: (times: number) => Math.min(times * 50, 2000),
        };

        return new RedisPubSub({
          publisher: new Redis(options),
          subscriber: new Redis(options),
        });
      },
      inject: [ConfigService],
    },
    PubSubService,
  ],
  exports: ["PUB_SUB", PubSubService],
})
export class PubSubModule {}
```

### PubSub Service

```typescript
// apps/api/src/pubsub/pubsub.service.ts
import { Inject, Injectable } from "@nestjs/common";
import { RedisPubSub } from "graphql-redis-subscriptions";

@Injectable()
export class PubSubService {
  constructor(@Inject("PUB_SUB") private pubsub: RedisPubSub) {}

  async publish(triggerName: string, payload: any): Promise<void> {
    await this.pubsub.publish(triggerName, payload);
  }

  asyncIterator<T>(triggers: string | string[]): AsyncIterator<T> {
    return this.pubsub.asyncIterator(triggers);
  }

  // Typed publish methods
  async publishContactCreated(
    workspaceId: string,
    contact: Contact,
  ): Promise<void> {
    await this.publish(`contact.created.${workspaceId}`, {
      contactCreated: contact,
    });
  }

  async publishContactUpdated(
    contactId: string,
    contact: Contact,
  ): Promise<void> {
    await this.publish(`contact.updated.${contactId}`, {
      contactUpdated: contact,
    });
  }

  async publishActivityCreated(
    workspaceId: string,
    activity: Activity,
  ): Promise<void> {
    await this.publish(`activity.created.${workspaceId}`, {
      activityCreated: activity,
    });
  }
}
```

## Subscription Types

### Entity Subscriptions

```graphql
type Subscription {
  # Contact subscriptions
  contactCreated(workspaceId: ID!): Contact!
  contactUpdated(contactId: ID!): Contact!
  contactDeleted(contactId: ID!): ID!

  # Deal subscriptions
  dealCreated(pipelineId: ID!): Deal!
  dealUpdated(dealId: ID!): Deal!
  dealStageChanged(dealId: ID!): DealStageChange!

  # Activity feed
  activityCreated(workspaceId: ID!): Activity!

  # Email subscriptions
  emailReceived(accountId: ID!): Email!
  emailSent(workspaceId: ID!): Email!
  emailOpened(emailId: ID!): EmailTrackingEvent!
}
```

### Collaboration Subscriptions

```graphql
type Subscription {
  # User presence
  userPresenceChanged(workspaceId: ID!): UserPresence!

  # Real-time collaboration
  contactBeingEdited(contactId: ID!): EditingStatus!
  noteAdded(entityId: ID!, entityType: EntityType!): Note!

  # Notifications
  notificationReceived(userId: ID!): Notification!
}
```

## Implementation Examples

### Contact Subscriptions

```typescript
// contacts/contact.subscriptions.ts
@Resolver(() => Contact)
export class ContactSubscriptionResolver {
  constructor(private readonly pubsub: PubSubService) {}

  @Subscription(() => Contact, {
    name: "contactCreated",
    filter: (payload, variables, context) => {
      // Ensure user has access to workspace
      const userWorkspaces = context.user.workspaces.map((w) => w.id);
      return userWorkspaces.includes(variables.workspaceId);
    },
  })
  contactCreated(@Args("workspaceId") workspaceId: string) {
    return this.pubsub.asyncIterator(`contact.created.${workspaceId}`);
  }

  @Subscription(() => Contact, {
    name: "contactUpdated",
    resolve: async (payload, args, context) => {
      // Enrich the payload with additional data if needed
      const contact = payload.contactUpdated;

      // Add real-time activity info
      contact.currentViewers = await this.getViewers(contact.id);

      return contact;
    },
  })
  contactUpdated(@Args("contactId") contactId: string) {
    return this.pubsub.asyncIterator(`contact.updated.${contactId}`);
  }

  @Subscription(() => ID, {
    name: "contactDeleted",
  })
  contactDeleted(@Args("contactId") contactId: string) {
    return this.pubsub.asyncIterator(`contact.deleted.${contactId}`);
  }
}
```

### Activity Feed Subscription

```typescript
// activities/activity.subscriptions.ts
@Resolver(() => Activity)
export class ActivitySubscriptionResolver {
  constructor(
    private readonly pubsub: PubSubService,
    private readonly activityService: ActivityService,
  ) {}

  @Subscription(() => Activity, {
    name: "activityCreated",
    filter: async (payload, variables, context) => {
      // Complex filtering logic
      const activity = payload.activityCreated;

      // Filter by workspace
      if (activity.workspaceId !== variables.workspaceId) {
        return false;
      }

      // Filter by user preferences
      const preferences = await this.getUserPreferences(context.user.id);
      if (!preferences.activityTypes.includes(activity.type)) {
        return false;
      }

      // Filter by entity access
      if (activity.contactId) {
        const hasAccess = await this.checkContactAccess(
          context.user.id,
          activity.contactId,
        );
        if (!hasAccess) return false;
      }

      return true;
    },
  })
  activityCreated(
    @Args("workspaceId") workspaceId: string,
    @Args("filter", { nullable: true }) filter?: ActivityFilter,
  ) {
    return this.pubsub.asyncIterator(`activity.created.${workspaceId}`);
  }
}
```

### Real-time Collaboration

```typescript
// collaboration/collaboration.subscriptions.ts
interface EditingStatus {
  entityId: string;
  entityType: string;
  users: EditingUser[];
}

interface EditingUser {
  id: string;
  name: string;
  avatarUrl?: string;
  field?: string;
  startedAt: Date;
}

@Resolver()
export class CollaborationSubscriptionResolver {
  private editingSessions = new Map<string, Set<EditingUser>>();

  @Subscription(() => EditingStatus, {
    name: "contactBeingEdited",
  })
  async *contactBeingEdited(
    @Args("contactId") contactId: string,
    @Context() context: any,
  ): AsyncIterator<EditingStatus> {
    const user = context.user;
    const sessionKey = `contact:${contactId}`;

    // Add user to editing session
    if (!this.editingSessions.has(sessionKey)) {
      this.editingSessions.set(sessionKey, new Set());
    }

    const session = this.editingSessions.get(sessionKey)!;
    const editingUser: EditingUser = {
      id: user.id,
      name: user.fullName,
      avatarUrl: user.avatarUrl,
      startedAt: new Date(),
    };

    session.add(editingUser);

    // Broadcast updated status
    const status: EditingStatus = {
      entityId: contactId,
      entityType: "contact",
      users: Array.from(session),
    };

    yield status;

    // Listen for updates
    const iterator = this.pubsub.asyncIterator(`editing.${sessionKey}`);

    try {
      for await (const update of iterator) {
        yield update;
      }
    } finally {
      // Remove user from session on disconnect
      session.delete(editingUser);

      // Broadcast updated status
      await this.pubsub.publish(`editing.${sessionKey}`, {
        contactBeingEdited: {
          entityId: contactId,
          entityType: "contact",
          users: Array.from(session),
        },
      });

      // Clean up empty sessions
      if (session.size === 0) {
        this.editingSessions.delete(sessionKey);
      }
    }
  }
}
```

## Client Implementation

### Apollo Client Setup

```typescript
// apps/web/src/lib/apollo-client.ts
import { ApolloClient, InMemoryCache, split } from "@apollo/client";
import { getMainDefinition } from "@apollo/client/utilities";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";
import { HttpLink } from "@apollo/client/link/http";

const httpLink = new HttpLink({
  uri: process.env.NEXT_PUBLIC_API_URL + "/graphql",
  credentials: "include",
});

const wsLink = new GraphQLWsLink(
  createClient({
    url: process.env.NEXT_PUBLIC_WS_URL + "/graphql",
    connectionParams: async () => {
      const token = await getAuthToken();
      return {
        authorization: token ? `Bearer ${token}` : "",
      };
    },
    shouldRetry: () => true,
    retryAttempts: 5,
    retryWait: async (retries) => {
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, retries) * 1000),
      );
    },
  }),
);

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

export const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});
```

### React Hook Usage

```typescript
// apps/web/src/hooks/useContactSubscription.ts
import { useSubscription, gql } from '@apollo/client';
import { useEffect } from 'react';
import { useWorkspace } from './useWorkspace';

const CONTACT_CREATED_SUBSCRIPTION = gql`
  subscription ContactCreated($workspaceId: ID!) {
    contactCreated(workspaceId: $workspaceId) {
      id
      firstName
      lastName
      email
      company {
        id
        name
      }
      createdAt
    }
  }
`;

export function useContactCreatedSubscription(
  onContactCreated?: (contact: Contact) => void,
) {
  const { currentWorkspace } = useWorkspace();

  const { data, loading, error } = useSubscription(
    CONTACT_CREATED_SUBSCRIPTION,
    {
      variables: { workspaceId: currentWorkspace?.id },
      skip: !currentWorkspace?.id,
    },
  );

  useEffect(() => {
    if (data?.contactCreated && onContactCreated) {
      onContactCreated(data.contactCreated);
    }
  }, [data, onContactCreated]);

  return { loading, error };
}

// Usage in component
function ContactList() {
  const [contacts, setContacts] = useState<Contact[]>([]);

  useContactCreatedSubscription((newContact) => {
    setContacts(prev => [newContact, ...prev]);

    // Show notification
    toast.success(`New contact added: ${newContact.fullName}`);
  });

  return (
    // Render contacts
  );
}
```

### Real-time Collaboration Hook

```typescript
// apps/web/src/hooks/useCollaboration.ts
const EDITING_STATUS_SUBSCRIPTION = gql`
  subscription ContactBeingEdited($contactId: ID!) {
    contactBeingEdited(contactId: $contactId) {
      entityId
      entityType
      users {
        id
        name
        avatarUrl
        field
        startedAt
      }
    }
  }
`;

export function useEditingStatus(entityId: string, entityType: string) {
  const [editingUsers, setEditingUsers] = useState<EditingUser[]>([]);

  const { data, loading, error } = useSubscription(
    EDITING_STATUS_SUBSCRIPTION,
    {
      variables: { contactId: entityId },
      skip: entityType !== 'contact',
    },
  );

  useEffect(() => {
    if (data?.contactBeingEdited) {
      setEditingUsers(data.contactBeingEdited.users);
    }
  }, [data]);

  return {
    editingUsers,
    isBeingEdited: editingUsers.length > 0,
    loading,
    error,
  };
}

// Usage in contact form
function ContactForm({ contact }: { contact: Contact }) {
  const { editingUsers, isBeingEdited } = useEditingStatus(contact.id, 'contact');

  return (
    <div>
      {isBeingEdited && (
        <div className="editing-indicator">
          {editingUsers.map(user => (
            <Avatar
              key={user.id}
              src={user.avatarUrl}
              alt={user.name}
              title={`${user.name} is editing`}
            />
          ))}
        </div>
      )}
      {/* Form fields */}
    </div>
  );
}
```

## Performance Optimization

### Subscription Debouncing

```typescript
// Debounce frequent updates
class DebouncedPublisher {
  private timeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    private pubsub: PubSubService,
    private delay: number = 100,
  ) {}

  publish(key: string, triggerName: string, payload: any): void {
    // Clear existing timeout
    const existing = this.timeouts.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      this.pubsub.publish(triggerName, payload);
      this.timeouts.delete(key);
    }, this.delay);

    this.timeouts.set(key, timeout);
  }
}
```

### Subscription Filtering

```typescript
// Server-side filtering to reduce network traffic
@Subscription(() => Activity, {
  filter: (payload, variables, context) => {
    const activity = payload.activityCreated;

    // Early return for system activities
    if (activity.type === 'SYSTEM' && !variables.includeSystem) {
      return false;
    }

    // Filter by entity
    if (variables.entityId && activity.entityId !== variables.entityId) {
      return false;
    }

    // Filter by date range
    if (variables.after && activity.createdAt < variables.after) {
      return false;
    }

    return true;
  },
})
activityCreated(
  @Args('workspaceId') workspaceId: string,
  @Args('entityId', { nullable: true }) entityId?: string,
  @Args('includeSystem', { nullable: true }) includeSystem?: boolean,
  @Args('after', { nullable: true }) after?: Date,
) {
  return this.pubsub.asyncIterator(`activity.created.${workspaceId}`);
}
```

### Connection Management

```typescript
// Track and limit connections per user
@Injectable()
export class ConnectionManager {
  private connections = new Map<string, Set<string>>();
  private readonly MAX_CONNECTIONS_PER_USER = 5;

  addConnection(userId: string, connectionId: string): boolean {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }

    const userConnections = this.connections.get(userId)!;

    if (userConnections.size >= this.MAX_CONNECTIONS_PER_USER) {
      return false; // Limit reached
    }

    userConnections.add(connectionId);
    return true;
  }

  removeConnection(userId: string, connectionId: string): void {
    const userConnections = this.connections.get(userId);
    if (userConnections) {
      userConnections.delete(connectionId);
      if (userConnections.size === 0) {
        this.connections.delete(userId);
      }
    }
  }

  getConnectionCount(userId: string): number {
    return this.connections.get(userId)?.size || 0;
  }
}
```

## Error Handling

### Subscription Errors

```typescript
// Graceful error handling in subscriptions
@Subscription(() => Contact, {
  resolve: async (payload, args, context, info) => {
    try {
      const contact = payload.contactCreated;

      // Enrich with additional data
      contact.enrichmentData = await this.enrichmentService
        .getEnrichmentData(contact.id)
        .catch(() => null); // Don't fail subscription on enrichment error

      return contact;
    } catch (error) {
      // Log error but don't throw
      this.logger.error('Subscription resolve error', error);

      // Return payload without enrichment
      return payload.contactCreated;
    }
  },
})
```

### Client Reconnection

```typescript
// Automatic reconnection with exponential backoff
const wsClient = createClient({
  url: WS_URL,
  shouldRetry: (errOrCloseEvent) => {
    // Retry on any error except auth failures
    return !errOrCloseEvent.message?.includes("Unauthorized");
  },
  retryAttempts: Infinity,
  retryWait: async (retries) => {
    // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
    const delay = Math.min(Math.pow(2, retries) * 1000, 30000);
    await new Promise((resolve) => setTimeout(resolve, delay));
  },
  on: {
    connected: () => console.log("WebSocket connected"),
    error: (err) => console.error("WebSocket error:", err),
    closed: (event) => console.log("WebSocket closed:", event),
  },
});
```

## Monitoring

### Subscription Metrics

```typescript
// Track subscription metrics
@Injectable()
export class SubscriptionMetrics {
  private metrics = {
    activeSubscriptions: new Map<string, number>(),
    subscriptionDuration: new Map<string, number[]>(),
    errorCount: new Map<string, number>(),
  };

  trackSubscription(name: string, connectionId: string): () => void {
    const startTime = Date.now();

    // Increment active count
    const current = this.metrics.activeSubscriptions.get(name) || 0;
    this.metrics.activeSubscriptions.set(name, current + 1);

    // Return cleanup function
    return () => {
      // Decrement active count
      const count = this.metrics.activeSubscriptions.get(name) || 0;
      this.metrics.activeSubscriptions.set(name, Math.max(0, count - 1));

      // Track duration
      const duration = Date.now() - startTime;
      const durations = this.metrics.subscriptionDuration.get(name) || [];
      durations.push(duration);
      this.metrics.subscriptionDuration.set(name, durations);
    };
  }

  getMetrics() {
    return {
      activeSubscriptions: Object.fromEntries(this.metrics.activeSubscriptions),
      averageDuration: Object.fromEntries(
        Array.from(this.metrics.subscriptionDuration.entries()).map(
          ([name, durations]) => [
            name,
            durations.reduce((a, b) => a + b, 0) / durations.length,
          ],
        ),
      ),
      errorCount: Object.fromEntries(this.metrics.errorCount),
    };
  }
}
```
