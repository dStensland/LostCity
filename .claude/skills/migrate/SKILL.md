---
description: Create a database migration or schema change
---

# Database Migration

$ARGUMENTS

## Instructions

1. Create migration file in `database/migrations/` with timestamp
2. Include both UP and DOWN migrations
3. Update `database/schema.sql` to reflect changes
4. Consider RLS policies if user data is involved

## Naming

`YYYYMMDD_HHMMSS_description.sql`

## Example
```sql
-- UP
ALTER TABLE events ADD COLUMN priority INTEGER DEFAULT 0;

-- DOWN
ALTER TABLE events DROP COLUMN IF EXISTS priority;
```

## Key Files
- `database/schema.sql` - Core schema
- `database/migrations/` - Migration files
