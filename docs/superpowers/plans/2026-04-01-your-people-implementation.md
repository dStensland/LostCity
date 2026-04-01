# Your People Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fragmented Community view with a top-level "Your People" coordination hub featuring "I'm in" one-tap RSVP + notification.

**Architecture:** New standalone page at `/your-people` with five sections (friend requests, crew board, friend radar carousel, collapsed activity, find friends). Two new API endpoints (crew-board, friend-signal-events). Extends existing `/api/rsvp` with notification flag. One DB migration for notification type.

**Tech Stack:** Next.js 16, React, TanStack Query, Supabase (Postgres), web-push (optional)

**Spec:** `docs/superpowers/specs/2026-04-01-your-people-redesign.md`
**Design:** `docs/design-system.pen` — nodes `Uz0m0` (mobile), `w2Zfb` (desktop)

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `web/app/your-people/page.tsx` | Page component — section layout, friend-count reordering |
| `web/app/your-people/layout.tsx` | Layout with PlatformHeader |
| `web/app/api/your-people/crew-board/route.ts` | Day-grouped crew events for This Week section |
| `web/app/api/your-people/friend-signal-events/route.ts` | Events with friend signal for radar carousel |
| `web/components/your-people/CrewBoard.tsx` | Day-grouped event list with ImInButton |
| `web/components/your-people/CrewEventCard.tsx` | Single event row in crew board |
| `web/components/your-people/ImInButton.tsx` | RSVP + notification button (3 states) |
| `web/components/your-people/FriendRadarCarousel.tsx` | Horizontal event cards with friend count |
| `web/components/your-people/FriendRadarCard.tsx` | Single card in radar carousel |
| `web/components/your-people/LatelyAccordion.tsx` | Collapsible activity feed wrapper |
| `web/components/your-people/FindFriendsSection.tsx` | Search/contacts/invite action cards |
| `web/lib/hooks/useCrewBoard.ts` | TanStack Query hook for crew-board API |
| `web/lib/hooks/useFriendSignalEvents.ts` | TanStack Query hook for friend-signal-events API |
| `database/migrations/NNN_friend_joining_notification.sql` | Add `friend_joining` to notification type CHECK |

### Modified files
| File | Change |
|------|--------|
| `web/app/api/rsvp/route.ts` | Add `notify_friends` flag, async notification fan-out |
| `web/components/headers/StandardHeader.tsx` | Add "Your People" nav tab, remove Community tab |
| `web/app/[portal]/page.tsx` | Redirect `?view=community` to `/your-people` |
| `web/app/people/page.tsx` | Redirect to `/your-people` |
| `web/app/friends/page.tsx` | Redirect to `/your-people` |

---

## Phase 1: Data Layer

### Task 1: DB Migration — Add `friend_joining` notification type

**Files:**
- Create: `database/migrations/NNN_friend_joining_notification.sql`

- [ ] **Step 1: Write migration**

Find the next migration number:
```bash
ls database/migrations/ | tail -1
```

Create the migration file (replace NNN with next number):

```sql
-- Migration NNN: Add friend_joining notification type for "I'm in" feature
-- When a user taps "I'm in" on a crew board event, attending friends
-- receive a friend_joining notification.

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'new_follower', 'friend_rsvp', 'recommendation', 'event_reminder',
  'friend_going', 'venue_event', 'system', 'event_invite', 'invite_accepted',
  'submission_approved', 'submission_rejected', 'submission_needs_edit',
  'friend_request', 'friend_request_accepted',
  'plan_join', 'plan_rsvp_change',
  -- Your People: "I'm in" notification
  'friend_joining'
));
```

- [ ] **Step 2: Apply migration locally**

```bash
cd database && python run_migrations.py
```

- [ ] **Step 3: Commit**

```bash
git add database/migrations/NNN_friend_joining_notification.sql
git commit -m "migrate: add friend_joining notification type for Your People"
```

---

### Task 2: API — Crew Board endpoint (day-grouped)

**Files:**
- Create: `web/app/api/your-people/crew-board/route.ts`
- Create: `web/lib/hooks/useCrewBoard.ts`

- [ ] **Step 1: Create the API route**

