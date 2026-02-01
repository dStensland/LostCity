# Batch Relationships API - Usage Examples

Practical examples demonstrating how to use the batch relationships API in real-world scenarios.

## Example 1: User Search Results

Display relationship status next to each user in search results.

```typescript
// components/UserSearchResults.tsx
'use client';

import { useBatchRelationships } from '@/lib/hooks/useBatchRelationships';
import { useMemo } from 'react';

type User = {
  id: string;
  username: string;
  avatar_url: string | null;
  display_name: string | null;
};

export function UserSearchResults({ users }: { users: User[] }) {
  // Memoize user IDs to prevent unnecessary refetches
  const userIds = useMemo(() => users.map(u => u.id), [users]);

  const { relationships, isLoading, getRelationship } = useBatchRelationships(userIds);

  return (
    <div className="space-y-4">
      {users.map(user => {
        const status = getRelationship(user.id);

        return (
          <div key={user.id} className="flex items-center justify-between p-4 border rounded">
            <div className="flex items-center gap-3">
              {user.avatar_url && (
                <img
                  src={user.avatar_url}
                  alt={user.username}
                  className="w-12 h-12 rounded-full"
                />
              )}
              <div>
                <div className="font-semibold">
                  {user.display_name || user.username}
                </div>
                <div className="text-sm text-gray-600">@{user.username}</div>
              </div>
            </div>

            <div>
              {isLoading ? (
                <span className="text-sm text-gray-500">Loading...</span>
              ) : (
                <RelationshipBadge status={status} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RelationshipBadge({ status }: { status: string }) {
  const badges = {
    friends: { label: 'Friends', color: 'bg-green-100 text-green-800' },
    following: { label: 'Following', color: 'bg-blue-100 text-blue-800' },
    followed_by: { label: 'Follows you', color: 'bg-purple-100 text-purple-800' },
    request_sent: { label: 'Request sent', color: 'bg-yellow-100 text-yellow-800' },
    request_received: { label: 'Request received', color: 'bg-orange-100 text-orange-800' },
    none: { label: '', color: '' },
  };

  const badge = badges[status as keyof typeof badges] || badges.none;

  if (!badge.label) return null;

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${badge.color}`}>
      {badge.label}
    </span>
  );
}
```

## Example 2: Friends List with Action Buttons

Display friends list with contextual action buttons based on relationship status.

```typescript
// components/FriendsList.tsx
'use client';

import { useBatchRelationships } from '@/lib/hooks/useBatchRelationships';
import { useFriendship } from '@/lib/hooks/useFriendship';
import { useMemo } from 'react';

type Friend = {
  id: string;
  username: string;
  display_name: string | null;
};

export function FriendsList({ friends }: { friends: Friend[] }) {
  const userIds = useMemo(() => friends.map(f => f.id), [friends]);
  const { getRelationship } = useBatchRelationships(userIds);

  return (
    <div className="space-y-2">
      {friends.map(friend => (
        <FriendItem
          key={friend.id}
          friend={friend}
          status={getRelationship(friend.id)}
        />
      ))}
    </div>
  );
}

function FriendItem({ friend, status }: { friend: Friend; status: string }) {
  const {
    sendRequest,
    acceptRequest,
    unfriend,
    isActionLoading
  } = useFriendship(friend.id, friend.username);

  return (
    <div className="flex items-center justify-between p-3 border rounded">
      <div>
        <div className="font-medium">{friend.display_name || friend.username}</div>
        <div className="text-sm text-gray-600">@{friend.username}</div>
      </div>

      <div>
        {status === 'none' && (
          <button
            onClick={sendRequest}
            disabled={isActionLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Add Friend
          </button>
        )}

        {status === 'request_received' && (
          <button
            onClick={acceptRequest}
            disabled={isActionLoading}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Accept Request
          </button>
        )}

        {status === 'request_sent' && (
          <span className="px-4 py-2 text-sm text-gray-600">
            Request Pending
          </span>
        )}

        {status === 'friends' && (
          <button
            onClick={unfriend}
            disabled={isActionLoading}
            className="px-4 py-2 text-red-600 border border-red-600 rounded hover:bg-red-50"
          >
            Unfriend
          </button>
        )}
      </div>
    </div>
  );
}
```

## Example 3: Event Attendees with Friend Highlights

Show which attendees are your friends.

```typescript
// components/EventAttendees.tsx
'use client';

import { useBatchRelationships } from '@/lib/hooks/useBatchRelationships';
import { useMemo } from 'react';

type Attendee = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  rsvp_status: 'going' | 'interested' | 'not_going';
};

