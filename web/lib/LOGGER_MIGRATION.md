# Logger Migration Guide

## Overview

This guide documents the migration from console.log/console.error to the structured logger utility.

**Status:** 10 console statements replaced in `/lib/search.ts`. 578 remaining across the codebase (588 total originally).

## The Logger Utility

Location: `/web/lib/logger.ts`

### Features

1. **Environment-aware**: In development, logs to console with nice formatting. In production, suppresses debug logs but keeps errors.
2. **Structured logging**: Includes timestamps, log levels, and component context.
3. **Extensible**: Easy to add external error tracking (e.g., Sentry) in production.
4. **Type-safe**: Full TypeScript support with LogContext interface.

### Log Levels

- **debug**: Verbose info only shown in development (useful for debugging logic)
- **info**: General informational messages (shown in development)
- **warn**: Warnings that don't break functionality (shown everywhere)
- **error**: Errors that require attention (shown everywhere, can be sent to Sentry)

## Usage Patterns

### Basic Usage

```typescript
import { logger } from "@/lib/logger";

// Simple message
logger.debug("Fetching events");
logger.info("User logged in");
logger.warn("Cache miss, fetching from database");
logger.error("Failed to save event", error);

// With context
logger.error("Failed to fetch portal source access", error, { portalId });
logger.warn("Invalid cursor provided", { cursor, page });
logger.info("Cache hit", { key: "events:123", ttl: 30000 });
```

### Creating a Component-Scoped Logger

For files with multiple log statements, create a logger with a fixed component name:

```typescript
import { createLogger } from "@/lib/logger";

const logger = createLogger("search"); // Component name

// Now all logs include [search] prefix
logger.error("Failed to fetch events", error, { filters });
logger.warn("Empty result set", { venueId });
logger.debug("Query built", { sql: query.toString() });
```

## Migration Examples

### Example 1: Simple Error Log

```typescript
// BEFORE
console.error("Error fetching categories:", error);

// AFTER
logger.error("Failed to fetch categories", error);
```

### Example 2: Error with Context

```typescript
// BEFORE
console.error("Error fetching portal source access:", error);

// AFTER
logger.error("Failed to fetch portal source access", error, { portalId });
```

### Example 3: Warning

```typescript
// BEFORE
console.warn("Invalid cursor provided, starting from beginning");

// AFTER
logger.warn("Invalid cursor provided, starting from beginning", { cursor });
```

### Example 4: Debug Info

```typescript
// BEFORE
console.log("Fetching events with filters:", filters);

// AFTER
logger.debug("Fetching events", { filters });
```

### Example 5: API Route

```typescript
// BEFORE
export async function GET(request: Request) {
  try {
    const data = await fetchData();
    console.log("Fetched data:", data);
    return Response.json(data);
  } catch (error) {
    console.error("Error in GET /api/events:", error);
    return errorResponse(error, "GET /api/events");
  }
}

// AFTER
import { createLogger } from "@/lib/logger";

const logger = createLogger("api/events");

export async function GET(request: Request) {
  try {
    const data = await fetchData();
    logger.debug("Fetched data", { count: data.length });
    return Response.json(data);
  } catch (error) {
    logger.error("Failed to fetch events", error);
    return errorResponse(error, "GET /api/events");
  }
}
```

## Migration Strategy

### Phase 1: High-Impact Files (Completed)
- ✅ `/lib/search.ts` - 10 replacements

### Phase 2: Core Library Files (Next)
Priority files with frequent errors:
- `/lib/venue-tags.ts` (14 statements)
- `/lib/unified-search.ts` (12 statements)
- `/lib/spots.ts` (7 statements)
- `/lib/federation.ts` (5 statements)
- `/lib/venue-auto-approve.ts` (5 statements)
- `/lib/supabase/server.ts`
- `/lib/supabase/client.ts`
- `/lib/api-utils.ts`
- `/lib/hooks/useAuthenticatedFetch.ts`

### Phase 3: API Routes
Replace in all `/app/api/*/route.ts` files (by priority):
- `/app/api/feed/route.ts` (10 statements)
- `/app/api/friend-requests/[id]/route.ts` (7 statements)
- `/app/api/rsvp/route.ts` (6 statements)
- `/app/api/recommend/route.ts` (6 statements)
- `/app/api/lists/[id]/route.ts` (6 statements)
- `/app/api/auth/profile/route.ts` (6 statements)
- `/app/api/saved/route.ts` (5 statements)
- `/app/api/onboarding/complete/route.ts` (5 statements)
- `/app/api/lists/route.ts` (5 statements)
- `/app/api/follow/route.ts` (5 statements)
- All other API routes

### Phase 4: Components
Replace in components with error handling (by priority):
- `/components/RecommendButton.tsx` (5 statements)
- `/components/feed/ForYouFeed.tsx` (5 statements)
- `/components/community/ListDetailView.tsx` (5 statements)
- `/components/EventCard.tsx`
- `/components/SearchOverlay.tsx`
- `/components/VenueAutocomplete.tsx`
- All other components with console statements

### Phase 5: Scripts and Test Files (Lower Priority)
These are development/admin tools, can be migrated last:
- `/scripts/create-marietta-portal.ts` (53 statements)
- `/scripts/create-atlanta-families-portal.ts` (49 statements)
- `/app/api/relationships/batch/test-helper.ts` (42 statements)
- `/scripts/seed-staging.ts` (35 statements)
- `/scripts/update-atlanta-families-branding.ts` (21 statements)
- `/scripts/enrich-venue-hours.ts` (21 statements)
- Other scripts and test files

## Finding Console Statements

```bash
# Count total console statements
grep -r "console\\.log\\|console\\.error\\|console\\.warn\\|console\\.info" web/ --include="*.ts" --include="*.tsx" | wc -l

# Find files with most console statements
grep -r "console\\." web/ --include="*.ts" --include="*.tsx" -h | cut -d: -f1 | sort | uniq -c | sort -rn | head -20

# Find all console.error statements
grep -rn "console\\.error" web/ --include="*.ts" --include="*.tsx"
```

## Testing

After migration:

1. **Development Mode**: Ensure logs appear in browser console and terminal
2. **Production Mode**: Verify only errors and warnings appear
3. **Edge Cases**: Test error scenarios to ensure context is captured

## Future Enhancements

### Sentry Integration

To enable Sentry error tracking, uncomment the lines in `logger.error()`:

```typescript
error: (message: string, error?: Error | unknown, context?: LogContext) => {
  console.error(formatMessage("error", message, context), error, context);

  // Enable for production error tracking
  if (!isDev && typeof Sentry !== 'undefined') {
    Sentry.captureException(error, {
      extra: { message, ...context }
    });
  }
},
```

### Structured JSON Logging

For production environments that consume JSON logs (e.g., CloudWatch, Datadog):

```typescript
const formatMessage = (level: LogLevel, message: string, context?: LogContext): string => {
  if (!isDev && process.env.ENABLE_JSON_LOGS === "true") {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      component: context?.component,
      ...context,
    });
  }
  // ... existing formatting
};
```

## Notes

- **Never remove console statements from development-only utilities** like the Design Tester or debug panels
- **Keep console.table()** for data visualization during development
- **Don't log sensitive data** (tokens, passwords, PII) even in development
- **Use logger.debug() liberally** - it's free in production (suppressed)

## Questions?

- Check the logger implementation: `/web/lib/logger.ts`
- Review the example migration: `/web/lib/search.ts`
- Reference the project patterns in `CLAUDE.md`