```typescript
// web/app/api/your-people/crew-board/route.ts
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

type CrewEvent = {
  event_id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  image_url: string | null;
  venue_name: string | null;
  friends: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    status: string; // "going" only
  }[];
};

type DayGroup = {
  date: string; // YYYY-MM-DD
  day_label: string; // "Thursday", "Friday", etc.
  events: CrewEvent[];
};

export const GET = withAuth(async (request, { user, serviceClient }) => {
  const rateLimitId = `${user.id}:${getClientIdentifier(request)}`;
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, rateLimitId);
  if (rateLimitResult) return rateLimitResult;

  // Get friend IDs
  const { data: friendIdsData } = await serviceClient.rpc(
    "get_friend_ids" as never,
    { user_id: user.id } as never
  ) as { data: { friend_id: string }[] | null; error: unknown };

  const friendIds = (friendIdsData || []).map((r) => r.friend_id);

  if (friendIds.length === 0) {
    return NextResponse.json({ days: [], friendCount: 0 });
  }

  // Get RSVPs from friends for events this week (going only)
  const now = new Date();
  const endOfWeek = new Date(now);
  endOfWeek.setDate(now.getDate() + 7);
  const todayStr = now.toISOString().split("T")[0];
  const endStr = endOfWeek.toISOString().split("T")[0];

  const { data: rsvpData } = await serviceClient
    .from("event_rsvps")
    .select(`
      user_id,
      status,
      event:events!event_rsvps_event_id_fkey(
        id, title, start_date, start_time, image_url,
        venue:places(name)
      ),
      user:profiles!event_rsvps_user_id_fkey(
        id, username, display_name, avatar_url
      )
    `)
    .in("user_id", friendIds)
    .eq("status", "going")
    .gte("event.start_date", todayStr)
    .lte("event.start_date", endStr)
    .order("event.start_date", { ascending: true } as never)
    .limit(50);

  // Group by event, then by day
  const eventMap = new Map<number, CrewEvent>();

  for (const rsvp of (rsvpData || []) as any[]) {
    if (!rsvp.event || !rsvp.user) continue;
    const eventId = rsvp.event.id;

    const existing = eventMap.get(eventId);
    const friend = {
      id: rsvp.user.id,
      username: rsvp.user.username,
      display_name: rsvp.user.display_name,
      avatar_url: rsvp.user.avatar_url,
      status: rsvp.status,
    };

    if (existing) {
      if (!existing.friends.find((f: any) => f.id === friend.id)) {
        existing.friends.push(friend);
      }
    } else {
      eventMap.set(eventId, {
        event_id: eventId,
        title: rsvp.event.title,
        start_date: rsvp.event.start_date,
        start_time: rsvp.event.start_time,
        image_url: rsvp.event.image_url,
        venue_name: rsvp.event.venue?.name || null,
        friends: [friend],
      });
    }
  }

  // Group events by day
  const dayMap = new Map<string, CrewEvent[]>();
  for (const event of eventMap.values()) {
    const date = event.start_date;
    const existing = dayMap.get(date);
    if (existing) {
      existing.push(event);
    } else {
      dayMap.set(date, [event]);
    }
  }

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const days: DayGroup[] = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, events]) => ({
      date,
      day_label: dayNames[new Date(date + "T12:00:00").getDay()],
      events: events.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || "")),
    }));

  return NextResponse.json({
    days,
    friendCount: friendIds.length,
  });
});
```

- [ ] **Step 2: Create the hook**

```typescript
// web/lib/hooks/useCrewBoard.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";

type CrewFriend = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  status: string;
};

export type CrewEvent = {
  event_id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  image_url: string | null;
  venue_name: string | null;
  friends: CrewFriend[];
};

export type DayGroup = {
  date: string;
  day_label: string;
  events: CrewEvent[];
};

type CrewBoardResponse = {
  days: DayGroup[];
  friendCount: number;
};

export function useCrewBoard() {
  const { user } = useAuth();

  const query = useQuery<CrewBoardResponse>({
    queryKey: ["crew-board"],
    queryFn: async () => {
      const res = await fetch("/api/your-people/crew-board");
      if (!res.ok) throw new Error("Failed to fetch crew board");
      return res.json();
    },
    enabled: !!user,
    staleTime: 60_000, // 60s — changes when friends RSVP
    refetchOnWindowFocus: true,
  });

  return {
    days: query.data?.days || [],
    friendCount: query.data?.friendCount || 0,
    isLoading: query.isLoading,
  };
}
```

- [ ] **Step 3: Verify endpoint locally**

```bash
cd web && npm run dev
# In another terminal, test with auth cookie:
# curl http://localhost:3000/api/your-people/crew-board
```

- [ ] **Step 4: Commit**

```bash
git add web/app/api/your-people/crew-board/route.ts web/lib/hooks/useCrewBoard.ts
git commit -m "feat(your-people): add crew-board API endpoint and hook"
```

---

### Task 3: API — Friend Signal Events endpoint

**Files:**
- Create: `web/app/api/your-people/friend-signal-events/route.ts`
- Create: `web/lib/hooks/useFriendSignalEvents.ts`

- [ ] **Step 1: Create the API route**

