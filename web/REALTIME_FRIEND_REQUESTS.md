# Realtime Friend Requests Implementation

## Summary

Added Supabase Realtime subscription for friend requests so users see new requests instantly without refreshing the page.

## Changes Made

### 1. New Hook: `useRealtimeFriendRequests`

**Location:** `web/lib/hooks/useRealtimeFriendRequests.ts`

**Features:**
- Subscribes to INSERT, UPDATE, and DELETE events on the `friend_requests` table
- Filters for rows where `invitee_id = current user's ID`
- Automatically updates TanStack Query cache when events occur
- Provides `pendingCount` for use in navigation badges
- Cleans up subscription on unmount
- Updates both "received" and "all" query caches for consistency

**Usage:**
```typescript
const { pendingCount } = useRealtimeFriendRequests();
```

**Event Handlers:**
- **INSERT**: Fetches full request with inviter profile, adds to cache
- **UPDATE**: Updates request status in cache (pending → accepted/declined)
- **DELETE**: Removes request from cache

### 2. Updated Component: `PendingRequests`

**Location:** `web/components/community/PendingRequests.tsx`

**Changes:**
- Removed `onRequestHandled` prop (no longer needed)
- Added `useRealtimeFriendRequests()` call to enable real-time updates
- Replaced manual fetch calls with TanStack Query mutations
- Added optimistic updates for accept/decline actions
- Automatic rollback on error
- Invalidates queries after mutations to ensure consistency

**Before:**
```typescript
interface PendingRequestsProps {
  requests: FriendRequest[];
  onRequestHandled: () => void; // Manual refetch
}
```

**After:**
```typescript
interface PendingRequestsProps {
  requests: FriendRequest[];
  // No manual refetch needed - realtime updates handle it
}
```

### 3. Updated Component: `DashboardActivity`

**Location:** `web/components/dashboard/DashboardActivity.tsx`

**Changes:**
- Removed `refetchRequests` from `useFriendRequests` destructuring (unused)
- Removed `onRequestHandled` prop from `<PendingRequests>` call
- Friend requests now update automatically via realtime subscription

## How It Works

### Flow Diagram

```
User A sends friend request to User B
           ↓
Database INSERT on friend_requests table
           ↓
Supabase Realtime broadcasts INSERT event
           ↓
User B's browser receives event (filtered by invitee_id)
           ↓
useRealtimeFriendRequests hook processes event
           ↓
Fetches full request with inviter profile
           ↓
Updates TanStack Query cache
           ↓
PendingRequests component re-renders
           ↓
User B sees new request instantly!
```

### Cache Management

The hook updates multiple query cache keys to ensure consistency:

1. **`["friend-requests", "received"]`** - Primary cache for received requests
2. **`["friend-requests", "all"]`** - Secondary cache if user is viewing all requests
3. Invalidates all `friend-requests` queries after updates

### Optimistic Updates

When User B accepts/declines a request:

1. **Optimistic update** - UI updates immediately (request marked as accepted/declined)
2. **API call** - Request sent to server
3. **Success** - Toast notification shown
4. **Error** - Rollback to previous state, show error toast

## Integration Points

### Where to Use `pendingCount`

The `pendingCount` returned by `useRealtimeFriendRequests()` can be used in:

- **Navigation badges** - Show count in header/sidebar
- **Notification bell** - Display pending request count
- **Mobile bottom nav** - Badge on community/friends icon

Example:
```typescript
function NavBar() {
  const { pendingCount } = useRealtimeFriendRequests();
  
  return (
    <Link href="/notifications">
      Friends
      {pendingCount > 0 && <Badge>{pendingCount}</Badge>}
    </Link>
  );
}
```

### Existing Pages Using Friend Requests

1. **`/app/notifications/page.tsx`** - Could benefit from real-time updates
2. **`/components/dashboard/DashboardActivity.tsx`** - Already integrated ✓

## Technical Details

### Supabase Realtime Pattern

```typescript
supabase
  .channel('friend-requests')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'friend_requests',
    filter: `invitee_id=eq.${userId}`
  }, callback)
  .subscribe()
```

### Query Cache Keys

- `["friend-requests", "received"]` - Requests where current user is invitee
- `["friend-requests", "sent"]` - Requests where current user is inviter
- `["friend-requests", "all"]` - All requests involving current user

### Cleanup

The hook properly cleans up the Supabase channel on unmount:

```typescript
return () => {
  if (channelRef.current) {
    supabase.removeChannel(channelRef.current);
  }
};
```

## Testing

### Manual Testing Steps

1. Open two browser windows/tabs
2. Sign in as User A in window 1
3. Sign in as User B in window 2
4. Navigate User B to dashboard (community view)
5. From User A's profile, send friend request to User B
6. **Expected:** User B's dashboard should show the new request instantly
7. Click "Accept" in User B's window
8. **Expected:** UI updates immediately (optimistic), then toast confirms
9. Check User A's friends list
10. **Expected:** User B should appear as friend

### Edge Cases Handled

- **User not logged in** - Subscription not created
- **Network failure** - Optimistic update rolls back on error
- **Duplicate events** - Filters prevent duplicate requests in cache
- **Stale cache** - Invalidates queries after mutations
- **Component unmount** - Channel cleaned up properly

## Performance Considerations

- **Single subscription per user** - One channel handles all friend request events
- **Filtered at source** - Supabase only sends events where `invitee_id = user.id`
- **Minimal re-renders** - Only updates cache when events occur
- **Debounced invalidation** - TanStack Query handles intelligent refetching

## Future Enhancements

1. **Toast notifications** - Show toast when new request arrives
2. **Sound/vibration** - Optional audio notification
3. **Presence indicators** - Show which friends are online
4. **Typing indicators** - For future chat feature
5. **Read receipts** - Track when user views requests

## Related Files

- `/web/lib/hooks/useFriendRequests.ts` - Base hook for fetching requests
- `/web/lib/hooks/useFriendship.ts` - Hook for managing individual friendships
- `/web/app/api/friend-requests/route.ts` - API endpoint for friend requests
- `/database/migrations/014_friend_requests.sql` - Database schema

## Rollback Instructions

If issues arise, to rollback:

1. Remove `useRealtimeFriendRequests()` call from `PendingRequests.tsx`
2. Add back `onRequestHandled` prop to `PendingRequestsProps`
3. Pass `refetch` from `useFriendRequests` as `onRequestHandled`
4. Optionally delete `useRealtimeFriendRequests.ts` file

The app will continue to work with manual refetching on accept/decline.
