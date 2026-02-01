import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";

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

// Target user (simplified profile)
type TargetUserData = {
  id: string;
  username: string;
  display_name: string | null;
};

// Query result types
type RsvpRow = {
  id: number;
  status: string;
  created_at: string;
  user: ProfileData | null;
  event: EventData | null;
};

type UserFollowRow = {
  id: number;
  created_at: string;
  user: ProfileData | null;
  target_user: TargetUserData | null;
};

type VenueFollowRow = {
  id: number;
  created_at: string;
  user: ProfileData | null;
  venue: VenueData | null;
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
  target_user?: TargetUserData | null;
  metadata?: {
    status?: string;
  };
};

// GET /api/dashboard/activity - Get activity from friends
// Queries actual source tables (follows, rsvps, saved_events) instead of activities table
// Supports cursor-based pagination for infinite scroll
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "30", 10), 100);
  const cursor = searchParams.get("cursor");

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json({
      activities: [],
      groupedByEvent: [],
      nextCursor: null,
      hasMore: false,
    });
  }

  // Parse cursor (format: timestamp)
  const cursorDate = cursor ? new Date(cursor) : null;

  // Fetch activities from multiple sources in parallel
  // Each query applies cursor filter if present
  const [rsvpsResult, userFollowsResult, venueFollowsResult, savedEventsResult] = await Promise.all([
    // 1. RSVPs - friends going to events
    supabase
      .from("event_rsvps")
      .select(`
        id,
        status,
        created_at,
        user:profiles!event_rsvps_user_id_fkey(id, username, display_name, avatar_url),
        event:events!event_rsvps_event_id_fkey(
          id, title, start_date,
          venue:venues(name)
        )
      `)
      .in("user_id", friendIds)
      .in("status", ["going", "interested"])
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
      .lt("created_at", cursorDate ? cursorDate.toISOString() : new Date(Date.now() + 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(limit),

    // 2. User follows - friends following other users
    supabase
      .from("follows")
      .select(`
        id,
        created_at,
        user:profiles!follows_follower_id_fkey(id, username, display_name, avatar_url),
        target_user:profiles!follows_followed_user_id_fkey(id, username, display_name)
      `)
      .in("follower_id", friendIds)
      .not("followed_user_id", "is", null)
      .gte("created_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()) // Last 14 days
      .lt("created_at", cursorDate ? cursorDate.toISOString() : new Date(Date.now() + 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(20),

    // 3. Venue follows - friends following venues
    supabase
      .from("follows")
      .select(`
        id,
        created_at,
        user:profiles!follows_follower_id_fkey(id, username, display_name, avatar_url),
        venue:venues!follows_followed_venue_id_fkey(id, name, slug, neighborhood)
      `)
      .in("follower_id", friendIds)
      .not("followed_venue_id", "is", null)
      .gte("created_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()) // Last 14 days
      .lt("created_at", cursorDate ? cursorDate.toISOString() : new Date(Date.now() + 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(20),

    // 4. Saved events - friends saving events
    supabase
      .from("saved_events")
      .select(`
        id,
        created_at,
        user:profiles!saved_events_user_id_fkey(id, username, display_name, avatar_url),
        event:events!saved_events_event_id_fkey(
          id, title, start_date,
          venue:venues(name)
        )
      `)
      .in("user_id", friendIds)
      .gte("created_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()) // Last 14 days
      .lt("created_at", cursorDate ? cursorDate.toISOString() : new Date(Date.now() + 1000).toISOString())
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

  // Process user follows
  if (userFollowsResult.data) {
    for (const row of userFollowsResult.data) {
      const follow = row as unknown as UserFollowRow;
      if (!follow.user || !follow.target_user) continue;
      activities.push({
        id: `follow-user-${follow.id}`,
        activity_type: "follow",
        created_at: follow.created_at,
        user: follow.user,
        target_user: follow.target_user,
      });
    }
  }

  // Process venue follows
  if (venueFollowsResult.data) {
    for (const row of venueFollowsResult.data) {
      const follow = row as unknown as VenueFollowRow;
      if (!follow.user || !follow.venue) continue;
      activities.push({
        id: `follow-venue-${follow.id}`,
        activity_type: "follow",
        created_at: follow.created_at,
        user: follow.user,
        venue: follow.venue,
      });
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

  return NextResponse.json({
    activities: limitedActivities,
    groupedByEvent,
    nextCursor,
    hasMore,
  });
}
