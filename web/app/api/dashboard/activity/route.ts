import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/api-utils";

// GET /api/dashboard/activity - Get activity from followed users
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "30", 10), 100);

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();

  // Get users we follow (friends)
  const { data: followsData } = await supabase
    .from("follows")
    .select("followed_user_id")
    .eq("follower_id", user.id)
    .not("followed_user_id", "is", null);

  const follows = followsData as { followed_user_id: string | null }[] | null;

  if (!follows || follows.length === 0) {
    return NextResponse.json({
      activities: [],
      groupedByEvent: [],
    });
  }

  const followedIds = follows
    .map((f) => f.followed_user_id)
    .filter(Boolean) as string[];

  // Get activities from followed users
  const { data: activityData, error } = await supabase
    .from("activities")
    .select(`
      id,
      activity_type,
      created_at,
      metadata,
      user:profiles!activities_user_id_fkey(
        id, username, display_name, avatar_url
      ),
      event:events(
        id, title, start_date, start_time,
        venue:venues(name)
      ),
      venue:venues(id, name, neighborhood),
      target_user:profiles!activities_target_user_id_fkey(
        id, username, display_name
      )
    `)
    .in("user_id", followedIds)
    .in("visibility", ["public", "friends"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return errorResponse(error, "activities");
  }

  // Define activity type for proper typing
  type ActivityRow = {
    id: string;
    activity_type: string;
    created_at: string;
    metadata: Record<string, unknown> | null;
    user: {
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    } | null;
    event: {
      id: number;
      title: string;
      start_date: string;
      start_time: string | null;
      venue: { name: string } | null;
    } | null;
    venue: {
      id: number;
      name: string;
      neighborhood: string | null;
    } | null;
    target_user: {
      id: string;
      username: string;
      display_name: string | null;
    } | null;
  };

  // Filter out activities where user data is missing and narrow the type
  const activities = ((activityData || []) as ActivityRow[])
    .filter((a): a is ActivityRow & { user: NonNullable<ActivityRow["user"]> } => a.user !== null);

  // Group RSVP activities by event
  const eventGroups = new Map<
    number,
    {
      event: {
        id: number;
        title: string;
        start_date: string;
        start_time: string | null;
        venue: { name: string } | null;
      };
      users: {
        id: string;
        username: string;
        display_name: string | null;
        avatar_url: string | null;
      }[];
      latestActivity: string;
    }
  >();

  for (const activity of activities) {
    if (activity.activity_type === "rsvp" && activity.event) {
      const eventId = activity.event.id;
      const existing = eventGroups.get(eventId);

      if (existing) {
        if (!existing.users.find((u) => u.id === activity.user.id)) {
          existing.users.push(activity.user);
        }
        // Update latest activity time
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

  // Convert map to array and sort by latest activity
  const groupedByEvent = Array.from(eventGroups.values())
    .sort((a, b) => b.latestActivity.localeCompare(a.latestActivity))
    .slice(0, 10);

  return NextResponse.json({
    activities,
    groupedByEvent,
  });
}
