# Batch Relationships API - Implementation Summary

A new high-performance API endpoint for fetching relationship statuses for multiple users in a single request.

## What Was Created

### 1. API Route
**File**: `/web/app/api/relationships/batch/route.ts`

A POST endpoint that accepts an array of user IDs and returns their relationship statuses with the current user.

**Key Features**:
- Accepts up to 100 user IDs per request
- Makes only 3 database queries (no N+1 problem)
- Returns standardized relationship status: `"none"` | `"friends"` | `"following"` | `"followed_by"` | `"request_sent"` | `"request_received"`
- Handles edge cases: empty arrays, invalid UUIDs, duplicates, self-references
- Proper authentication and error handling

### 2. React Hook
**File**: `/web/lib/hooks/useBatchRelationships.ts`

A TanStack Query-powered hook for easy client-side usage.

**Key Features**:
- Automatic caching and deduplication
- Cache keys based on sorted user IDs (order-independent)
- Helper functions: `getRelationship()`, `isFriend()`, `isFollowing()`, `isFollowedBy()`
- Configurable stale time and garbage collection
- Type-safe return values

### 3. Documentation
- **README.md** - Complete API documentation with request/response formats
- **EXAMPLES.md** - 8 real-world usage examples
- **route.test.ts** - Test cases and expected behavior

## Request/Response Format

### Request
```typescript
POST /api/relationships/batch

{
  userIds: string[]  // Max 100 UUIDs
}
```

### Response
```typescript
{
  relationships: {
    "user-id-1": "friends",
    "user-id-2": "following",
    "user-id-3": "none"
  }
}
```

## Usage Examples

### With React Hook (Recommended)
```typescript
import { useBatchRelationships } from '@/lib/hooks/useBatchRelationships';

function UserList({ userIds }: { userIds: string[] }) {
  const { relationships, isLoading, isFriend } = useBatchRelationships(userIds);

  if (isLoading) return <div>Loading...</div>;

  return (
    <ul>
      {userIds.map(id => (
        <li key={id}>
          Status: {relationships[id]}
          {isFriend(id) && ' ⭐️'}
        </li>
      ))}
    </ul>
  );
}
```

### Direct API Call
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
console.log(relationships['uuid-1']); // 'friends' | 'following' | etc.
```

## Performance Characteristics

### Database Queries
The endpoint makes exactly **3 queries** regardless of batch size:

1. **Friendships**: Single query with OR condition
   ```sql
   SELECT * FROM friendships
   WHERE user_a_id = ? OR user_b_id = ?
   ```

2. **Follows**: Single query with OR conditions for all user pairs
   ```sql
   SELECT * FROM follows
   WHERE (follower_id = ? AND followed_user_id IN (...))
      OR (follower_id IN (...) AND followed_user_id = ?)
   ```

3. **Friend Requests**: Single query for pending requests
   ```sql
   SELECT * FROM friend_requests
   WHERE status = 'pending'
     AND ((inviter_id = ? AND invitee_id IN (...))
       OR (inviter_id IN (...) AND invitee_id = ?))
   ```

### Comparison: Before vs After

#### Before (Individual Requests)
```typescript
// 50 API calls for 50 users
for (const userId of userIds) {
  const res = await fetch(`/api/users/${userId}`);
  const data = await res.json();
  // Use data.relationship
}

// Result: 50 API calls × 3 DB queries each = 150 total DB queries
```

#### After (Batch Request)
```typescript
// 1 API call for 50 users
const res = await fetch('/api/relationships/batch', {
  method: 'POST',
  body: JSON.stringify({ userIds })
});
const { relationships } = await res.json();

// Result: 1 API call × 3 DB queries = 3 total DB queries
```

**Improvement**: 50x fewer API calls, 50x fewer database queries.

## Relationship Priority

When multiple relationship types exist, the endpoint returns the highest priority:

1. **friends** (highest)
2. **request_sent** / **request_received**
3. **following** / **followed_by**
4. **none** (lowest)

Example: If users are friends AND following each other, returns `"friends"`.

## Use Cases

### 1. User Search Results
Display relationship badges next to each user in search results.

### 2. Event Attendees
Show which attendees are friends, following, or strangers.

### 3. Leaderboards
Add relationship context to leaderboard entries.

### 4. Mutual Friends
Calculate mutual friend counts efficiently.

### 5. Friend Suggestions
Filter and prioritize friend suggestions based on existing relationships.

### 6. Group Member Lists
Show relationship status for all members in a group.

### 7. Message Threads
Display relationship context in messaging interfaces.

### 8. Profile Visitors
Show relationship status for profile visitors.

## Error Handling

### 400 Bad Request
- `userIds` is not an array
- More than 100 user IDs provided

### 401 Unauthorized
- User is not authenticated

### 500 Internal Server Error
- Database query failed
- Unexpected server error

All errors return consistent JSON format:
```json
{ "error": "Error message" }
```

## Security Considerations

1. **Authentication Required**: Endpoint requires valid session
2. **User Privacy**: Only returns relationships for the current user
3. **Rate Limiting**: Use standard API rate limits (100 req/min)
4. **Input Validation**: UUID format validation, max batch size
5. **RLS Compliance**: Uses server-side Supabase client with proper authentication

## Testing

### Manual Testing
```bash
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

### Test Cases
See `route.test.ts` for comprehensive test coverage:
- Empty array handling
- Invalid UUID filtering
- Duplicate removal
- Max batch size validation
- Authentication requirement
- Relationship priority ordering

