import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";

// In-memory cache for activity data (simple TTL cache)
const activityCache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL_MS = 30_000; // 30 seconds

function getCachedData<T>(key: string): T | null {
  const cached = activityCache.get(key);
  if (cached && cached.expiry > Date.now()) {
    return cached.data as T;
  }
  activityCache.delete(key);
  return null;
}

function setCachedData(key: string, data: unknown): void {
  activityCache.set(key, { data, expiry: Date.now() + CACHE_TTL_MS });
}

// Profile type for user data
type ProfileData = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

// Event type for event data
type EventData = {
  id: number;
  title: string;
  start_date: string;
  venue: { name: string } | null;
};

// Venue type for venue data
type VenueData = {
  id: number;
  name: string;
  slug: string | null;
  neighborhood: string | null;
};

// Organization type for organization data
type OrganizationData = {
  id: number;
  name: string;
  slug: string | null;
};

// Query result types
type RsvpRow = {
  id: number;
  status: string;
  created_at: string;
  user: ProfileData | null;
  event: EventData | null;
};

type FollowRow = {
  id: number;
  created_at: string;
  followed_venue_id: number | null;
  followed_organization_id: number | null;
  user: ProfileData | null;
  venue: VenueData | null;
  organization: OrganizationData | null;
};

type SavedEventRow = {
  id: number;
  created_at: string;
  user: ProfileData | null;
  event: EventData | null;
};

// Activity item type for the frontend
type ActivityItem = {
  id: string;
  activity_type: "rsvp" | "follow" | "save";
  created_at: string;
  user: ProfileData;
  event?: EventData | null;
  venue?: VenueData | null;
  organization?: OrganizationData | null;
  metadata?: {
    status?: string;
  };
};

