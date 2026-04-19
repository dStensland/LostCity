import { NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

type GetFriendIdsResult = { friend_id: string }[];

type FriendRsvp = {
  event_id: number;
  user_id: string;
  status: "going" | "maybe";
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
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

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

  // Get friend IDs using the friendships table
  const { data: friendIdsData, error: friendIdsError } = await supabase.rpc(
    "get_friend_ids" as never,
    { user_id: user.id } as never
  ) as { data: GetFriendIdsResult | null; error: Error | null };

  if (friendIdsError) {
    logger.error("Error fetching friend IDs:", friendIdsError);
    return NextResponse.json({ error: "Failed to fetch friends" }, { status: 500 });
  }

  const friendIds = (friendIdsData || []).map((row) => row.friend_id);

  if (friendIds.length === 0) {
    return NextResponse.json({ friends: {} });
  }

  // Step 3: Get RSVPs from friends for the specified events via plan_invitees -> plans
  const { data: inviteesData, error } = await supabase
    .from("plan_invitees")
    .select(`
      user_id,
      rsvp_status,
      user:profiles!plan_invitees_user_id_fkey(
        id,
        username,
        display_name,
        avatar_url
      ),
      plan:plans!inner(
        anchor_event_id,
        anchor_type,
        visibility
      )
    `)
    .in("user_id", friendIds)
    .in("rsvp_status", ["going", "maybe"])
    .eq("plan.anchor_type" as never, "event")
    .in("plan.anchor_event_id" as never, eventIds)
    .in("plan.visibility" as never, ["public", "friends"]);

  if (error) {
    logger.error("Error fetching friend RSVPs:", error);
    return NextResponse.json({ error: "Failed to fetch friend activity" }, { status: 500 });
  }

  // Group by event_id — map plan_invitees shape back to FriendRsvp contract
  const friendsByEvent: Record<number, FriendRsvp[]> = {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (inviteesData || []) as any[]) {
    const plan = row.plan;
    if (!plan?.anchor_event_id || !row.user) continue;
    const eventId: number = plan.anchor_event_id;
    const rsvp: FriendRsvp = {
      event_id: eventId,
      user_id: row.user_id,
      status: row.rsvp_status as "going" | "maybe",
      user: row.user,
    };
    if (!friendsByEvent[eventId]) {
      friendsByEvent[eventId] = [];
    }
    friendsByEvent[eventId].push(rsvp);
  }

  return NextResponse.json({
    friends: friendsByEvent,
  });
}
