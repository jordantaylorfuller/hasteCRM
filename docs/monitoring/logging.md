# Centralized Logging with ELK Stack

## Overview

hasteCRM uses the ELK (Elasticsearch, Logstash, Kibana) stack for centralized logging, providing:

- Structured logging from all services
- Real-time log aggregation and search
- Log visualization and dashboards
- Alert configuration for errors and anomalies
- Long-term log retention and analysis

## Architecture

```
┌─────────────┐     ┌──────────┐     ┌──────────────┐     ┌────────┐
│ Application │────▶│ Filebeat │────▶│   Logstash   │────▶│ Elastic│
│    Logs     │     └──────────┘     │  Processing  │     │ Search │
└─────────────┘                      └──────────────┘     └────────┘
                                              │                 │
┌─────────────┐                              │                 │
│   Docker    │──────────────────────────────┘                 │
│ Container   │                                                 │
│    Logs     │                                                 │
└─────────────┘                                                 │
                                                               ▼
                                                         ┌─────────┐
                                                         │ Kibana  │
                                                         │   UI    │
                                                         └─────────┘
```

## Quick Start

### 1. Start the ELK Stack

```bash
# Start the logging infrastructure
docker-compose -f docker-compose.logging.yml up -d

# Wait for Elasticsearch to be healthy
docker-compose -f docker-compose.logging.yml ps

# Check logs
docker-compose -f docker-compose.logging.yml logs -f
```

### 2. Access Kibana

Open http://localhost:5601 in your browser.

### 3. Configure Index Patterns

1. Go to Stack Management → Index Patterns
2. Create pattern: `hastecrm-*`
3. Select `@timestamp` as time field
4. Save the pattern

## Log Structure

### Application Logs

All application logs follow a structured format:

```json
{
  "@timestamp": "2024-01-15T10:30:45.123Z",
  "level": "info",
  "service": "haste-api",
  "context": "AuthService",
  "message": "User authenticated successfully",
  "userId": "user123",
  "request": {
    "method": "POST",
    "url": "/auth/login",
    "ip": "192.168.1.100"
  }
}
```

### Log Levels

- **ERROR**: Application errors requiring immediate attention
- **WARN**: Warning conditions that should be reviewed
- **INFO**: General informational messages
- **DEBUG**: Detailed debugging information
- **VERBOSE**: Very detailed trace information

## Logging Best Practices

### 1. Use Structured Logging

```typescript
// Good
logger.info("User action", {
  action: "profile_update",
  userId: user.id,
  changes: ["email", "name"],
});

// Bad
logger.info(`User ${user.id} updated profile`);
```

### 2. Include Context

```typescript
// Include relevant context
logger.error("Database query failed", {
  query: "SELECT * FROM users WHERE id = ?",
  params: [userId],
  error: error.message,
  duration: queryTime,
});
```

### 3. Sanitize Sensitive Data

```typescript
// The logger automatically sanitizes sensitive fields
logger.info("User login", {
  email: user.email,
  password: "[REDACTED]", // Automatically done
});
```

### 4. Use Appropriate Log Levels

```typescript
// ERROR - For actual errors
logger.error("Payment processing failed", { error });

// WARN - For warning conditions
logger.warn("Rate limit approaching", { usage: 95 });

// INFO - For important events
logger.info("Order completed", { orderId });

// DEBUG - For debugging
logger.debug("Cache miss", { key });
```

## Common Queries in Kibana

### Find All Errors

```
level: "error" OR severity: "error"
```

### Find Slow Database Queries

```
database.duration: >1000
```

### Find Failed GraphQL Operations

```
graphql.operationName: * AND error.message: *
```

### Find Security Events

```
security.event: *
```

### Find Requests by User

```
userId: "user123" OR request.userId: "user123"
```

## Creating Dashboards

### 1. Error Dashboard

Create visualizations for:

- Error rate over time
- Top error messages
- Errors by service
- Error distribution by type

### 2. Performance Dashboard

Create visualizations for:

- Response time percentiles
- Slow queries
- API endpoint performance
- Database query performance

### 3. Security Dashboard

Create visualizations for:

- Failed login attempts
- Suspicious activities
- Access patterns
- Security events

## Log Retention

Logs are retained according to the following policy:

- **Hot tier** (0-7 days): All logs, fully searchable
- **Warm tier** (7-30 days): All logs, reduced search performance
- **Cold tier** (30-90 days): Compressed, infrequent access
- **Frozen tier** (90+ days): Archived to S3

## Alerting

### Configure Alerts in Kibana

1. Go to Stack Management → Watcher
2. Create new alert
3. Define conditions (e.g., error rate > threshold)
4. Configure actions (email, Slack, webhook)

### Example Alert Conditions

- Error rate exceeds 1% of requests
- Database query time exceeds 5 seconds
- Failed login attempts from same IP > 10
- Memory usage exceeds 90%

## Troubleshooting

### Elasticsearch Not Starting

```bash
# Check Elasticsearch logs
docker logs crm-elasticsearch

# Common issue: insufficient memory
# Solution: Increase Docker memory allocation
```

### Logstash Pipeline Errors

```bash
# Check Logstash configuration
docker exec crm-logstash logstash --config.test_and_exit

# View pipeline statistics
curl -XGET 'localhost:9600/_node/stats/pipelines?pretty'
```

### Missing Logs

1. Check Filebeat is running:

   ```bash
   docker logs crm-filebeat
   ```

2. Verify log paths in filebeat.yml

3. Check Logstash is receiving data:
   ```bash
   docker logs crm-logstash | grep "Received"
   ```

### Performance Issues

1. Check Elasticsearch heap size
2. Optimize index settings
3. Implement index lifecycle management
4. Use appropriate shard counts

## Integration with Application

### NestJS Integration

```typescript
import { CustomLoggerService } from "./common/logger/logger.service";

@Injectable()
export class MyService {
  constructor(private logger: CustomLoggerService) {}

  async performAction() {
    this.logger.log("Starting action", "MyService");

    try {
      // Your code here
      this.logger.log("Action completed", "MyService");
    } catch (error) {
      this.logger.error("Action failed", error.stack, "MyService");
      throw error;
    }
  }
}
```

### GraphQL Logging

```typescript
// Automatically logs all GraphQL operations
@Plugin()
export class LoggingPlugin implements ApolloServerPlugin {
  constructor(private logger: CustomLoggerService) {}

  async requestDidStart() {
    return {
      async willSendResponse(requestContext) {
        const { operationName, query, variables } = requestContext.request;
        const { errors } = requestContext.response;

        this.logger.logGraphQL(
          operationName,
          query,
          variables,
          requestContext.context,
          Date.now() - requestContext.request.startTime,
          errors?.[0],
        );
      },
    };
  }
}
```

## Security Considerations

1. **Access Control**: Restrict access to Kibana using authentication
2. **Log Sanitization**: Never log passwords, tokens, or sensitive data
3. **Network Security**: Use internal networks for log transmission
4. **Audit Logging**: Enable audit logging for compliance
5. **Encryption**: Use TLS for log transmission in production

## Next Steps

1. Configure index lifecycle management
2. Set up alerting rules
3. Create custom dashboards
4. Integrate with monitoring tools
5. Implement log-based metrics
