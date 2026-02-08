import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";

export const GET = withAuth(async (request, { user, serviceClient }) => {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  // Get current user's friends
  const { data: friendships } = await serviceClient
    .from("friendships")
    .select("user_id, friend_id")
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

  const friendIds = new Set<string>();
  for (const f of (friendships || []) as Array<{ user_id: string; friend_id: string }>) {
    if (f.user_id === user.id) friendIds.add(f.friend_id);
    else friendIds.add(f.user_id);
  }

  // Get pending requests to exclude
  const { data: pendingRequests } = await serviceClient
    .from("friend_requests")
    .select("sender_id, receiver_id")
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .eq("status", "pending");

  const excludeIds = new Set<string>([user.id, ...friendIds]);
  for (const r of (pendingRequests || []) as Array<{ sender_id: string; receiver_id: string }>) {
    excludeIds.add(r.sender_id);
    excludeIds.add(r.receiver_id);
  }

  type Suggestion = {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    mutual_friends_count: number;
    suggestion_reason: "mutual_friends" | "similar_activity";
  };

  const suggestions: Suggestion[] = [];
  const seenIds = new Set<string>();

  // Strategy 1: Friends-of-friends
  if (friendIds.size > 0) {
    const friendIdArray = Array.from(friendIds);
    const { data: fofData } = await serviceClient
      .from("friendships")
      .select("user_id, friend_id")
      .or(
        friendIdArray.map((id) => `user_id.eq.${id}`).join(",") +
        "," +
        friendIdArray.map((id) => `friend_id.eq.${id}`).join(",")
      );

    // Count mutual friends per candidate
    const mutualCounts = new Map<string, number>();
    for (const f of (fofData || []) as Array<{ user_id: string; friend_id: string }>) {
      const candidateId = friendIds.has(f.user_id) ? f.friend_id : f.user_id;
      if (!excludeIds.has(candidateId)) {
        mutualCounts.set(candidateId, (mutualCounts.get(candidateId) || 0) + 1);
      }
    }

    // Get top candidates by mutual friend count
    const topCandidates = Array.from(mutualCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    if (topCandidates.length > 0) {
      const candidateIds = topCandidates.map(([id]) => id);
      const { data: profiles } = await serviceClient
        .from("profiles")
        .select("id, username, display_name, avatar_url, bio")
        .in("id", candidateIds);

      for (const p of (profiles || []) as Array<{
        id: string;
        username: string;
        display_name: string | null;
        avatar_url: string | null;
        bio: string | null;
      }>) {
        if (!seenIds.has(p.id)) {
          seenIds.add(p.id);
          suggestions.push({
            ...p,
            mutual_friends_count: mutualCounts.get(p.id) || 0,
            suggestion_reason: "mutual_friends",
          });
        }
      }
    }
  }

  // Strategy 2: Users who RSVP'd to same events (fill up to 10)
  if (suggestions.length < 10) {
    const { data: myRsvps } = await serviceClient
      .from("event_rsvps")
      .select("event_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (myRsvps && myRsvps.length > 0) {
      const eventIds = (myRsvps as Array<{ event_id: number }>).map((r) => r.event_id);

      const { data: coAttendees } = await serviceClient
        .from("event_rsvps")
        .select("user_id")
        .in("event_id", eventIds)
        .neq("user_id", user.id)
        .limit(50);

      const attendeeCounts = new Map<string, number>();
      for (const a of (coAttendees || []) as Array<{ user_id: string }>) {
        if (!excludeIds.has(a.user_id) && !seenIds.has(a.user_id)) {
          attendeeCounts.set(a.user_id, (attendeeCounts.get(a.user_id) || 0) + 1);
        }
      }

      const topAttendees = Array.from(attendeeCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10 - suggestions.length);

      if (topAttendees.length > 0) {
        const attendeeIds = topAttendees.map(([id]) => id);
        const { data: profiles } = await serviceClient
          .from("profiles")
          .select("id, username, display_name, avatar_url, bio")
          .in("id", attendeeIds);

        for (const p of (profiles || []) as Array<{
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
        }>) {
          if (!seenIds.has(p.id)) {
            seenIds.add(p.id);
            suggestions.push({
              ...p,
              mutual_friends_count: 0,
              suggestion_reason: "similar_activity",
            });
          }
        }
      }
    }
  }

  return NextResponse.json({ suggestions: suggestions.slice(0, 10) });
});
