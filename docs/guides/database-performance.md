# Database Performance Guide

## Overview

This guide provides best practices and strategies for optimizing database performance in the hasteCRM platform.

> **Note**: See [MASTER-CONFIG.md](../MASTER-CONFIG.md) for database version and configuration standards.

## Performance Optimization Strategies

### 1. Query Optimization

#### Use Proper Indexes
```sql
-- Composite index for common query patterns
CREATE INDEX idx_contacts_workspace_created 
ON contacts(workspace_id, created_at DESC);

-- Covering index to avoid table lookups
CREATE INDEX idx_emails_user_date_subject 
ON emails(user_id, sent_at DESC) 
INCLUDE (subject, from_email);
```

#### Query Analysis
```sql
-- Analyze query performance
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM contacts 
WHERE workspace_id = ? 
ORDER BY created_at DESC 
LIMIT 20;
```

### 2. Connection Pooling

Configure connection pools based on environment:

```typescript
// Production configuration
const poolConfig = {
  min: 20,      // Minimum connections
  max: 100,     // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  statementTimeout: 60000,
};
```

### 3. Caching Strategy

#### Query Result Caching
```typescript
// Cache frequently accessed data
const cacheKey = `contacts:${workspaceId}:page:${page}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

const result = await prisma.contact.findMany({
  where: { workspaceId },
  take: 20,
  skip: (page - 1) * 20,
});

await redis.setex(cacheKey, 300, JSON.stringify(result));
```

#### Materialized Views
```sql
-- Create materialized view for analytics
CREATE MATERIALIZED VIEW contact_stats AS
SELECT 
  workspace_id,
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as new_contacts,
  COUNT(CASE WHEN email_verified THEN 1 END) as verified
FROM contacts
GROUP BY workspace_id, date;

-- Refresh periodically
REFRESH MATERIALIZED VIEW CONCURRENTLY contact_stats;
```

### 4. Partitioning Strategy

#### Time-based Partitioning
```sql
-- Partition large tables by date
CREATE TABLE emails (
  id UUID,
  workspace_id UUID,
  sent_at TIMESTAMPTZ,
  -- other columns
) PARTITION BY RANGE (sent_at);

-- Create monthly partitions
CREATE TABLE emails_2024_01 
PARTITION OF emails 
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### 5. Database Maintenance

#### Autovacuum Configuration
```sql
-- Configure for high-write tables
ALTER TABLE emails SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);
```

#### Regular Maintenance Tasks
```bash
# Weekly maintenance script
#!/bin/bash

# Update statistics
psql -c "ANALYZE;"

# Reindex bloated indexes
psql -c "REINDEX INDEX CONCURRENTLY idx_contacts_email;"

# Clean up old partitions
psql -c "DROP TABLE IF EXISTS emails_2023_01;"
```

## Performance Monitoring

### 1. Key Metrics to Track

```sql
-- Slow query log
SELECT 
  query,
  calls,
  mean_exec_time,
  total_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC;

-- Table bloat
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  n_dead_tup,
  n_live_tup
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC;
```

### 2. Performance Dashboards

Configure monitoring for:
- Query response times (p50, p95, p99)
- Connection pool usage
- Cache hit rates
- Lock waits
- Replication lag

## Common Performance Issues

### 1. N+1 Queries
```typescript
// Bad: N+1 query
const workspaces = await prisma.workspace.findMany();
for (const workspace of workspaces) {
  const users = await prisma.user.findMany({
    where: { workspaceId: workspace.id }
  });
}

// Good: Single query with join
const workspaces = await prisma.workspace.findMany({
  include: { users: true }
});
```

### 2. Lock Contention
```sql
-- Identify blocking queries
SELECT 
  blocked_locks.pid AS blocked_pid,
  blocking_locks.pid AS blocking_pid,
  blocked_activity.query AS blocked_query,
  blocking_activity.query AS blocking_query
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_locks blocking_locks 
  ON blocking_locks.locktype = blocked_locks.locktype
WHERE NOT blocked_locks.granted;
```

### 3. Memory Issues
```sql
-- Check memory usage
SELECT 
  name,
  setting,
  unit,
  short_desc
FROM pg_settings
WHERE name IN (
  'shared_buffers',
  'work_mem',
  'maintenance_work_mem',
  'effective_cache_size'
);
```

## Best Practices

1. **Use Read Replicas**: Offload read queries to replicas
2. **Batch Operations**: Group inserts/updates when possible
3. **Async Processing**: Move heavy operations to background jobs
4. **Monitor Actively**: Set up alerts for performance degradation
5. **Plan Capacity**: Scale before hitting limits

## Related Documentation
- [Database Schema](../architecture/database-schema.md)
- [Architecture Overview](../architecture/overview.md)
- [Monitoring Guide](../deployment/monitoring.md)