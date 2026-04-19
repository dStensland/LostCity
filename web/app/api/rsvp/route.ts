import { after } from "next/server";
import { NextResponse } from "next/server";
import { parseIntParam, validationError, checkBodySize } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { ensureUserProfile } from "@/lib/user-utils";
import { withAuth } from "@/lib/api-middleware";
import { resolvePortalAttributionForWrite } from "@/lib/portal-attribution";
import { logger } from "@/lib/logger";
import { sendPushToUser } from "@/lib/push-notifications";
import { rsvpBodySchema } from "@/lib/validation/schemas";

// ---------------------------------------------------------------------------
// DEPRECATED ROUTE — /api/rsvp
// All handlers emit a warn so Phase 7 can gate on 7-day silence in these logs.
// Internal writes are proxied to the plans + plan_invitees model.
// External request/response shapes are preserved for consumer compat.
// ---------------------------------------------------------------------------

/**
 * POST /api/rsvp
 *
 * Proxied to plans model:
 *   - status='going'       → creates a plan + creator plan_invitees row
 *   - status='interested'  → 400 deprecated
 *   - status='went'        → 400 deprecated
 *
 * Idempotent: if user already has an active/planning plan for this event,
 * returns 200 success without creating a duplicate.
 */
export const POST = withAuth(
  { body: rsvpBodySchema },
  async (request, { user, serviceClient, validated }) => {
    // Body size guard
    const sizeCheck = checkBodySize(request);
    if (sizeCheck) return sizeCheck;

    // Rate limit
    const rateLimitId = `${user.id}:${getClientIdentifier(request)}`;
    const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, rateLimitId);
    if (rateLimitResult) return rateLimitResult;

    // Portal attribution guard — portal_id is derived from the event entity below,
    // but we call the shared guard for infrastructure coverage compliance.
    await resolvePortalAttributionForWrite(request, {
      endpoint: "/api/rsvp",
      allowMissing: true,
    });

    // Deprecation log — every call
    logger.warn("deprecated route: /api/rsvp", {
      route: "/api/rsvp",
      method: request.method,
      caller: request.headers.get("referer") ?? null,
      ua: request.headers.get("user-agent") ?? null,
    });

    try {
      const { event_id, status, notify_friends } = validated.body;

      // Only 'going' is migrated; other statuses are deprecated without migration path.
      if (status !== "going") {
        return NextResponse.json(
          {
            error: `Deprecated: RSVP status '${status}' removed in consolidation. Use /api/saved for bookmarks (feature not yet re-implemented).`,
          },
          { status: 400 }
        );
      }

      // Ensure user profile exists before FK operations
      await ensureUserProfile(user, serviceClient);

      // Look up event to get portal_id + start_date
      const { data: event, error: eventErr } = await serviceClient
        .from("events")
        .select("portal_id, start_date")
        .eq("id", event_id as never)
        .maybeSingle();

      if (eventErr || !event) {
        logger.error("RSVP: event lookup failed", eventErr, { userId: user.id, eventId: event_id, component: "rsvp" });
        return NextResponse.json({ error: "Event not found" }, { status: 404 });
      }

      const eventData = event as { portal_id: string; start_date: string | null };
      const portalId = eventData.portal_id;
      const startsAt = eventData.start_date ?? new Date().toISOString();

      // Idempotency check: does user already have an active/planning plan for this event?
      const { data: existingPlan } = await serviceClient
        .from("plans")
        .select("id")
        .eq("creator_id", user.id as never)
        .eq("anchor_event_id", event_id as never)
        .in("status", ["planning", "active"] as never)
        .maybeSingle();

      if (existingPlan) {
        // Already planned — return success without creating a duplicate
        const existing = existingPlan as { id: string };
        return NextResponse.json({ success: true, rsvp: { plan_id: existing.id, user_id: user.id, event_id, status: "going" } });
      }

      // Also check if they're an invitee on someone else's plan for this event
      const { data: existingInvite } = await serviceClient
        .from("plan_invitees")
        .select("plan_id, plans!inner(id, anchor_event_id, status)")
        .eq("user_id", user.id as never)
        .eq("rsvp_status", "going" as never)
        .eq("plans.anchor_event_id", event_id as never)
        .in("plans.status", ["planning", "active"] as never)
        .maybeSingle();

      if (existingInvite) {
        const invite = existingInvite as { plan_id: string };
        return NextResponse.json({ success: true, rsvp: { plan_id: invite.plan_id, user_id: user.id, event_id, status: "going" } });
      }

      // Create a new plan
      const { data: planInsert, error: planErr } = await serviceClient
        .from("plans")
        .insert({
          creator_id: user.id,
          portal_id: portalId,
          anchor_event_id: event_id,
          starts_at: startsAt,
          visibility: "friends",
          updated_by: user.id,
        } as never)
        .select("id")
        .single();

      if (planErr || !planInsert) {
        logger.error("RSVP: plan insert failed", planErr, { userId: user.id, eventId: event_id, component: "rsvp" });
        return NextResponse.json({ error: "Failed to save RSVP" }, { status: 500 });
      }

      const plan = planInsert as { id: string };

      // Creator invitee row
      const { error: inviteeErr } = await serviceClient
        .from("plan_invitees")
        .insert({
          plan_id: plan.id,
          user_id: user.id,
          rsvp_status: "going",
          invited_by: user.id,
          responded_at: new Date().toISOString(),
        } as never);

      if (inviteeErr) {
        // Cleanup orphaned plan
        await serviceClient.from("plans").delete().eq("id", plan.id as never);
        logger.error("RSVP: invitee insert failed", inviteeErr, { userId: user.id, eventId: event_id, component: "rsvp" });
        return NextResponse.json({ error: "Failed to save RSVP" }, { status: 500 });
      }

      // Async friend notifications (fire-and-forget, post-response)
      if (notify_friends) {
        after(() =>
          notifyFriendsOfJoining(user.id, event_id, serviceClient).catch((err) => {
            logger.error("Friend notification failed", err, { userId: user.id, eventId: event_id, component: "rsvp" });
          })
        );
      }

      return NextResponse.json({
        success: true,
        rsvp: { plan_id: plan.id, user_id: user.id, event_id, status: "going" },
      });
    } catch (error) {
      logger.error("RSVP API error", error, { userId: user.id, component: "rsvp" });
      return NextResponse.json({ error: "Failed to save RSVP" }, { status: 500 });
    }
  }
);

