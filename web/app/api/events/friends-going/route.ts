import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";

type FriendRsvp = {
  event_id: number;
  user_id: string;
  status: "going" | "interested";
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
};

// GET /api/events/friends-going?event_ids=1,2,3
// Returns friends going/interested for the given events
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ friends: {} });
  }

  const { searchParams } = new URL(request.url);
  const eventIdsParam = searchParams.get("event_ids");

  if (!eventIdsParam) {
    return NextResponse.json({ error: "event_ids required" }, { status: 400 });
  }

  const eventIds = eventIdsParam
    .split(",")
    .map((id) => parseInt(id, 10))
    .filter((id) => !isNaN(id) && id > 0);

  if (eventIds.length === 0) {
    return NextResponse.json({ friends: {} });
  }

  const supabase = await createClient();

  // Step 1: Get users I follow (potential friends)
  const { data: following } = await supabase
    .from("follows")
    .select("followed_user_id")
    .eq("follower_id", user.id)
    .not("followed_user_id", "is", null);

  const followingIds = (following || [])
    .map((f) => (f as { followed_user_id: string }).followed_user_id)
    .filter(Boolean);

  if (followingIds.length === 0) {
    return NextResponse.json({ friends: {} });
  }

  // Step 2: Get users who follow me back (mutual = friends)
  const { data: mutualFollows } = await supabase
    .from("follows")
    .select("follower_id")
    .eq("followed_user_id", user.id)
    .in("follower_id", followingIds);

  const friendIds = (mutualFollows || [])
    .map((f) => (f as { follower_id: string }).follower_id)
    .filter(Boolean);

  if (friendIds.length === 0) {
    return NextResponse.json({ friends: {} });
  }

  // Step 3: Get RSVPs from friends for the specified events
  const { data: rsvps, error } = await supabase
    .from("event_rsvps")
    .select(`
      event_id,
      user_id,
      status,
      user:profiles!event_rsvps_user_id_fkey(
        id,
        username,
        display_name,
        avatar_url
      )
    `)
    .in("event_id", eventIds)
    .in("user_id", friendIds)
    .in("status", ["going", "interested"])
    .in("visibility", ["public", "friends"]);

  if (error) {
    console.error("Error fetching friend RSVPs:", error);
    return NextResponse.json({ error: "Failed to fetch friend activity" }, { status: 500 });
  }

  // Group by event_id
  const friendsByEvent: Record<number, FriendRsvp[]> = {};

  for (const rsvp of (rsvps || []) as FriendRsvp[]) {
    if (!friendsByEvent[rsvp.event_id]) {
      friendsByEvent[rsvp.event_id] = [];
    }
    friendsByEvent[rsvp.event_id].push(rsvp);
  }

  return NextResponse.json({
    friends: friendsByEvent,
  });
}