## Migration Guide

### Existing Code Using Individual Fetches

**Before**:
```typescript
const userData = await Promise.all(
  userIds.map(id => fetch(`/api/users/${id}`).then(r => r.json()))
);
const relationships = userData.map(u => ({
  id: u.profile.id,
  status: u.relationship
}));
```

**After**:
```typescript
const res = await fetch('/api/relationships/batch', {
  method: 'POST',
  body: JSON.stringify({ userIds })
});
const { relationships } = await res.json();
```

### Existing Code Using useFriendship Hook

The `useFriendship` hook is still useful for individual user interactions.

**Use `useBatchRelationships` when**:
- Displaying lists of users (search results, attendees, etc.)
- Need relationship status for 2+ users
- Rendering multiple user cards/avatars

**Use `useFriendship` when**:
- Single user profile page
- Need action methods (sendRequest, acceptRequest, unfriend)
- Need request ID for specific user

## Files Created

```
web/
├── app/api/relationships/batch/
│   ├── route.ts              # Main API endpoint
│   ├── route.test.ts         # Test cases
│   ├── README.md             # API documentation
│   └── EXAMPLES.md           # Usage examples (8 scenarios)
└── lib/hooks/
    └── useBatchRelationships.ts  # React hook
```

## Related Files

### Dependencies
- `/web/lib/supabase/server.ts` - Supabase client
- `/web/lib/hooks/useAuthenticatedFetch.ts` - Auth fetch helper
- `/web/lib/hooks/useFriendship.ts` - Single user relationship hook

### Database Schema
- `/web/supabase/migrations/20260130000001_create_friendships.sql`
  - `friendships` table with canonical ordering
  - `follows` table for one-way relationships
  - `friend_requests` table for pending requests

### Similar Endpoints
- `GET /api/users/[username]` - Single user with relationship
- `GET /api/friend-requests` - Friend request list
- `POST /api/friend-requests` - Send friend request

## Future Enhancements

Potential improvements for v2:

1. **Metadata Option**: Include request IDs, timestamps, mutual friend counts
2. **Arbitrary User Pairs**: Support checking relationships between any two users
3. **Redis Caching**: Add caching layer for frequently requested combinations
4. **Pagination**: Support batches larger than 100 users
5. **Real-time Updates**: WebSocket support for live relationship changes
6. **Bulk Actions**: Combined endpoint for batch status check + batch action

## Performance Benchmarks

Expected performance (estimated):

| User Count | API Calls | DB Queries | Response Time |
|------------|-----------|------------|---------------|
| 1          | 1         | 3          | ~50ms         |
| 10         | 1         | 3          | ~60ms         |
| 50         | 1         | 3          | ~80ms         |
| 100        | 1         | 3          | ~120ms        |

Compare to individual fetches:
- 50 users: 50 API calls, 150 DB queries, ~2500ms total
- Improvement: 50x fewer calls, 97% faster

## Caching Strategy

### Client-side (TanStack Query)
- **Stale time**: 30 seconds (configurable)
- **Cache time**: 5 minutes
- **Cache key**: Sorted user IDs for order-independence
- **Invalidation**: Manual via `invalidateQueries` after mutations

### Server-side
- No server-side caching currently
- Consider Redis for future optimization

### Recommended Invalidation Points
```typescript
// After friend request sent
queryClient.invalidateQueries({ queryKey: ['relationships', 'batch'] });

// After friend request accepted/declined
queryClient.invalidateQueries({ queryKey: ['relationships', 'batch'] });

// After unfriend
queryClient.invalidateQueries({ queryKey: ['relationships', 'batch'] });

// After follow/unfollow
queryClient.invalidateQueries({ queryKey: ['relationships', 'batch'] });
```

## Monitoring & Observability

### Metrics to Track
- Average batch size
- Response time by batch size
- Error rate
- Cache hit rate
- Most common user ID patterns

### Logging
The endpoint logs errors to console. Consider adding:
- Structured logging (JSON format)
- Request duration tracking
- Batch size distribution
- Error categorization

### Example Sentry Integration
```typescript
try {
  // ... endpoint logic
} catch (err) {
  Sentry.captureException(err, {
    tags: { endpoint: 'relationships-batch' },
    extra: { batchSize: userIds.length }
  });
  return NextResponse.json(...);
}
```

## Support & Maintenance

### Key Files to Monitor
1. `route.ts` - Main endpoint logic
2. `useBatchRelationships.ts` - Hook implementation
3. Friendships migration - Database schema

### Common Issues & Solutions

**Issue**: Stale relationship data
**Solution**: Decrease staleTime or invalidate cache after mutations

**Issue**: Slow response for large batches
**Solution**: Reduce batch size or implement pagination

**Issue**: Missing relationships in response
**Solution**: Verify UUIDs are valid, check authentication

**Issue**: Cache not updating after actions
**Solution**: Add invalidateQueries calls after mutations

## Credits

- **Pattern**: Based on existing `/api/users/[username]` endpoint
- **Database**: Uses friendships table with canonical ordering
- **Hook pattern**: Follows `useFriendship` hook conventions
- **Architecture**: Follows LostCity API route patterns

## Questions?

See documentation files:
- `README.md` - Full API reference
- `EXAMPLES.md` - Real-world usage examples
- `route.test.ts` - Test cases and expected behavior

Or check related endpoints:
- `/api/users/[username]` - Single user relationship
- `/api/friend-requests` - Friend request management
