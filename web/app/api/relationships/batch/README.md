# Batch Relationships API

A high-performance endpoint for fetching relationship statuses for multiple users in a single API call.

## Endpoint

```
POST /api/relationships/batch
```

## Authentication

Requires authentication. Returns `401 Unauthorized` if not authenticated.

## Request

### Body

```typescript
{
  userIds: string[]  // Array of user IDs (UUIDs) to check relationships for
}
```

### Constraints

- **Max batch size**: 100 user IDs per request
- **User ID format**: Valid UUIDs only
- Invalid IDs are silently filtered out
- Duplicate IDs are automatically removed
- Current user's ID is automatically excluded

### Example

```typescript
const response = await fetch('/api/relationships/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    userIds: [
      '123e4567-e89b-12d3-a456-426614174001',
      '123e4567-e89b-12d3-a456-426614174002',
      '123e4567-e89b-12d3-a456-426614174003'
    ]
  })
});

const data = await response.json();
```

## Response

### Success Response

```typescript
{
  relationships: Record<string, RelationshipStatus>
}
```

Where `RelationshipStatus` is one of:
- `"none"` - No relationship exists
- `"friends"` - Mutual friendship
- `"following"` - Current user follows the target user
- `"followed_by"` - Target user follows current user
- `"request_sent"` - Current user sent a pending friend request
- `"request_received"` - Current user received a pending friend request

### Example Response

```json
{
  "relationships": {
    "123e4567-e89b-12d3-a456-426614174001": "friends",
    "123e4567-e89b-12d3-a456-426614174002": "request_sent",
    "123e4567-e89b-12d3-a456-426614174003": "following"
  }
}
```

### Error Responses

#### 400 Bad Request

```json
{
  "error": "userIds must be an array"
}
```

```json
{
  "error": "Maximum 100 user IDs allowed per request"
}
```

#### 401 Unauthorized

```json
{
  "error": "Unauthorized"
}
```

#### 500 Internal Server Error

```json
{
  "error": "An internal error occurred"
}
```

## Relationship Priority

When multiple relationship types exist between two users, the endpoint returns the highest priority status:

1. **friends** (highest priority)
2. **request_sent** / **request_received**
3. **following** / **followed_by**
4. **none** (lowest priority)

Example: If two users are friends AND following each other, the status returned is `"friends"`.

## Performance

### Database Queries

The endpoint makes exactly **3 database queries**, regardless of batch size:

1. **Friendships query**: Single OR query for all user pairs
2. **Follows query**: Single OR query for all user pairs
3. **Friend requests query**: Single OR query for all pending requests

No N+1 queries. Optimized for batch operations.

### Recommended Usage

- Use for displaying relationship status in lists (user lists, search results, etc.)
- Batch requests when possible instead of individual calls
- Cache results using TanStack Query or similar
- Memoize user ID arrays to prevent unnecessary refetches

### Anti-patterns

❌ **Don't**: Make individual API calls for each user

```typescript
// BAD - N API calls
for (const userId of userIds) {
  const res = await fetch(`/api/users/${userId}`);
  // ...
}
```

✅ **Do**: Use batch endpoint

```typescript
// GOOD - 1 API call
const res = await fetch('/api/relationships/batch', {
  method: 'POST',
  body: JSON.stringify({ userIds })
});
```

## React Hook

A React hook is available for easy integration with TanStack Query:

```typescript
import { useBatchRelationships } from '@/lib/hooks/useBatchRelationships';

function UserList({ userIds }: { userIds: string[] }) {
  const {
    relationships,
    isLoading,
    getRelationship,
    isFriend,
    isFollowing
  } = useBatchRelationships(userIds);

  if (isLoading) return <div>Loading...</div>;

  return (
    <ul>
      {userIds.map(userId => (
        <li key={userId}>
          Status: {getRelationship(userId)}
          {isFriend(userId) && ' (Friend)'}
        </li>
      ))}
    </ul>
  );
}
```

### Hook Features

- Automatic caching and deduplication
- Cache keys based on sorted user IDs (order-independent)
- Helper functions (`getRelationship`, `isFriend`, `isFollowing`, `isFollowedBy`)
- Configurable stale time and garbage collection
- Type-safe return values

### Hook Options

```typescript
const result = useBatchRelationships(userIds, {
  enabled: true,           // Enable/disable query
  staleTime: 30 * 1000,   // Consider fresh for 30s
  gcTime: 5 * 60 * 1000,  // Keep in cache for 5min
});
```

## Database Schema

### Tables Used

1. **friendships** - Explicit friend relationships
   - Canonical ordering: `user_a_id < user_b_id`
   - Unique constraint on `(user_a_id, user_b_id)`

2. **follows** - One-way follow relationships
   - Columns: `follower_id`, `followed_user_id`

3. **friend_requests** - Pending friend requests
   - Columns: `inviter_id`, `invitee_id`, `status`
   - Only queries `status = 'pending'`

### RPC Functions Used

- `are_friends(user_a, user_b)` - Not used (direct table query is faster for batch)

## Caching Strategy

### Client-side Caching

The React hook caches results for 30 seconds by default. This prevents redundant API calls when:

- Navigating between pages
- Scrolling through lists
- Refreshing components

### Cache Invalidation

Invalidate the cache after relationship changes:

```typescript
import { useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();

// After sending friend request, accepting, etc.
queryClient.invalidateQueries({ queryKey: ['relationships', 'batch'] });
```

## Testing

See `route.test.ts` for test examples and expected behavior.

### Manual Testing

```bash
# 1. Get auth token (login via UI or auth API)

# 2. Test batch endpoint
curl -X POST http://localhost:3000/api/relationships/batch \
  -H "Content-Type: application/json" \
  -H "Cookie: sb-xxx-auth-token=..." \
  -d '{
    "userIds": [
      "123e4567-e89b-12d3-a456-426614174001",
      "123e4567-e89b-12d3-a456-426614174002"
    ]
  }'
```

## Related Endpoints

- `GET /api/users/[username]` - Single user profile with relationship status
- `GET /api/friend-requests` - List of friend requests
- `POST /api/friend-requests` - Send friend request
- `PATCH /api/friend-requests/[id]` - Accept/decline friend request

## Migration Path

If you're currently using individual user profile fetches for relationship status:

### Before

```typescript
// Multiple API calls
const users = await Promise.all(
  userIds.map(async (id) => {
    const res = await fetch(`/api/users/${id}`);
    const data = await res.json();
    return { id, relationship: data.relationship };
  })
);
```

### After

```typescript
// Single API call
const res = await fetch('/api/relationships/batch', {
  method: 'POST',
  body: JSON.stringify({ userIds })
});
const { relationships } = await res.json();

// Or use the hook
const { relationships } = useBatchRelationships(userIds);
```

## Future Enhancements

Potential improvements for future versions:

- [ ] Add `includeMetadata` option to return request IDs, timestamps, etc.
- [ ] Support fetching relationships between arbitrary user pairs (not just current user)
- [ ] Add Redis caching layer for frequently requested combinations
- [ ] Support pagination for very large batches (>100 users)
- [ ] Add streaming response for real-time updates
- [ ] Include mutual friend counts in response

## Support

For questions or issues, see:
- API route: `/web/app/api/relationships/batch/route.ts`
- React hook: `/web/lib/hooks/useBatchRelationships.ts`
- Tests: `/web/app/api/relationships/batch/route.test.ts`