```typescript
// web/app/api/your-people/friend-signal-events/route.ts
import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

type FriendSignalEvent = {
  event_id: number;
  title: string;
  start_date: string;
  image_url: string | null;
  venue_name: string | null;
  going_count: number;
  interested_count: number;
  friend_avatars: { id: string; avatar_url: string | null }[];
};

export const GET = withAuth(async (request, { user, serviceClient }) => {
  const rateLimitId = `${user.id}:${getClientIdentifier(request)}`;
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, rateLimitId);
  if (rateLimitResult) return rateLimitResult;

  // Get friend IDs
  const { data: friendIdsData } = await serviceClient.rpc(
    "get_friend_ids" as never,
    { user_id: user.id } as never
  ) as { data: { friend_id: string }[] | null; error: unknown };

  const friendIds = (friendIdsData || []).map((r) => r.friend_id);

  if (friendIds.length === 0) {
    return NextResponse.json({ events: [] });
  }

  // Get events in next 14 days where friends have RSVPed or saved
  const now = new Date();
  const twoWeeks = new Date(now);
  twoWeeks.setDate(now.getDate() + 14);
  const todayStr = now.toISOString().split("T")[0];
  const endStr = twoWeeks.toISOString().split("T")[0];

  // RSVPs from friends
  const { data: rsvpData } = await serviceClient
    .from("event_rsvps")
    .select(`
      user_id, status,
      event:events!event_rsvps_event_id_fkey(
        id, title, start_date, image_url,
        venue:places(name)
      ),
      user:profiles!event_rsvps_user_id_fkey(id, avatar_url)
    `)
    .in("user_id", friendIds)
    .in("status", ["going", "interested"])
    .gte("event.start_date", todayStr)
    .lte("event.start_date", endStr)
    .limit(100);

  // Saves from friends
  const { data: saveData } = await serviceClient
    .from("saved_items")
    .select(`
      user_id,
      event:events!saved_items_event_id_fkey(
        id, title, start_date, image_url,
        venue:places(name)
      ),
      user:profiles!saved_items_user_id_fkey(id, avatar_url)
    `)
    .in("user_id", friendIds)
    .not("event_id", "is", null)
    .gte("event.start_date", todayStr)
    .lte("event.start_date", endStr)
    .limit(100);

  // Aggregate by event
  const eventMap = new Map<number, FriendSignalEvent>();

  for (const rsvp of (rsvpData || []) as any[]) {
    if (!rsvp.event) continue;
    const eid = rsvp.event.id;
    const existing = eventMap.get(eid) || {
      event_id: eid,
      title: rsvp.event.title,
      start_date: rsvp.event.start_date,
      image_url: rsvp.event.image_url,
      venue_name: rsvp.event.venue?.name || null,
      going_count: 0,
      interested_count: 0,
      friend_avatars: [],
    };

    if (rsvp.status === "going") existing.going_count++;
    else existing.interested_count++;

    if (rsvp.user && !existing.friend_avatars.find((a: any) => a.id === rsvp.user.id)) {
      existing.friend_avatars.push({ id: rsvp.user.id, avatar_url: rsvp.user.avatar_url });
    }

    eventMap.set(eid, existing);
  }

  for (const save of (saveData || []) as any[]) {
    if (!save.event) continue;
    const eid = save.event.id;
    const existing = eventMap.get(eid) || {
      event_id: eid,
      title: save.event.title,
      start_date: save.event.start_date,
      image_url: save.event.image_url,
      venue_name: save.event.venue?.name || null,
      going_count: 0,
      interested_count: 0,
      friend_avatars: [],
    };

    existing.interested_count++;

    if (save.user && !existing.friend_avatars.find((a: any) => a.id === save.user.id)) {
      existing.friend_avatars.push({ id: save.user.id, avatar_url: save.user.avatar_url });
    }

    eventMap.set(eid, existing);
  }

  // Sort by total friend signal descending, then by date
  const events = Array.from(eventMap.values())
    .sort((a, b) => {
      const aTotal = a.going_count + a.interested_count;
      const bTotal = b.going_count + b.interested_count;
      if (bTotal !== aTotal) return bTotal - aTotal;
      return a.start_date.localeCompare(b.start_date);
    })
    .slice(0, 20);

  return NextResponse.json({ events });
});
```

- [ ] **Step 2: Create the hook**

```typescript
// web/lib/hooks/useFriendSignalEvents.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";

export type FriendSignalEvent = {
  event_id: number;
  title: string;
  start_date: string;
  image_url: string | null;
  venue_name: string | null;
  going_count: number;
  interested_count: number;
  friend_avatars: { id: string; avatar_url: string | null }[];
};

type FriendSignalResponse = {
  events: FriendSignalEvent[];
};

export function useFriendSignalEvents(crewEventIds: number[] = []) {
  const { user } = useAuth();

  const query = useQuery<FriendSignalResponse>({
    queryKey: ["friend-signal-events"],
    queryFn: async () => {
      const res = await fetch("/api/your-people/friend-signal-events");
      if (!res.ok) throw new Error("Failed to fetch friend signal events");
      return res.json();
    },
    enabled: !!user,
    staleTime: 5 * 60_000, // 5 min — less volatile than crew board
  });

  // Exclude events already shown in crew board
  const filtered = (query.data?.events || []).filter(
    (e) => !crewEventIds.includes(e.event_id)
  );

  return {
    events: filtered,
    isLoading: query.isLoading,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add web/app/api/your-people/friend-signal-events/route.ts web/lib/hooks/useFriendSignalEvents.ts
git commit -m "feat(your-people): add friend-signal-events API endpoint and hook"
```

---