// GET /api/dashboard/activity - Get activity from friends
// Optimized: Combined follows query, in-memory caching
// Supports cursor-based pagination for infinite scroll
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "30", 10), 100);
  const cursor = searchParams.get("cursor");

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check cache for non-cursor requests (first page)
  const cacheKey = cursor ? null : `activity:${user.id}:${limit}`;
  if (cacheKey) {
    const cached = getCachedData<{
      activities: ActivityItem[];
      groupedByEvent: unknown[];
      nextCursor: string | null;
      hasMore: boolean;
    }>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }
  }

  const supabase = await createClient();

  // Get users we follow (friends) - people whose activity we want to see
  const { data: friendsData } = await supabase
    .from("follows")
    .select("followed_user_id")
    .eq("follower_id", user.id)
    .not("followed_user_id", "is", null);

  const friendIds = (friendsData || [])
    .map((f) => (f as { followed_user_id: string | null }).followed_user_id)
    .filter(Boolean) as string[];

  if (friendIds.length === 0) {
    const emptyResult = {
      activities: [],
      groupedByEvent: [],
      nextCursor: null,
      hasMore: false,
    };
    if (cacheKey) setCachedData(cacheKey, emptyResult);
    return NextResponse.json(emptyResult);
  }

  // Parse cursor (format: timestamp)
  const cursorDate = cursor ? new Date(cursor) : null;
  const now = new Date(Date.now() + 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch activities from multiple sources in parallel
  // Optimized: Combined user and venue follows into single query
  const [rsvpsResult, followsResult, savedEventsResult] = await Promise.all([
    // 1. RSVPs - friends going to events (main activity source)
    supabase
      .from("event_rsvps")
      .select(`
        id,
        status,
        created_at,
        user:profiles!event_rsvps_user_id_fkey(id, username, display_name, avatar_url),
        event:events!event_rsvps_event_id_fkey(id, title, start_date, venue:venues(name))
      `)
      .in("user_id", friendIds)
      .in("status", ["going", "interested"])
      .gte("created_at", thirtyDaysAgo)
      .lt("created_at", cursorDate ? cursorDate.toISOString() : now)
      .order("created_at", { ascending: false })
      .limit(limit),

    // 2. Follows - friends following venues OR organizations (exclude user-to-user follows)
    supabase
      .from("follows")
      .select(`
        id,
        created_at,
        followed_venue_id,
        followed_organization_id,
        user:profiles!follows_follower_id_fkey(id, username, display_name, avatar_url),
        venue:venues!follows_followed_venue_id_fkey(id, name, slug, neighborhood),
        organization:organizations!follows_followed_organization_id_fkey(id, name, slug)
      `)
      .in("follower_id", friendIds)
      .is("followed_user_id", null) // Exclude user-to-user follows
      .gte("created_at", fourteenDaysAgo)
      .lt("created_at", cursorDate ? cursorDate.toISOString() : now)
      .order("created_at", { ascending: false })
      .limit(30),

    // 3. Saved events - friends saving events
    supabase
      .from("saved_events")
      .select(`
        id,
        created_at,
        user:profiles!saved_events_user_id_fkey(id, username, display_name, avatar_url),
        event:events!saved_events_event_id_fkey(id, title, start_date, venue:venues(name))
      `)
      .in("user_id", friendIds)
      .gte("created_at", fourteenDaysAgo)
      .lt("created_at", cursorDate ? cursorDate.toISOString() : now)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const activities: ActivityItem[] = [];

  // Process RSVPs
  if (rsvpsResult.data) {
    for (const row of rsvpsResult.data) {
      const rsvp = row as unknown as RsvpRow;
      if (!rsvp.user || !rsvp.event) continue;
      activities.push({
        id: `rsvp-${rsvp.id}`,
        activity_type: "rsvp",
        created_at: rsvp.created_at,
        user: rsvp.user,
        event: rsvp.event,
        metadata: { status: rsvp.status },
      });
    }
  }

  // Process follows (venue and organization follows only - no user-to-user follows)
  if (followsResult.data) {
    for (const row of followsResult.data) {
      const follow = row as unknown as FollowRow;
      if (!follow.user) continue;

      // Venue follow (destination)
      if (follow.followed_venue_id && follow.venue) {
        activities.push({
          id: `follow-venue-${follow.id}`,
          activity_type: "follow",
          created_at: follow.created_at,
          user: follow.user,
          venue: follow.venue,
        });
      }
      // Organization follow
      else if (follow.followed_organization_id && follow.organization) {
        activities.push({
          id: `follow-org-${follow.id}`,
          activity_type: "follow",
          created_at: follow.created_at,
          user: follow.user,
          organization: follow.organization,
        });
      }
    }
  }

  // Process saved events
  if (savedEventsResult.data) {
    for (const row of savedEventsResult.data) {
      const saved = row as unknown as SavedEventRow;
      if (!saved.user || !saved.event) continue;
      activities.push({
        id: `save-${saved.id}`,
        activity_type: "save",
        created_at: saved.created_at,
        user: saved.user,
        event: saved.event,
      });
    }
  }

  // Sort all activities by created_at descending
  activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Limit total activities
  const limitedActivities = activities.slice(0, limit);

  // Determine next cursor and hasMore
  const hasMore = limitedActivities.length === limit && activities.length >= limit;
  const nextCursor = hasMore && limitedActivities.length > 0
    ? limitedActivities[limitedActivities.length - 1].created_at
    : null;

  // Group RSVP activities by event for "Your Friends Are Going" section
  const eventGroups = new Map<
    number,
    {
      event: NonNullable<ActivityItem["event"]>;
      users: ActivityItem["user"][];
      latestActivity: string;
    }
  >();

  for (const activity of limitedActivities) {
    if (activity.activity_type === "rsvp" && activity.event) {
      const eventId = activity.event.id;
      const existing = eventGroups.get(eventId);

      if (existing) {
        if (!existing.users.find((u) => u.id === activity.user.id)) {
          existing.users.push(activity.user);
        }
        if (activity.created_at > existing.latestActivity) {
          existing.latestActivity = activity.created_at;
        }
      } else {
        eventGroups.set(eventId, {
          event: activity.event,
          users: [activity.user],
          latestActivity: activity.created_at,
        });
      }
    }
  }

  const groupedByEvent = Array.from(eventGroups.values())
    .sort((a, b) => b.latestActivity.localeCompare(a.latestActivity))
    .slice(0, 10);

  const result = {
    activities: limitedActivities,
    groupedByEvent,
    nextCursor,
    hasMore,
  };

  // Cache first page results
  if (cacheKey) {
    setCachedData(cacheKey, result);
  }

  return NextResponse.json(result);
}
