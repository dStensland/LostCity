import { NextResponse } from "next/server";
import { parseIntParam, validationError, checkBodySize } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { ensureUserProfile } from "@/lib/user-utils";
import { withAuth } from "@/lib/api-middleware";
import { resolvePortalId } from "@/lib/portal-resolution";
import { logger } from "@/lib/logger";

const VALID_STATUSES = ["going", "interested", "went"] as const;
const VALID_VISIBILITIES = ["friends", "public", "private"] as const;

/**
 * POST /api/rsvp
 * Create or update an RSVP
 */
export const POST = withAuth(async (request, { user, serviceClient }) => {
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
    const body = await request.json();
    const { event_id, status, visibility = "friends" } = body;

    // Validate event_id is a number
    if (typeof event_id !== "number" || !Number.isInteger(event_id) || event_id <= 0) {
      return validationError("Invalid event_id");
    }

    if (!status || !VALID_STATUSES.includes(status)) {
      return validationError("Invalid status. Must be: going, interested, or went");
    }

    if (!VALID_VISIBILITIES.includes(visibility)) {
      return validationError("Invalid visibility. Must be: friends, public, or private");
    }

    // Ensure user has a profile (create if missing)
    await ensureUserProfile(user, serviceClient);

    // Resolve portal context (non-blocking — null is OK)
    const portalId = await resolvePortalId(request);

    // Upsert the RSVP
    const { data, error } = await serviceClient
      .from("event_rsvps")
      .upsert(
        {
          user_id: user.id,
          event_id,
          status,
          visibility,
          updated_at: new Date().toISOString(),
          ...(portalId ? { portal_id: portalId } : {}),
        } as never,
        { onConflict: "user_id,event_id" }
      )
      .select()
      .single();

    if (error) {
      logger.error("RSVP upsert error", error, { userId: user.id, eventId: event_id, component: "rsvp" });
      return NextResponse.json(
        { error: "Failed to save RSVP" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, rsvp: data });
  } catch (error) {
    logger.error("RSVP API error", error, { userId: user.id, component: "rsvp" });
    return NextResponse.json(
      { error: "Failed to save RSVP" },
      { status: 500 }
    );
  }
});

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
