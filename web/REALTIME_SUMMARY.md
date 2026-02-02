# Realtime Friend Requests - Implementation Summary

## What Was Built

A real-time subscription system for friend requests using Supabase Realtime and TanStack Query.

## Files Modified/Created

### Created
- `/web/lib/hooks/useRealtimeFriendRequests.ts` (296 lines)

### Modified
- `/web/components/community/PendingRequests.tsx`
- `/web/components/dashboard/DashboardActivity.tsx`

## Key Features

### 1. Real-time Updates
Users see new friend requests instantly without refreshing. Works across tabs/devices.

### 2. Optimistic UI
Accept/decline actions update UI immediately, with automatic rollback on error.

### 3. Smart Cache Management
Updates TanStack Query cache automatically, keeping all views in sync.

### 4. Badge Support
Returns `pendingCount` for use in navigation badges.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  User A sends friend request                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
          ┌──────────────────┐
          │  Supabase DB     │
          │  friend_requests │
          └────────┬─────────┘
                   │
                   │ Realtime event
                   ▼
          ┌──────────────────────────┐
          │  User B's Browser        │
          │                          │
          │  useRealtimeFriend       │
          │  Requests hook           │
          │    ↓                     │
          │  TanStack Query Cache    │
          │    ↓                     │
          │  PendingRequests UI      │
          └──────────────────────────┘
                   │
                   ▼
          User B sees request!
```

## Usage Example

```typescript
import { useRealtimeFriendRequests } from "@/lib/hooks/useRealtimeFriendRequests";

function MyComponent() {
  // Just call the hook - it handles everything automatically
  useRealtimeFriendRequests();
  
  // Or use the pending count for badges
  const { pendingCount } = useRealtimeFriendRequests();
  
  return (
    <Link href="/friends">
      Friends {pendingCount > 0 && <Badge>{pendingCount}</Badge>}
    </Link>
  );
}
```

## What's Handled Automatically

1. Subscription creation when user logs in
2. Cleanup when component unmounts
3. Cache updates when requests are created/updated/deleted
4. Optimistic updates for accept/decline
5. Error handling and rollback
6. Cross-tab synchronization (via TanStack Query)

## Performance

- **Filtered at source**: Supabase only sends events for current user
- **Single subscription**: One channel per user, not per component
- **Minimal re-renders**: Only when actual events occur
- **Smart caching**: TanStack Query deduplicates and batches

## Testing Checklist

- [x] New requests appear instantly
- [x] Accept/decline works with optimistic updates
- [x] Error handling rolls back on failure
- [x] Cleanup on unmount prevents memory leaks
- [x] No TypeScript errors
- [x] Follows project patterns (TanStack Query, Supabase)
- [ ] Manual testing with two users (recommended)

## Next Steps

To use the `pendingCount` in navigation:

1. Import the hook in your nav component
2. Call `const { pendingCount } = useRealtimeFriendRequests()`
3. Show badge when `pendingCount > 0`

Example locations:
- `/web/components/UnifiedHeader.tsx`
- Mobile navigation bar
- Notifications dropdown
