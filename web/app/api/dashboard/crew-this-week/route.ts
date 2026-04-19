import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

// In-memory cache
const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 60_000; // 60s

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check cache
  const cacheKey = `crew-week:${user.id}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return NextResponse.json(cached.data);
  }

  const supabase = await createClient();

  // Get friend IDs
  const { data: friendIdsData } = await supabase.rpc(
    "get_friend_ids" as never,
    { user_id: user.id } as never
  ) as { data: { friend_id: string }[] | null; error: unknown };

  const friendIds = (friendIdsData || []).map((r) => r.friend_id);

  if (friendIds.length === 0) {
    const empty = { crew: [], totalFriendsWithPlans: 0, latestActivityAt: null };
    cache.set(cacheKey, { data: empty, expiry: Date.now() + CACHE_TTL });
    return NextResponse.json(empty);
  }

  // Get RSVPs from friends for events this week
  const now = new Date();
  const endOfWeek = new Date(now);
  endOfWeek.setDate(now.getDate() + (7 - now.getDay())); // End of week (Sunday)
  endOfWeek.setHours(23, 59, 59, 999);

  const todayStr = now.toISOString().split("T")[0];
  const endStr = endOfWeek.toISOString().split("T")[0];

  const { data: rsvpData } = await supabase
    .from("plan_invitees")
    .select(`
      user_id,
      rsvp_status,
      invited_at,
      user:profiles!plan_invitees_user_id_fkey(
        id, username, display_name, avatar_url
      ),
      plan:plans!inner(
        anchor_type,
        event:events!plans_anchor_event_id_fkey(
          id, title, start_date, venue:places(name)
        )
      )
    `)
    .in("user_id", friendIds)
    .in("rsvp_status", ["going", "maybe"])
    .eq("plan.anchor_type" as never, "event")
    .gte("plan.event.start_date" as never, todayStr)
    .lte("plan.event.start_date" as never, endStr)
    .order("invited_at", { ascending: false })
    .limit(50);

  type CrewRsvpRow = {
    user_id: string;
    rsvp_status: string;
    invited_at: string;
    plan: {
      anchor_type: string;
      event: {
        id: number;
        title: string;
        start_date: string;
        venue: { name: string } | null;
      } | null;
    } | null;
    user: {
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    } | null;
  };

  const rsvps = (rsvpData || []) as unknown as CrewRsvpRow[];

  // Group by user
  const userMap = new Map<string, {
    user: NonNullable<CrewRsvpRow["user"]>;
    events: { id: number; title: string; start_date: string; venue_name: string | null }[];
  }>();

  let latestActivityAt: string | null = null;

  for (const rsvp of rsvps) {
    const event = rsvp.plan?.event;
    if (!rsvp.user || !event) continue;

    if (!latestActivityAt || rsvp.invited_at > latestActivityAt) {
      latestActivityAt = rsvp.invited_at;
    }

    const existing = userMap.get(rsvp.user.id);
    const eventInfo = {
      id: event.id,
      title: event.title,
      start_date: event.start_date,
      venue_name: event.venue?.name || null,
    };

    if (existing) {
      if (!existing.events.find((e) => e.id === eventInfo.id)) {
        existing.events.push(eventInfo);
      }
    } else {
      userMap.set(rsvp.user.id, {
        user: rsvp.user,
        events: [eventInfo],
      });
    }
  }

  const crew = Array.from(userMap.values()).slice(0, 10);

  const result = {
    crew,
    totalFriendsWithPlans: userMap.size,
    latestActivityAt,
  };

  cache.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL });

  return NextResponse.json(result);
}
