# Database Migration Guide

## Overview

This guide covers database migration strategies and best practices for the hasteCRM platform.

## Migration Tools

We use Prisma Migrate for managing database schema changes:

```bash
# Create a new migration
pnpm prisma migrate dev --name add_feature_name

# Apply migrations in production
pnpm prisma migrate deploy

# Reset development database
pnpm prisma migrate reset
```

## Migration Best Practices

### 1. Planning Migrations

- Always review generated SQL before applying
- Consider impact on existing data
- Plan for rollback scenarios
- Test migrations on staging first

### 2. Writing Safe Migrations

```sql
-- Add columns with defaults for existing rows
ALTER TABLE contacts
ADD COLUMN score INTEGER DEFAULT 0;

-- Create indexes concurrently in production
CREATE INDEX CONCURRENTLY idx_contacts_score
ON contacts(score);
```

### 3. Data Migrations

```typescript
// packages/database/migrations/20240115_update_contact_scores.ts
import { PrismaClient } from "@prisma/client";

export async function up(prisma: PrismaClient) {
  await prisma.$executeRaw`
    UPDATE contacts 
    SET score = calculate_score(data)
    WHERE score IS NULL
  `;
}

export async function down(prisma: PrismaClient) {
  await prisma.$executeRaw`
    UPDATE contacts SET score = NULL
  `;
}
```

## Migration Workflow

### Development

1. Make schema changes in `schema.prisma`
2. Run `pnpm prisma migrate dev`
3. Test thoroughly
4. Commit migration files

### Staging

1. Deploy code with migration files
2. Run `pnpm prisma migrate deploy`
3. Verify application functionality
4. Monitor for issues

### Production

1. Schedule maintenance window if needed
2. Backup database
3. Deploy and run migrations
4. Verify and monitor

## Common Patterns

### Adding Indexes

```sql
-- Add index for frequently queried columns
CREATE INDEX idx_contacts_workspace_email
ON contacts(workspace_id, email);

-- Partial indexes for specific conditions
CREATE INDEX idx_active_deals
ON deals(workspace_id, stage)
WHERE closed_at IS NULL;
```

### Renaming Columns

```sql
-- Step 1: Add new column
ALTER TABLE contacts ADD COLUMN full_name TEXT;

-- Step 2: Copy data
UPDATE contacts SET full_name = name;

-- Step 3: Drop old column (in next release)
ALTER TABLE contacts DROP COLUMN name;
```

### Adding Constraints

```sql
-- Add foreign key constraint
ALTER TABLE contacts
ADD CONSTRAINT fk_contacts_workspace
FOREIGN KEY (workspace_id)
REFERENCES workspaces(id)
ON DELETE CASCADE;

-- Add check constraint
ALTER TABLE deals
ADD CONSTRAINT check_amount_positive
CHECK (amount >= 0);
```

## Troubleshooting

### Migration Failures

1. Check error logs
2. Verify database connectivity
3. Ensure migrations are idempotent
4. Consider manual intervention

### Performance Issues

- Use `CONCURRENTLY` for index creation
- Batch large data updates
- Consider off-peak hours
- Monitor database metrics

## Related Documentation

- [Database Schema](../architecture/database-schema.md)
- [Development Setup](./setup.md)
- [Deployment Guide](../deployment/)