export function EventAttendees({ attendees }: { attendees: Attendee[] }) {
  const userIds = useMemo(() => attendees.map(a => a.user_id), [attendees]);
  const { isFriend, isFollowing } = useBatchRelationships(userIds);

  // Separate friends from others
  const friends = attendees.filter(a => isFriend(a.user_id));
  const following = attendees.filter(a => isFollowing(a.user_id) && !isFriend(a.user_id));
  const others = attendees.filter(a => !isFollowing(a.user_id));

  return (
    <div className="space-y-6">
      {friends.length > 0 && (
        <div>
          <h3 className="font-semibold mb-2">Friends Going ({friends.length})</h3>
          <div className="flex -space-x-2">
            {friends.slice(0, 10).map(attendee => (
              <Avatar key={attendee.user_id} attendee={attendee} isFriend />
            ))}
            {friends.length > 10 && (
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm">
                +{friends.length - 10}
              </div>
            )}
          </div>
        </div>
      )}

      {following.length > 0 && (
        <div>
          <h3 className="font-semibold mb-2">Following ({following.length})</h3>
          <div className="flex -space-x-2">
            {following.slice(0, 10).map(attendee => (
              <Avatar key={attendee.user_id} attendee={attendee} />
            ))}
          </div>
        </div>
      )}

      {others.length > 0 && (
        <div>
          <h3 className="font-semibold mb-2">Others Going ({others.length})</h3>
          <div className="grid grid-cols-8 gap-2">
            {others.slice(0, 16).map(attendee => (
              <Avatar key={attendee.user_id} attendee={attendee} small />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Avatar({
  attendee,
  isFriend = false,
  small = false
}: {
  attendee: Attendee;
  isFriend?: boolean;
  small?: boolean;
}) {
  const size = small ? 'w-8 h-8' : 'w-10 h-10';
  const ring = isFriend ? 'ring-2 ring-green-500' : '';

  return (
    <img
      src={attendee.avatar_url || '/default-avatar.png'}
      alt={attendee.username}
      className={`${size} rounded-full ${ring}`}
      title={attendee.username}
    />
  );
}
```

## Example 4: Mutual Friends Count

Calculate and display mutual friends between users.

```typescript
// components/MutualFriendsCount.tsx
'use client';

import { useBatchRelationships } from '@/lib/hooks/useBatchRelationships';
import { useEffect, useState } from 'react';

export function MutualFriendsCount({
  targetUserId,
  targetUsername
}: {
  targetUserId: string;
  targetUsername: string;
}) {
  const [targetFriendIds, setTargetFriendIds] = useState<string[]>([]);

  // Fetch target user's friends
  useEffect(() => {
    fetch(`/api/users/${targetUsername}/friends`)
      .then(res => res.json())
      .then(data => setTargetFriendIds(data.friends?.map((f: any) => f.id) || []))
      .catch(console.error);
  }, [targetUsername]);

  // Get relationship status for all of target's friends
  const { relationships } = useBatchRelationships(targetFriendIds);

  // Count how many of their friends are also your friends
  const mutualCount = Object.values(relationships).filter(
    status => status === 'friends'
  ).length;

  if (mutualCount === 0) return null;

  return (
    <div className="text-sm text-gray-600">
      {mutualCount} mutual friend{mutualCount === 1 ? '' : 's'}
    </div>
  );
}
```

## Example 5: Bulk Relationship Check

Check relationships for a large list of users (e.g., leaderboard, directory).

```typescript
// hooks/useLeaderboardWithRelationships.ts
import { useBatchRelationships } from '@/lib/hooks/useBatchRelationships';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

type LeaderboardEntry = {
  user_id: string;
  username: string;
  score: number;
  rank: number;
};

export function useLeaderboardWithRelationships() {
  // Fetch leaderboard data
  const { data: leaderboard, isLoading: isLoadingLeaderboard } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const res = await fetch('/api/leaderboard');
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      return res.json() as Promise<LeaderboardEntry[]>;
    },
  });

  // Extract user IDs
  const userIds = useMemo(
    () => leaderboard?.map(entry => entry.user_id) || [],
    [leaderboard]
  );

  // Fetch relationships in batch
  const {
    relationships,
    isLoading: isLoadingRelationships,
    isFriend,
    isFollowing
  } = useBatchRelationships(userIds);

  // Enrich leaderboard with relationship data
  const enrichedLeaderboard = useMemo(() => {
    if (!leaderboard) return [];

    return leaderboard.map(entry => ({
      ...entry,
      relationship: relationships[entry.user_id] || 'none',
      isFriend: isFriend(entry.user_id),
      isFollowing: isFollowing(entry.user_id),
    }));
  }, [leaderboard, relationships, isFriend, isFollowing]);

  return {
    leaderboard: enrichedLeaderboard,
    isLoading: isLoadingLeaderboard || isLoadingRelationships,
  };
}

// Usage in component:
// function Leaderboard() {
//   const { leaderboard, isLoading } = useLeaderboardWithRelationships();
//   // ... render leaderboard with relationship badges
// }
```

## Example 6: Direct API Call (without hook)

Use the endpoint directly without the React hook.

```typescript
// lib/api/relationships.ts
import type { RelationshipStatus } from '@/lib/hooks/useBatchRelationships';

export async function fetchRelationships(
  userIds: string[]
): Promise<Record<string, RelationshipStatus>> {
  const response = await fetch('/api/relationships/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ userIds }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  return data.relationships;
}

// Usage:
// const relationships = await fetchRelationships([userId1, userId2, userId3]);
// console.log(relationships[userId1]); // 'friends' | 'following' | etc.
```

## Example 7: Server-Side Usage (Server Component)

Fetch relationships on the server for initial page load.

```typescript
// app/users/[username]/followers/page.tsx
import { createClient } from '@/lib/supabase/server';

export default async function FollowersPage({
  params
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  // Fetch user's followers
  const { data: followers } = await supabase
    .from('follows')
    .select('follower_id, profiles!follows_follower_id_fkey(username, display_name)')
    .eq('followed_user_id', userId);

  // Fetch relationships for all followers
  const followerIds = followers?.map(f => f.follower_id) || [];

  const relationshipsResponse = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/relationships/batch`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds: followerIds }),
    }
  );

  const { relationships } = await relationshipsResponse.json();

  return (
    <div>
      {followers?.map(follower => (
        <div key={follower.follower_id}>
          {/* Render follower with relationship status */}
          Status: {relationships[follower.follower_id]}
        </div>
      ))}
    </div>
  );
}
```

## Example 8: Real-time Updates with Optimistic UI

Combine with mutations for instant feedback.

```typescript
// components/QuickActions.tsx
'use client';

import { useBatchRelationships } from '@/lib/hooks/useBatchRelationships';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthenticatedFetch } from '@/lib/hooks/useAuthenticatedFetch';

export function QuickActions({ userId }: { userId: string }) {
  const { getRelationship, refetch } = useBatchRelationships([userId]);
  const { authFetch } = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  const status = getRelationship(userId);

  const handleFollow = async () => {
    // Optimistic update
    queryClient.setQueryData(
      ['relationships', 'batch', userId],
      { relationships: { [userId]: 'following' } }
    );

    try {
      await authFetch('/api/follow', {
        method: 'POST',
        body: { userId },
      });
    } catch (error) {
      // Rollback on error
      refetch();
    }
  };

  return (
    <button onClick={handleFollow} disabled={status === 'following'}>
      {status === 'following' ? 'Following' : 'Follow'}
    </button>
  );
}
```

## Performance Tips

### 1. Memoize User ID Arrays

```typescript
// ❌ BAD - Creates new array on every render
const { relationships } = useBatchRelationships(users.map(u => u.id));

// ✅ GOOD - Memoized array
const userIds = useMemo(() => users.map(u => u.id), [users]);
const { relationships } = useBatchRelationships(userIds);
```

### 2. Paginate Large Lists

```typescript
// For lists with >100 users, fetch in batches
const PAGE_SIZE = 50;
const chunk1 = useBatchRelationships(userIds.slice(0, PAGE_SIZE));
const chunk2 = useBatchRelationships(userIds.slice(PAGE_SIZE, PAGE_SIZE * 2));

const relationships = { ...chunk1.relationships, ...chunk2.relationships };
```

### 3. Prefetch on Hover

```typescript
function UserCard({ userId }: { userId: string }) {
  const queryClient = useQueryClient();

  const prefetchRelationship = () => {
    queryClient.prefetchQuery({
      queryKey: ['relationships', 'batch', userId],
      queryFn: () => fetchRelationships([userId]),
    });
  };

  return <div onMouseEnter={prefetchRelationship}>...</div>;
}
```

## Common Patterns

### Filter by Relationship Status

```typescript
const { relationships } = useBatchRelationships(allUserIds);

const friends = allUserIds.filter(id => relationships[id] === 'friends');
const following = allUserIds.filter(id => relationships[id] === 'following');
const strangers = allUserIds.filter(id => relationships[id] === 'none');
```

### Group by Relationship

```typescript
const grouped = allUserIds.reduce((acc, id) => {
  const status = relationships[id] || 'none';
  acc[status] = acc[status] || [];
  acc[status].push(id);
  return acc;
}, {} as Record<RelationshipStatus, string[]>);
```

### Sort by Relationship Priority

```typescript
const priority: Record<RelationshipStatus, number> = {
  friends: 1,
  request_received: 2,
  request_sent: 3,
  followed_by: 4,
  following: 5,
  none: 6,
};

const sorted = [...users].sort((a, b) => {
  const statusA = relationships[a.id] || 'none';
  const statusB = relationships[b.id] || 'none';
  return priority[statusA] - priority[statusB];
});
```
