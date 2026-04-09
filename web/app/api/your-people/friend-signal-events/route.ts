import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

type RsvpRow = {
  user_id: string;
  status: string;
  event: {
    id: number;
    title: string;
    start_date: string;
    start_time: string | null;
    image_url: string | null;
    is_active: boolean;
    canonical_event_id: number | null;
    venue: { name: string } | null;
  } | null;
  user: {
    id: string;
    avatar_url: string | null;
    display_name: string | null;
    username: string;
  } | null;
};

type SaveRow = {
  user_id: string;
  event: {
    id: number;
    title: string;
    start_date: string;
    start_time: string | null;
    image_url: string | null;
    is_active: boolean;
    canonical_event_id: number | null;
    venue: { name: string } | null;
  } | null;
  user: {
    id: string;
    avatar_url: string | null;
    display_name: string | null;
    username: string;
  } | null;
};

type FriendSignalEvent = {
  event_id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  image_url: string | null;
  venue_name: string | null;
  going_count: number;
  interested_count: number;
  friend_avatars: { id: string; avatar_url: string | null; name: string }[];
};

type AggregatedEvent = FriendSignalEvent & { _counted_users: Set<string> };

export const GET = withAuth(async (request, { user, serviceClient }) => {
  const rateLimitId = `${user.id}:${getClientIdentifier(request)}`;
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, rateLimitId);
  if (rateLimitResult) return rateLimitResult;

  const { data: friendIdsData } = await serviceClient.rpc(
    "get_friend_ids" as never,
    { user_id: user.id } as never
  ) as { data: { friend_id: string }[] | null; error: unknown };

  const friendIds = (friendIdsData || []).map((r) => r.friend_id);

  if (friendIds.length === 0) {
    return NextResponse.json({ events: [] });
  }

  const now = new Date();
  const twoWeeks = new Date(now);
  twoWeeks.setDate(now.getDate() + 14);
  const todayStr = now.toISOString().split("T")[0];
  const endStr = twoWeeks.toISOString().split("T")[0];

  // RSVPs from friends (going + interested)
  const { data: rsvpData } = await serviceClient
    .from("event_rsvps")
    .select(`
      user_id, status,
      event:events!event_rsvps_event_id_fkey(
        id, title, start_date, start_time, image_url, is_active, canonical_event_id,
        venue:places(name)
      ),
      user:profiles!event_rsvps_user_id_fkey(id, avatar_url, display_name, username)
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
        id, title, start_date, start_time, image_url, is_active, canonical_event_id,
        venue:places(name)
      ),
      user:profiles!saved_items_user_id_fkey(id, avatar_url, display_name, username)
    `)
    .in("user_id", friendIds)
    .not("event_id", "is", null)
    .gte("event.start_date", todayStr)
    .lte("event.start_date", endStr)
    .limit(100);

  // Aggregate by canonical event ID (or event ID if no canonical)
  const eventMap = new Map<number, AggregatedEvent>();

  for (const rsvp of (rsvpData || []) as unknown as RsvpRow[]) {
    if (!rsvp.event || !rsvp.event.is_active) continue;

    const groupKey = rsvp.event.canonical_event_id ?? rsvp.event.id;

    const existing: AggregatedEvent = eventMap.get(groupKey) || {
      event_id: groupKey,
      title: rsvp.event.title,
      start_date: rsvp.event.start_date,
      start_time: rsvp.event.start_time,
      image_url: rsvp.event.image_url,
      venue_name: rsvp.event.venue?.name || null,
      going_count: 0,
      interested_count: 0,
      friend_avatars: [],
      _counted_users: new Set<string>(),
    };

    if (rsvp.status === "going") existing.going_count++;
    else existing.interested_count++;

    if (rsvp.user) {
      existing._counted_users.add(rsvp.user.id);
      if (!existing.friend_avatars.find((a) => a.id === rsvp.user!.id)) {
        existing.friend_avatars.push({
          id: rsvp.user.id,
          avatar_url: rsvp.user.avatar_url,
          name: rsvp.user.display_name || rsvp.user.username || "",
        });
      }
    }

    eventMap.set(groupKey, existing);
  }

  for (const save of (saveData || []) as unknown as SaveRow[]) {
    if (!save.event || !save.event.is_active) continue;

    const groupKey = save.event.canonical_event_id ?? save.event.id;

    const existing: AggregatedEvent = eventMap.get(groupKey) || {
      event_id: groupKey,
      title: save.event.title,
      start_date: save.event.start_date,
      start_time: save.event.start_time,
      image_url: save.event.image_url,
      venue_name: save.event.venue?.name || null,
      going_count: 0,
      interested_count: 0,
      friend_avatars: [],
      _counted_users: new Set<string>(),
    };

    // Skip count increment if user already counted via RSVP
    if (save.user && !existing._counted_users.has(save.user.id)) {
      existing.interested_count++;
      existing._counted_users.add(save.user.id);
      if (!existing.friend_avatars.find((a) => a.id === save.user!.id)) {
        existing.friend_avatars.push({
          id: save.user.id,
          avatar_url: save.user.avatar_url,
          name: save.user.display_name || save.user.username || "",
        });
      }
    }

    eventMap.set(groupKey, existing);
  }

  const events: FriendSignalEvent[] = Array.from(eventMap.values())
    .map(({ _counted_users: _cu, ...rest }) => rest)
    .sort((a, b) => {
      const aTotal = a.going_count + a.interested_count;
      const bTotal = b.going_count + b.interested_count;
      if (bTotal !== aTotal) return bTotal - aTotal;
      return a.start_date.localeCompare(b.start_date);
    })
    .slice(0, 20);

  return NextResponse.json({ events });
});