### Task 4: Extend `/api/rsvp` with `notify_friends` flag

**Files:**
- Modify: `web/app/api/rsvp/route.ts`

- [ ] **Step 1: Add notification logic after successful RSVP upsert**

In `web/app/api/rsvp/route.ts`, after the upsert succeeds (line 86: `return NextResponse.json({ success: true, rsvp: data })`), add the notification fan-out. The notification must be **async** — do not await it before returning the response.

Add this import at the top of the file:
```typescript
import { sendPushToUser } from "@/lib/push-notifications";
```

Replace the success return block (around lines 84-86) with:
```typescript
    // Fire-and-forget: notify friends if requested
    if (body.notify_friends && status === "going") {
      // Don't await — notification is async, don't block RSVP response
      notifyFriendsOfJoining(user.id, event_id, serviceClient).catch((err) => {
        logger.error("Friend notification failed", err, { userId: user.id, eventId: event_id, component: "rsvp" });
      });
    }

    return NextResponse.json({ success: true, rsvp: data });
```

Add this helper function at the bottom of the file:
```typescript
async function notifyFriendsOfJoining(
  userId: string,
  eventId: number,
  serviceClient: ReturnType<typeof import("@/lib/supabase/service").createServiceClient>
) {
  // Get user's display name
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("display_name, username")
    .eq("id", userId)
    .single();

  const name = profile?.display_name || profile?.username || "Someone";

  // Get event title
  const { data: event } = await serviceClient
    .from("events")
    .select("title")
    .eq("id", eventId)
    .single();

  if (!event) return;

  // Get friends who are going to this event
  const { data: friendIdsData } = await serviceClient.rpc(
    "get_friend_ids" as never,
    { user_id: userId } as never
  ) as { data: { friend_id: string }[] | null; error: unknown };

  const friendIds = (friendIdsData || []).map((r) => r.friend_id);
  if (friendIds.length === 0) return;

  // Find friends who RSVPed to this event
  const { data: attendingFriends } = await serviceClient
    .from("event_rsvps")
    .select("user_id")
    .eq("event_id", eventId)
    .in("user_id", friendIds)
    .eq("status", "going");

  if (!attendingFriends || attendingFriends.length === 0) return;

  // Throttle: check if we already notified each friend about this event in last 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  for (const friend of attendingFriends) {
    // Check throttle
    const { data: existing } = await serviceClient
      .from("notifications")
      .select("id")
      .eq("user_id", friend.user_id)
      .eq("event_id", eventId)
      .eq("type", "friend_joining")
      .gte("created_at", oneDayAgo)
      .limit(1);

    if (existing && existing.length > 0) continue; // Already notified

    // Insert notification
    await serviceClient.from("notifications").insert({
      user_id: friend.user_id,
      type: "friend_joining",
      event_id: eventId,
      actor_id: userId,
      message: `${name} is joining you at ${event.title}!`,
    } as never);

    // Push notification (fire-and-forget)
    sendPushToUser(friend.user_id, {
      title: "Your People",
      body: `${name} is joining you at ${event.title}!`,
      url: `/events/${eventId}`,
      tag: `friend-joining-${eventId}`,
    }).catch(() => {}); // Silently ignore push failures
  }
}
```

- [ ] **Step 2: Run `npx tsc --noEmit` to verify types**

```bash
cd web && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/app/api/rsvp/route.ts
git commit -m "feat(rsvp): add notify_friends flag for Your People I'm-in action"
```

---

## Phase 2: UI Components

### Task 5: ImInButton component

**Files:**
- Create: `web/components/your-people/ImInButton.tsx`

- [ ] **Step 1: Build the three-state button**

```typescript
// web/components/your-people/ImInButton.tsx
"use client";

import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";

type ImInState = "default" | "going" | "interested";

interface ImInButtonProps {
  eventId: number;
  initialState?: ImInState;
  className?: string;
}

export default function ImInButton({ eventId, initialState = "default", className = "" }: ImInButtonProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [state, setState] = useState<ImInState>(initialState);

  const rsvpMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          status: "going",
          notify_friends: true,
        }),
      });
      if (!res.ok) throw new Error("RSVP failed");
      return res.json();
    },
    onMutate: () => {
      setState("going");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crew-board"] });
      queryClient.invalidateQueries({ queryKey: ["friend-signal-events"] });
    },
    onError: () => {
      setState(initialState);
    },
  });

  const undoMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/rsvp?event_id=${eventId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Undo failed");
      return res.json();
    },
    onMutate: () => {
      setState("default");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crew-board"] });
    },
    onError: () => {
      setState("going");
    },
  });

  const handleClick = useCallback(() => {
    if (!user) return;
    if (state === "going") {
      undoMutation.mutate();
    } else {
      rsvpMutation.mutate();
    }
  }, [user, state, rsvpMutation, undoMutation]);

  if (!user) return null;

  const styles = {
    default: "bg-[var(--coral)]/12 border-[var(--coral)]/30 text-[var(--coral)]",
    going: "bg-[var(--neon-green)]/12 border-[var(--neon-green)]/30 text-[var(--neon-green)]",
    interested: "bg-[var(--gold)]/12 border-[var(--gold)]/30 text-[var(--gold)]",
  };

  const labels = {
    default: "I'm in",
    going: "Going",
    interested: "Interested",
  };

  return (
    <button
      onClick={handleClick}
      disabled={rsvpMutation.isPending || undoMutation.isPending}
      className={`min-h-[44px] px-3.5 py-2 rounded-lg border font-mono text-xs font-semibold transition-all disabled:opacity-50 flex items-center gap-1.5 ${styles[state]} ${className}`}
    >
      {state === "going" && (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      )}
      {labels[state]}
    </button>
  );
}
```