/**
 * DELETE /api/rsvp
 *
 * Soft-cancels the user's plan for the given event.
 * Idempotent: if no matching active plan found, returns success.
 */
export const DELETE = withAuth(async (request, { user, serviceClient }) => {
  const rateLimitId = `${user.id}:${getClientIdentifier(request)}`;
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, rateLimitId);
  if (rateLimitResult) return rateLimitResult;

  // Deprecation log
  logger.warn("deprecated route: /api/rsvp", {
    route: "/api/rsvp",
    method: request.method,
    caller: request.headers.get("referer") ?? null,
    ua: request.headers.get("user-agent") ?? null,
  });

  try {
    const { searchParams } = new URL(request.url);
    const eventId = parseIntParam(searchParams.get("event_id"));

    if (eventId === null || eventId <= 0) {
      return validationError("Missing or invalid event_id");
    }

    // Find active/planning plan created by this user for this event
    const { data: plan } = await serviceClient
      .from("plans")
      .select("id")
      .eq("creator_id", user.id as never)
      .eq("anchor_event_id", eventId as never)
      .in("status", ["planning", "active"] as never)
      .maybeSingle();

    if (!plan) {
      // Nothing to cancel — idempotent success
      return NextResponse.json({ success: true });
    }

    const planRow = plan as { id: string };

    const { error } = await serviceClient
      .from("plans")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
      } as never)
      .eq("id", planRow.id as never);

    if (error) {
      logger.error("RSVP delete error", error, { userId: user.id, eventId, component: "rsvp" });
      return NextResponse.json({ error: "Failed to delete RSVP" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("RSVP delete API error", error, { userId: user.id, component: "rsvp" });
    return NextResponse.json({ error: "Failed to remove RSVP" }, { status: 500 });
  }
});

/**
 * GET /api/rsvp
 *
 * Reads from the event_rsvps compat VIEW (SELECT over plans + plan_invitees).
 * Supports:
 *   - ?check=ever_rsvped  — has the user ever created a plan?
 *   - ?event_id=N         — get user's RSVP row for a specific event
 */
export const GET = withAuth(async (request, { user, serviceClient }) => {
  const rateLimitId = `${user.id}:${getClientIdentifier(request)}`;
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, rateLimitId);
  if (rateLimitResult) return rateLimitResult;

  // Deprecation log
  logger.warn("deprecated route: /api/rsvp", {
    route: "/api/rsvp",
    method: request.method,
    caller: request.headers.get("referer") ?? null,
    ua: request.headers.get("user-agent") ?? null,
  });

  try {
    const { searchParams } = new URL(request.url);

    // Check if user has ever RSVPed (empty state detection)
    if (searchParams.get("check") === "ever_rsvped") {
      const { count } = await serviceClient
        .from("event_rsvps")
        .select("user_id", { count: "exact", head: true })
        .eq("user_id", user.id);
      return NextResponse.json({ hasRsvped: (count ?? 0) > 0 });
    }

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
      return NextResponse.json({ error: "Failed to fetch RSVP" }, { status: 500 });
    }

    return NextResponse.json({ rsvp: data });
  } catch (error) {
    logger.error("RSVP get API error", error, { userId: user.id, component: "rsvp" });
    return NextResponse.json({ error: "Failed to fetch RSVP" }, { status: 500 });
  }
});

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

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

  // Find friends who have a going plan for this event (read from compat view)
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

    if (existing && existing.length > 0) continue;

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
