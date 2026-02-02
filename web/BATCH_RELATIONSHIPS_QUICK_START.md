# Batch Relationships API - Quick Start Guide

Get relationship statuses for multiple users in a single API call.

## TL;DR

```typescript
import { useBatchRelationships } from '@/lib/hooks/useBatchRelationships';

function MyComponent({ userIds }: { userIds: string[] }) {
  const { relationships, isLoading, isFriend } = useBatchRelationships(userIds);

  if (isLoading) return <div>Loading...</div>;

  return (
    <ul>
      {userIds.map(id => (
        <li key={id}>
          {relationships[id]} {isFriend(id) && '⭐️'}
        </li>
      ))}
    </ul>
  );
}
```

## What It Does

Fetches relationship status between the current user and multiple target users:

- `"friends"` - Mutual friendship
- `"following"` - You follow them
- `"followed_by"` - They follow you
- `"request_sent"` - You sent them a friend request
- `"request_received"` - They sent you a friend request
- `"none"` - No relationship

## Why Use It?

**Before**: 50 users = 50 API calls, 150 database queries
**After**: 50 users = 1 API call, 3 database queries

**50x faster** for displaying user lists with relationship context.

## Installation

No installation needed - already part of the codebase.

## Basic Usage

### 1. Import the Hook

```typescript
import { useBatchRelationships } from '@/lib/hooks/useBatchRelationships';
```

### 2. Use in Component

```typescript
const userIds = ['uuid-1', 'uuid-2', 'uuid-3'];
const { relationships, isLoading } = useBatchRelationships(userIds);
```

### 3. Access Relationships

```typescript
// Get specific relationship
const status = relationships['uuid-1']; // 'friends' | 'following' | etc.

// Or use helper functions
const { isFriend, isFollowing, getRelationship } = useBatchRelationships(userIds);

if (isFriend('uuid-1')) {
  console.log('This user is your friend!');
}
```

## Common Use Cases

### Search Results

```typescript
function UserSearchResults({ users }) {
  const userIds = users.map(u => u.id);
  const { getRelationship } = useBatchRelationships(userIds);

  return users.map(user => (
    <UserCard
      key={user.id}
      user={user}
      status={getRelationship(user.id)}
    />
  ));
}
```

### Event Attendees

```typescript
function EventAttendees({ attendees }) {
  const userIds = attendees.map(a => a.user_id);
  const { isFriend } = useBatchRelationships(userIds);

  const friends = attendees.filter(a => isFriend(a.user_id));
  const others = attendees.filter(a => !isFriend(a.user_id));

  return (
    <>
      <h3>Friends Going ({friends.length})</h3>
      <h3>Others Going ({others.length})</h3>
    </>
  );
}
```

### Friend Lists

```typescript
function FriendsList({ users }) {
  const userIds = users.map(u => u.id);
  const { getRelationship } = useBatchRelationships(userIds);

  return users.map(user => (
    <div key={user.id}>
      {user.name}
      <StatusBadge status={getRelationship(user.id)} />
    </div>
  ));
}
```

## API Reference

### Hook Return Values

```typescript
const {
  // Data
  relationships,        // Record<string, RelationshipStatus>

  // State
  isLoading,           // boolean
  isRefetching,        // boolean
  error,               // string | null

  // Helper functions
  getRelationship,     // (userId: string) => RelationshipStatus
  isFriend,            // (userId: string) => boolean
  isFollowing,         // (userId: string) => boolean
  isFollowedBy,        // (userId: string) => boolean

  // Actions
  refetch,             // () => Promise<void>
} = useBatchRelationships(userIds);
```

### Hook Options

```typescript
useBatchRelationships(userIds, {
  enabled: true,           // Enable/disable query
  staleTime: 30 * 1000,   // Fresh for 30 seconds
  gcTime: 5 * 60 * 1000,  // Cache for 5 minutes
});
```

## Important Notes

### 1. Memoize User IDs

```typescript
// ❌ BAD - Creates new array every render
const { relationships } = useBatchRelationships(users.map(u => u.id));

// ✅ GOOD - Memoized array
const userIds = useMemo(() => users.map(u => u.id), [users]);
const { relationships } = useBatchRelationships(userIds);
```

### 2. Max Batch Size

Maximum 100 user IDs per request. For larger lists, split into chunks:

```typescript
const chunk1 = userIds.slice(0, 100);
const chunk2 = userIds.slice(100, 200);

const { relationships: rel1 } = useBatchRelationships(chunk1);
const { relationships: rel2 } = useBatchRelationships(chunk2);

const allRelationships = { ...rel1, ...rel2 };
```

### 3. Cache Invalidation

After relationship changes, invalidate the cache:

```typescript
import { useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();

// After friend request, accept, unfriend, etc.
queryClient.invalidateQueries({ queryKey: ['relationships', 'batch'] });
```

## Direct API Usage (Without Hook)

If you need to call the API directly:

```typescript
const response = await fetch('/api/relationships/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    userIds: ['uuid-1', 'uuid-2', 'uuid-3']
  })
});

const { relationships } = await response.json();
console.log(relationships['uuid-1']); // 'friends'
```

## TypeScript Types

```typescript
type RelationshipStatus =
  | "none"
  | "friends"
  | "following"
  | "followed_by"
  | "request_sent"
  | "request_received";

type BatchRelationshipsResponse = {
  relationships: Record<string, RelationshipStatus>;
};
```

## Troubleshooting

### Relationships Not Updating

**Solution**: Invalidate cache after mutations:

```typescript
queryClient.invalidateQueries({ queryKey: ['relationships', 'batch'] });
```

### Stale Data

**Solution**: Reduce stale time:

```typescript
useBatchRelationships(userIds, { staleTime: 10 * 1000 }); // 10 seconds
```

### Empty Relationships Object

**Possible causes**:
1. Not authenticated (returns 401)
2. Invalid user IDs (non-UUIDs filtered out)
3. Empty userIds array passed in

**Solution**: Check authentication and validate UUIDs

### Performance Issues

**Solution**:
- Reduce batch size (max 100)
- Memoize userIds array
- Check network tab for duplicate requests

## Performance Tips

1. **Memoize arrays** - Prevent unnecessary refetches
2. **Batch requests** - Combine multiple small requests into one
3. **Prefetch on hover** - Load data before user needs it
4. **Cache aggressively** - 30s stale time is usually fine

## Examples

See `/web/app/api/relationships/batch/EXAMPLES.md` for 8 detailed examples:

1. User Search Results
2. Friends List with Action Buttons
3. Event Attendees with Friend Highlights
4. Mutual Friends Count
5. Bulk Relationship Check (Leaderboards)
6. Direct API Call
7. Server-Side Usage
8. Real-time Updates with Optimistic UI

## Full Documentation

- **Quick Start** - This file
- **README.md** - Complete API documentation
- **EXAMPLES.md** - Real-world usage examples
- **route.test.ts** - Test cases

## Files

```
web/
├── app/api/relationships/batch/
│   ├── route.ts              # API endpoint
│   ├── route.test.ts         # Tests
│   ├── README.md             # Full docs
│   └── EXAMPLES.md           # 8 examples
└── lib/hooks/
    └── useBatchRelationships.ts  # React hook
```

## Questions?

Check the full documentation:
- `/web/app/api/relationships/batch/README.md` - API reference
- `/web/app/api/relationships/batch/EXAMPLES.md` - Usage examples
- `/web/BATCH_RELATIONSHIPS_SUMMARY.md` - Implementation overview

## One-Line Summary

**Get relationship statuses for multiple users in a single, fast API call.**
