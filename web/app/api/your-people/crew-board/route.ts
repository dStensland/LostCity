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
    status: string;
  }[];
};

type DayGroup = {
  date: string;
  day_label: string;
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
