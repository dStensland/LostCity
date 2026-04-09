import { after } from "next/server";
import { NextResponse } from "next/server";
import { parseIntParam, validationError, checkBodySize } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { ensureUserProfile } from "@/lib/user-utils";
import { withAuth } from "@/lib/api-middleware";
import { resolvePortalAttributionForWrite } from "@/lib/portal-attribution";
import { logger } from "@/lib/logger";
import { resolveSessionEngagementContext } from "@/lib/session-engagement";
import { sendPushToUser } from "@/lib/push-notifications";
import { rsvpBodySchema } from "@/lib/validation/schemas";

/**
 * POST /api/rsvp
 * Create or update an RSVP
 */
export const POST = withAuth(
  { body: rsvpBodySchema },
  async (request, { user, serviceClient, validated }) => {
    // Check body size (10KB limit)
    const sizeCheck = checkBodySize(request);
    if (sizeCheck) return sizeCheck;

    // Apply rate limiting
    // Use a per-user identifier so local/dev traffic (often missing forwarded IP headers) doesn't collapse into
    // a single shared "unknown" bucket and trip 429s immediately.
    const rateLimitId = `${user.id}:${getClientIdentifier(request)}`;
    const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, rateLimitId);
    if (rateLimitResult) return rateLimitResult;

    try {
      const { event_id, status, visibility, notify_friends } = validated.body;

      // Ensure user has a profile (create if missing)
      await ensureUserProfile(user, serviceClient);

      const attribution = await resolvePortalAttributionForWrite(request, {
        endpoint: "/api/rsvp",
        body: validated.body,
        requireWhenHinted: true,
      });
      if (attribution.response) return attribution.response;
      const portalId = attribution.portalId;
      const engagementContext = await resolveSessionEngagementContext(serviceClient, event_id);

      // Upsert the RSVP
      const { data, error } = await serviceClient
        .from("event_rsvps")
        .upsert(
          {
            user_id: user.id,
            event_id,
            status,
            visibility,
            engagement_target: engagementContext.engagement_target,
            festival_id: engagementContext.festival_id,
            program_id: engagementContext.program_id,
            updated_at: new Date().toISOString(),
            ...(portalId ? { portal_id: portalId } : {}),
          } as never,
          { onConflict: "user_id,event_id" }
        )
        .select()
        .single();

      if (error) {
        logger.error("RSVP upsert error", error, { userId: user.id, eventId: event_id, component: "rsvp" });
        return NextResponse.json({ error: "Failed to save RSVP" }, { status: 500 });
      }

      // Schedule async notification fan-out AFTER the response is sent.
      // next/server after() ensures the work completes even on Vercel serverless.
      if (notify_friends && status === "going") {
        after(() =>
          notifyFriendsOfJoining(user.id, event_id, serviceClient).catch((err) => {
            logger.error("Friend notification failed", err, { userId: user.id, eventId: event_id, component: "rsvp" });
          })
        );
      }

      return NextResponse.json({ success: true, rsvp: data });
    } catch (error) {
      logger.error("RSVP API error", error, { userId: user.id, component: "rsvp" });
      return NextResponse.json({ error: "Failed to save RSVP" }, { status: 500 });
    }
  }
);

/**
 * DELETE /api/rsvp
 * Remove an RSVP
 */
export const DELETE = withAuth(async (request, { user, serviceClient }) => {
  // Apply rate limiting
  const rateLimitId = `${user.id}:${getClientIdentifier(request)}`;
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, rateLimitId);
  if (rateLimitResult) return rateLimitResult;

  try {
    const { searchParams } = new URL(request.url);
    const eventId = parseIntParam(searchParams.get("event_id"));

    if (eventId === null || eventId <= 0) {
      return validationError("Missing or invalid event_id");
    }

    const { error } = await serviceClient
      .from("event_rsvps")
      .delete()
      .eq("user_id", user.id)
      .eq("event_id", eventId);

    if (error) {
      logger.error("RSVP delete error", error, { userId: user.id, eventId, component: "rsvp" });
      return NextResponse.json(
        { error: "Failed to delete RSVP" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("RSVP delete API error", error, { userId: user.id, component: "rsvp" });
    return NextResponse.json(
      { error: "Failed to remove RSVP" },
      { status: 500 }
    );
  }
});

/**
 * GET /api/rsvp
 * Get user's RSVP for an event
 */
export const GET = withAuth(async (request, { user, serviceClient }) => {
  const rateLimitId = `${user.id}:${getClientIdentifier(request)}`;
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, rateLimitId);
  if (rateLimitResult) return rateLimitResult;

  try {
    const { searchParams } = new URL(request.url);
    const eventId = parseIntParam(searchParams.get("event_id"));

    if (eventId === null || eventId <= 0) {
      return validationError("Missing or invalid event_id");
    }

    const { data, error } = await serviceClient
      .from("event_rsvps")
      .select("*")
      .eq("user_id", user.id)
      .eq("event_id", eventId)
      .maybeSingle();

    if (error) {
      logger.error("RSVP fetch error", error, { userId: user.id, eventId, component: "rsvp" });
      return NextResponse.json(
        { error: "Failed to fetch RSVP" },
        { status: 500 }
      );
    }

    return NextResponse.json({ rsvp: data });
  } catch (error) {
    logger.error("RSVP get API error", error, { userId: user.id, component: "rsvp" });
    return NextResponse.json(
      { error: "Failed to fetch RSVP" },
      { status: 500 }
    );
  }
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function notifyFriendsOfJoining(userId: string, eventId: number, serviceClient: any) {
  // Get user's display name
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("display_name, username")
    .eq("id", userId)
    .single();

  const name = profile?.display_name || profile?.username || "Someone";

  // Get event title
  const { data: event } = await serviceClient
    .from("events")
    .select("title")
    .eq("id", eventId)
    .single();

  if (!event) return;

  // Get friends who are going to this event
  const { data: friendIdsData } = await serviceClient.rpc(
    "get_friend_ids" as never,
    { user_id: userId } as never
  ) as { data: { friend_id: string }[] | null; error: unknown };

  const friendIds = (friendIdsData || []).map((r: { friend_id: string }) => r.friend_id);
  if (friendIds.length === 0) return;

  // Find friends who RSVPed to this event
  const { data: attendingFriends } = await serviceClient
    .from("event_rsvps")
    .select("user_id")
    .eq("event_id", eventId)
    .in("user_id", friendIds)
    .eq("status", "going");

  if (!attendingFriends || attendingFriends.length === 0) return;

  // Throttle: check if we already notified each friend about this event in last 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  for (const friend of attendingFriends as { user_id: string }[]) {
    // Check throttle
    const { data: existing } = await serviceClient
      .from("notifications")
      .select("id")
      .eq("user_id", friend.user_id)
      .eq("event_id", eventId)
      .eq("type", "friend_joining")
      .gte("created_at", oneDayAgo)
      .limit(1);

    if (existing && existing.length > 0) continue; // Already notified

    // Insert notification
    await serviceClient.from("notifications").insert({
      user_id: friend.user_id,
      type: "friend_joining",
      event_id: eventId,
      actor_id: userId,
      message: `${name} is joining you at ${event.title}!`,
    } as never);

    // Push notification (fire-and-forget)
    sendPushToUser(friend.user_id, {
      title: "Your People",
      body: `${name} is joining you at ${event.title}!`,
      url: `/events/${eventId}`,
      tag: `friend-joining-${eventId}`,
    }).catch(() => {}); // Silently ignore push failures
  }
}