- [ ] **Step 2: Run `npx tsc --noEmit`**

- [ ] **Step 3: Commit**

```bash
git add web/components/your-people/ImInButton.tsx
git commit -m "feat(your-people): add ImInButton component with 3 states"
```

---

### Task 6: CrewEventCard + CrewBoard components

**Files:**
- Create: `web/components/your-people/CrewEventCard.tsx`
- Create: `web/components/your-people/CrewBoard.tsx`

- [ ] **Step 1: Build CrewEventCard**

```typescript
// web/components/your-people/CrewEventCard.tsx
"use client";

import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import UserAvatar from "@/components/UserAvatar";
import ImInButton from "@/components/your-people/ImInButton";
import type { CrewEvent } from "@/lib/hooks/useCrewBoard";

interface CrewEventCardProps {
  event: CrewEvent;
}

export default function CrewEventCard({ event }: CrewEventCardProps) {
  const firstFriend = event.friends[0];
  const extraCount = event.friends.length - 1;

  const timeStr = event.start_time
    ? new Date(`2000-01-01T${event.start_time}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null;

  const metaParts = [timeStr, event.venue_name].filter(Boolean).join(" · ");

  return (
    <div className="flex items-center gap-2.5 sm:gap-3.5 p-3 sm:p-3.5 rounded-[10px] bg-[var(--night)] border border-[var(--twilight)] hover:border-[var(--twilight)]/80 transition-colors">
      {/* Event image */}
      <Link href={`/events/${event.event_id}`} className="flex-shrink-0">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden bg-[var(--dusk)]">
          {event.image_url && (
            <SmartImage src={event.image_url} alt={event.title} width={56} height={56} className="w-full h-full object-cover" />
          )}
        </div>
      </Link>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <Link href={`/events/${event.event_id}`} className="block">
          <h4 className="text-sm font-medium text-[var(--cream)] truncate hover:text-[var(--coral)] transition-colors">
            {event.title}
          </h4>
        </Link>

        {/* Friend attribution */}
        <div className="flex items-center gap-1.5">
          <div className="flex -space-x-1">
            {event.friends.slice(0, 3).map((f) => (
              <UserAvatar key={f.id} src={f.avatar_url} name={f.display_name || f.username} size="xs" />
            ))}
          </div>
          <span className="text-xs text-[var(--soft)]">
            {extraCount > 0 ? (
              <><span className="text-[var(--coral)] font-medium">{firstFriend.display_name || firstFriend.username} + {extraCount}</span> going</>
            ) : (
              <><span>{firstFriend.display_name || firstFriend.username}</span> <span className="text-[var(--muted)]">is going</span></>
            )}
          </span>
        </div>

        {metaParts && (
          <p className="font-mono text-xs text-[var(--muted)]">{metaParts}</p>
        )}
      </div>

      {/* I'm in button */}
      <ImInButton eventId={event.event_id} />
    </div>
  );
}
```

- [ ] **Step 2: Build CrewBoard**

```typescript
// web/components/your-people/CrewBoard.tsx
"use client";

import Link from "next/link";
import { useCrewBoard } from "@/lib/hooks/useCrewBoard";
import CrewEventCard from "@/components/your-people/CrewEventCard";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";

