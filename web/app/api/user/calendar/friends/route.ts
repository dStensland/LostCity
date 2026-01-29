import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { format, startOfMonth, endOfMonth, addMonths } from "date-fns";

export type FriendCalendarEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  is_all_day: boolean;
  category: string | null;
  rsvp_status: "going" | "interested";
  friend: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
};

// GET /api/user/calendar/friends?start=YYYY-MM-DD&end=YYYY-MM-DD&friend_ids=id1,id2
export async function GET(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // Parse date range
    const now = new Date();
    const defaultStart = format(startOfMonth(now), "yyyy-MM-dd");
    const defaultEnd = format(endOfMonth(addMonths(now, 2)), "yyyy-MM-dd");

    const startDate = searchParams.get("start") || defaultStart;
    const endDate = searchParams.get("end") || defaultEnd;

    // Parse friend IDs filter (optional - if not provided, fetch all friends)
    const friendIdsParam = searchParams.get("friend_ids");
    const requestedFriendIds = friendIdsParam ? friendIdsParam.split(",").filter(Boolean) : null;

    const supabase = await createClient();

    // Step 1: Get user's friends (mutual follows)
    const { data: following } = await supabase
      .from("follows")
      .select("followed_user_id")
      .eq("follower_id", user.id)
      .not("followed_user_id", "is", null);

    const followingIds = (following || [])
      .map((f) => (f as { followed_user_id: string }).followed_user_id)
      .filter(Boolean);

    if (followingIds.length === 0) {
      return NextResponse.json({ events: [], friends: [] });
    }

    // Step 2: Get users who follow me back (mutual = friends)
    const { data: mutualFollows } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("followed_user_id", user.id)
      .in("follower_id", followingIds);

    let friendIds = (mutualFollows || [])
      .map((f) => (f as { follower_id: string }).follower_id)
      .filter(Boolean);

    if (friendIds.length === 0) {
      return NextResponse.json({ events: [], friends: [] });
    }

    // Filter by requested friend IDs if provided
    if (requestedFriendIds && requestedFriendIds.length > 0) {
      friendIds = friendIds.filter(id => requestedFriendIds.includes(id));
    }

    if (friendIds.length === 0) {
      return NextResponse.json({ events: [], friends: [] });
    }

    // Step 3: Fetch friend profiles
    type FriendProfile = {
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    };

    const { data: friendProfiles } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .in("id", friendIds)
      .order("display_name") as { data: FriendProfile[] | null };

    const friendsMap = new Map(
      (friendProfiles || []).map(f => [f.id, f])
    );

    // Step 4: Fetch friends' RSVPs (only public or friends visibility)
    type FriendRsvpRow = {
      user_id: string;
      status: string;
      visibility: string;
      event: {
        id: number;
        title: string;
        start_date: string;
        start_time: string | null;
        is_all_day: boolean;
        category: string | null;
      };
    };

    const { data: rsvps, error } = await supabase
      .from("event_rsvps")
      .select(`
        user_id,
        status,
        visibility,
        event:events!inner(
          id,
          title,
          start_date,
          start_time,
          is_all_day,
          category
        )
      `)
      .in("user_id", friendIds)
      .in("status", ["going", "interested"])
      .in("visibility", ["public", "friends"]) // Respect privacy
      .gte("event.start_date", startDate)
      .lte("event.start_date", endDate) as { data: FriendRsvpRow[] | null; error: Error | null };

    if (error) {
      console.error("Error fetching friend calendar events:", error);
      return NextResponse.json(
        { error: "Failed to fetch friend events" },
        { status: 500 }
      );
    }

    // Transform to response format
    const events: FriendCalendarEvent[] = (rsvps || []).map((rsvp) => {
      const friend = friendsMap.get(rsvp.user_id);
      return {
        ...rsvp.event,
        rsvp_status: rsvp.status as "going" | "interested",
        friend: {
          id: rsvp.user_id,
          username: friend?.username || "unknown",
          display_name: friend?.display_name || null,
          avatar_url: friend?.avatar_url || null,
        },
      };
    });

    // Group by date for calendar display
    const eventsByDate: Record<string, FriendCalendarEvent[]> = {};
    events.forEach((event) => {
      if (!eventsByDate[event.start_date]) {
        eventsByDate[event.start_date] = [];
      }
      eventsByDate[event.start_date].push(event);
    });

    return NextResponse.json({
      events,
      eventsByDate,
      friends: friendProfiles || [],
    });
  } catch (err) {
    console.error("Friend calendar API error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