export default function CrewBoard() {
  const { days, isLoading } = useCrewBoard();

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[var(--twilight)] overflow-hidden">
        <div className="h-0.5 bg-gradient-to-r from-[var(--coral)] via-[var(--neon-magenta)] to-transparent" />
        <div className="p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 skeleton-shimmer rounded-[10px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--twilight)] overflow-hidden">
      {/* Accent bar */}
      <div className="h-0.5 bg-gradient-to-r from-[var(--coral)] via-[var(--neon-magenta)] to-transparent" />

      <div className="p-4 space-y-4">
        <FeedSectionHeader
          title="This Week"
          priority="secondary"
          accentColor="var(--coral)"
        />

        {days.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-[var(--soft)] mb-3">Nobody&apos;s got plans yet.</p>
            <Link
              href="/atl?view=find"
              className="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--coral)] hover:opacity-80 transition-opacity"
            >
              Browse events &rarr;
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {days.map((day) => (
              <div key={day.date} className="space-y-1.5">
                <p className="font-mono text-2xs font-medium text-[var(--soft)] uppercase tracking-wider pl-1">
                  {day.day_label}
                </p>
                <div className="space-y-1.5">
                  {day.events.map((event) => (
                    <CrewEventCard key={event.event_id} event={event} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Returns all event IDs shown in the crew board (for deduplication with radar) */
export function useCrewBoardEventIds(): number[] {
  const { days } = useCrewBoard();
  return days.flatMap((d) => d.events.map((e) => e.event_id));
}
```

- [ ] **Step 3: Run `npx tsc --noEmit`**

- [ ] **Step 4: Commit**

```bash
git add web/components/your-people/CrewEventCard.tsx web/components/your-people/CrewBoard.tsx
git commit -m "feat(your-people): add CrewBoard and CrewEventCard components"
```

---

### Task 7: FriendRadarCarousel + FriendRadarCard

**Files:**
- Create: `web/components/your-people/FriendRadarCard.tsx`
- Create: `web/components/your-people/FriendRadarCarousel.tsx`

- [ ] **Step 1: Build FriendRadarCard**

```typescript
// web/components/your-people/FriendRadarCard.tsx
"use client";

import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import type { FriendSignalEvent } from "@/lib/hooks/useFriendSignalEvents";

interface FriendRadarCardProps {
  event: FriendSignalEvent;
}

export default function FriendRadarCard({ event }: FriendRadarCardProps) {
  const hasGoing = event.going_count > 0;
  const label = hasGoing
    ? `${event.going_count} friend${event.going_count !== 1 ? "s" : ""} going`
    : `${event.interested_count} friend${event.interested_count !== 1 ? "s" : ""} interested`;
  const labelColor = hasGoing ? "var(--coral)" : "var(--gold)";

  return (
    <Link
      href={`/events/${event.event_id}`}
      className="flex-shrink-0 w-40 sm:w-[220px] rounded-[10px] bg-[var(--night)] border border-[var(--twilight)] overflow-hidden hover:border-[var(--twilight)]/80 transition-colors group"
    >
      <div className="w-full h-[90px] sm:h-[120px] bg-[var(--dusk)] overflow-hidden">
        {event.image_url && (
          <SmartImage src={event.image_url} alt={event.title} width={220} height={120} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        )}
      </div>
      <div className="p-2 sm:p-2.5 space-y-1">
        <h4 className="text-xs sm:text-sm font-medium text-[var(--cream)] truncate">{event.title}</h4>
        <div className="flex items-center gap-1.5">
          <div className="flex -space-x-1">
            {event.friend_avatars.slice(0, 2).map((a) => (
              <div key={a.id} className="w-3.5 h-3.5 rounded-full bg-[var(--dusk)] border border-[var(--night)]" />
            ))}
          </div>
          <span className="font-mono text-2xs font-medium" style={{ color: labelColor }}>
            {label}
          </span>
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Build FriendRadarCarousel**

```typescript
// web/components/your-people/FriendRadarCarousel.tsx
"use client";

import { useFriendSignalEvents } from "@/lib/hooks/useFriendSignalEvents";
import FriendRadarCard from "@/components/your-people/FriendRadarCard";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";

interface FriendRadarCarouselProps {
  excludeEventIds: number[];
}

export default function FriendRadarCarousel({ excludeEventIds }: FriendRadarCarouselProps) {
  const { events, isLoading } = useFriendSignalEvents(excludeEventIds);

  if (isLoading || events.length === 0) return null;

  return (
    <div className="space-y-3">
      <FeedSectionHeader
        title="On Your Friends' Radar"
        priority="tertiary"
        accentColor="var(--neon-cyan)"
        seeAllHref="/atl?view=find"
      />
      <div className="flex gap-2.5 sm:gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4">
        {events.map((event) => (
          <FriendRadarCard key={event.event_id} event={event} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/components/your-people/FriendRadarCard.tsx web/components/your-people/FriendRadarCarousel.tsx
git commit -m "feat(your-people): add FriendRadarCarousel and FriendRadarCard"
```

---

### Task 8: LatelyAccordion + FindFriendsSection

**Files:**
- Create: `web/components/your-people/LatelyAccordion.tsx`
- Create: `web/components/your-people/FindFriendsSection.tsx`

- [ ] **Step 1: Build LatelyAccordion**

```typescript
// web/components/your-people/LatelyAccordion.tsx
"use client";

import { useState } from "react";
import { FriendsActivity } from "@/components/community/FriendsActivity";

export default function LatelyAccordion() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-[var(--twilight)] rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[var(--twilight)]/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-0.5 h-3.5 rounded-full bg-[var(--vibe)]" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--vibe)]">
            Lately
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-[var(--muted)] transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-4 pb-4">
          <FriendsActivity />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build FindFriendsSection**

```typescript
// web/components/your-people/FindFriendsSection.tsx
"use client";

import Link from "next/link";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import { FriendSuggestions } from "@/components/community/FriendSuggestions";
import { useFriendSuggestions } from "@/lib/hooks/useFriendSuggestions";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";

export default function FindFriendsSection() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const { suggestions, isLoading: suggestionsLoading } = useFriendSuggestions();

  const handleCopyInvite = async () => {
    if (!profile?.username) return;
    const url = `${window.location.origin}/invite/${profile.username}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Invite link copied!", "success");
    } catch {
      showToast("Failed to copy link", "error");
    }
  };

  const actions = [
    {
      label: "Search",
      description: "Find friends on Lost City",
      href: "/people",
      iconBg: "rgba(232,85,160,0.1)",
      iconColor: "var(--neon-magenta)",
      icon: "search",
    },
    {
      label: "Contacts",
      description: "See who you know",
      href: "/find-friends?tab=import",
      iconBg: "rgba(167,139,250,0.1)",
      iconColor: "var(--vibe)",
      icon: "users",
    },
    {
      label: "Invite",
      description: "Share your link",
      onClick: handleCopyInvite,
      iconBg: "rgba(0,212,232,0.1)",
      iconColor: "var(--neon-cyan)",
      icon: "share-2",
    },
  ];

  return (
    <div className="space-y-3">
      <FeedSectionHeader
        title="Find Friends"
        priority="tertiary"
        accentColor="var(--neon-magenta)"
      />

      {/* Action cards — mobile: 3-col grid, desktop: row with descriptions */}
      <div className="grid grid-cols-3 sm:grid-cols-1 gap-2 sm:gap-2.5">
        {actions.map((action) => {
          const content = (
            <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 p-3 sm:px-4 sm:py-3.5 rounded-[10px] border border-[var(--twilight)] hover:bg-[var(--twilight)]/10 transition-colors">
              <div
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: action.iconBg }}
              >
                <svg className="w-[18px] h-[18px] sm:w-5 sm:h-5" style={{ color: action.iconColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {action.icon === "search" && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />}
                  {action.icon === "users" && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />}
                  {action.icon === "share-2" && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />}
                </svg>
              </div>
              <div className="text-center sm:text-left">
                <span className="font-mono text-xs text-[var(--muted)] sm:text-sm sm:font-medium sm:text-[var(--cream)] sm:font-sans">{action.label}</span>
                <p className="hidden sm:block text-xs text-[var(--muted)]">{action.description}</p>
              </div>
            </div>
          );

          if (action.onClick) {
            return <button key={action.label} onClick={action.onClick} className="text-left">{content}</button>;
          }
          return <Link key={action.label} href={action.href!}>{content}</Link>;
        })}
      </div>

      {/* Suggestions */}
      {(suggestions.length > 0 || suggestionsLoading) && (
        <FriendSuggestions suggestions={suggestions} isLoading={suggestionsLoading} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/components/your-people/LatelyAccordion.tsx web/components/your-people/FindFriendsSection.tsx
git commit -m "feat(your-people): add LatelyAccordion and FindFriendsSection"
```

---

## Phase 3: Page Assembly

### Task 9: Your People page + layout

**Files:**
- Create: `web/app/your-people/layout.tsx`
- Create: `web/app/your-people/page.tsx`

- [ ] **Step 1: Create layout**

```typescript
// web/app/your-people/layout.tsx
import { PlatformHeader } from "@/components/headers";
import PageFooter from "@/components/PageFooter";

export const metadata = {
  title: "Your People | Lost City",
  description: "See what your friends are doing and make plans together",
};

export default function YourPeopleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <PlatformHeader />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 pb-28 space-y-6">
        {children}
      </main>
      <PageFooter />
    </div>
  );
}
```

- [ ] **Step 2: Create page**

```typescript
// web/app/your-people/page.tsx
"use client";

import { useAuth } from "@/lib/auth-context";
import { useFriendRequests } from "@/lib/hooks/useFriendRequests";
import { PendingRequests } from "@/components/community/PendingRequests";
import CrewBoard, { useCrewBoardEventIds } from "@/components/your-people/CrewBoard";
import FriendRadarCarousel from "@/components/your-people/FriendRadarCarousel";
import LatelyAccordion from "@/components/your-people/LatelyAccordion";
import FindFriendsSection from "@/components/your-people/FindFriendsSection";
import { useCrewBoard } from "@/lib/hooks/useCrewBoard";
import Link from "next/link";

export default function YourPeoplePage() {
  const { user } = useAuth();
  const { pendingRequests, isLoading: requestsLoading } = useFriendRequests({ type: "received" });
  const { friendCount } = useCrewBoard();
  const crewEventIds = useCrewBoardEventIds();

  const isLowFriendCount = friendCount < 3;

  if (!user) {
    return <UnauthenticatedView />;
  }

  if (requestsLoading) {
    return (
      <div className="space-y-6">
        <PageHeader subtitle="Loading..." />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 skeleton-shimmer rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        subtitle={friendCount > 0 ? `${friendCount} friend${friendCount !== 1 ? "s" : ""} going out this week` : undefined}
      />

      {/* Friend Requests — always first when present */}
      {pendingRequests.length > 0 && <PendingRequests requests={pendingRequests} />}

      {/* Adaptive ordering: low friend count → show Find Friends first */}
      {isLowFriendCount ? (
        <>
          <FindFriendsSection />
          <CrewBoard />
        </>
      ) : (
        <>
          <CrewBoard />
          <FriendRadarCarousel excludeEventIds={crewEventIds} />
          <LatelyAccordion />
          <FindFriendsSection />
        </>
      )}
    </div>
  );
}

function PageHeader({ subtitle }: { subtitle?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-[var(--cream)] tracking-tight">Your People</h1>
      {subtitle && (
        <p className="font-mono text-xs text-[var(--muted)] mt-0.5">{subtitle}</p>
      )}
    </div>
  );
}

function UnauthenticatedView() {
  return (
    <div className="space-y-6">
      <PageHeader />
      <div className="relative glass p-6 rounded-xl text-center border border-[var(--twilight)]">
        <h3 className="text-lg font-medium text-[var(--cream)] mb-2">See what your people are up to</h3>
        <p className="text-sm text-[var(--muted)] mb-5 max-w-sm mx-auto">
          Find out where your friends are going and join them in one tap.
        </p>
        <Link
          href="/auth/login?redirect=/your-people"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--coral)] text-[var(--void)] rounded-lg font-mono text-sm font-medium hover:brightness-110 transition-all"
        >
          Sign In
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run `npx tsc --noEmit`**

- [ ] **Step 4: Run dev server and verify page loads at `/your-people`**

```bash
cd web && npm run dev
# Visit http://localhost:3000/your-people
```

- [ ] **Step 5: Commit**

```bash
git add web/app/your-people/
git commit -m "feat(your-people): assemble page with all sections"
```

---

## Phase 4: Navigation Cutover

### Task 10: Add nav entry + redirects

**Files:**
- Modify: `web/components/headers/StandardHeader.tsx` — add Your People tab
- Modify: `web/app/people/page.tsx` — redirect to `/your-people`
- Modify: `web/app/friends/page.tsx` — redirect to `/your-people`
- Modify: `web/app/[portal]/page.tsx` — redirect `?view=community` to `/your-people`

- [ ] **Step 1: Read StandardHeader.tsx to find the nav tabs array**

Read the file and locate the `tabs` or nav definition array. Add a new tab entry for "Your People" with `key: "people"` and `href: "/your-people"`. Remove or update the community tab entry.

The tab should use:
- Label: `"YOUR PEOPLE"`
- Icon: lucide `users`
- Accent: `--coral` when active
- External href (not a `?view=` param — it's a standalone route)

- [ ] **Step 2: Update `/people` page to redirect**

Replace the entire content of `web/app/people/page.tsx` with:
```typescript
import { redirect } from "next/navigation";

export default function PeoplePage() {
  redirect("/your-people");
}
```

- [ ] **Step 3: Update `/friends` page to redirect**

Replace the content of `web/app/friends/page.tsx` with:
```typescript
import { redirect } from "next/navigation";

export default function FriendsPage() {
  redirect("/your-people");
}
```

- [ ] **Step 4: Add `?view=community` redirect in portal page**

In `web/app/[portal]/page.tsx`, find where `view === "community"` is handled and add a redirect to `/your-people` at the top of that branch, before any rendering.

- [ ] **Step 5: Run `npx tsc --noEmit`**

- [ ] **Step 6: Test navigation flow**

```bash
cd web && npm run dev
# Test: /people → should redirect to /your-people
# Test: /friends → should redirect to /your-people
# Test: /atl?view=community → should redirect to /your-people
# Test: Desktop header has "YOUR PEOPLE" tab
```

- [ ] **Step 7: Commit**

```bash
git add web/components/headers/StandardHeader.tsx web/app/people/page.tsx web/app/friends/page.tsx web/app/\\[portal\\]/page.tsx
git commit -m "feat(nav): add Your People to nav, redirect old routes"
```

---

## Phase 5: Integration checkpoint

### Task 11: Full integration test

- [ ] **Step 1: Run TypeScript check**

```bash
cd web && npx tsc --noEmit
```
Fix any errors before proceeding.

- [ ] **Step 2: Run tests**

```bash
cd web && npx vitest run
```

- [ ] **Step 3: Browser test checklist**

Open `http://localhost:3000/your-people` and verify:
- [ ] Page loads with header and all sections
- [ ] Crew Board shows day-grouped events (if test data exists)
- [ ] "I'm in" button transitions to "Going" on click
- [ ] Radar carousel shows friend-signal events
- [ ] Lately accordion expands/collapses
- [ ] Find Friends section shows action cards and suggestions
- [ ] Empty states render correctly (no blank voids)
- [ ] Mobile viewport (375px): all sections stack, touch targets ≥ 44px
- [ ] Unauthenticated: shows sign-in prompt
- [ ] Navigation: header tab highlights correctly
- [ ] Redirects work: `/people`, `/friends`, `?view=community`

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix(your-people): integration test fixes"
```
