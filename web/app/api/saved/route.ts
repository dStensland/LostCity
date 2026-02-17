import { NextResponse } from "next/server";
import { parseIntParam, validationError, checkBodySize } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { ensureUserProfile } from "@/lib/user-utils";
import { withOptionalAuth, withAuth } from "@/lib/api-middleware";
import { resolvePortalAttributionForWrite } from "@/lib/portal-attribution";
import { logger } from "@/lib/logger";

/**
 * GET /api/saved
 * Check if an item is saved
 */
export const GET = withOptionalAuth(async (request, { user, serviceClient }) => {
  try {
    if (!user || !serviceClient) {
      return NextResponse.json({ saved: false }, { status: 200 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = parseIntParam(searchParams.get("event_id"));
    const venueId = parseIntParam(searchParams.get("venue_id"));

    if (eventId === null && venueId === null) {
      return validationError("Missing or invalid event_id or venue_id");
    }

    let query = serviceClient
      .from("saved_items")
      .select("id")
      .eq("user_id", user.id);

    if (eventId !== null) {
      query = query.eq("event_id", eventId);
    } else if (venueId !== null) {
      query = query.eq("venue_id", venueId);
    }

    const { data } = await query.maybeSingle();

    return NextResponse.json({ saved: !!data }, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    logger.error("Saved check API error", error, { userId: user?.id, component: "saved" });
    return NextResponse.json({ saved: false }, { status: 200 });
  }
});

/**
 * POST /api/saved
 * Save an item
 */
export const POST = withAuth(async (request, { user, serviceClient }) => {
  // Check body size (10KB limit)
  const sizeCheck = checkBodySize(request);
  if (sizeCheck) return sizeCheck;

  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const body = await request.json();
    const { event_id, venue_id } = body;

    // Validate IDs are numbers if provided
    if (event_id !== undefined && (typeof event_id !== "number" || !Number.isInteger(event_id))) {
      return validationError("Invalid event_id");
    }
    if (venue_id !== undefined && (typeof venue_id !== "number" || !Number.isInteger(venue_id))) {
      return validationError("Invalid venue_id");
    }

    if (!event_id && !venue_id) {
      return validationError("Missing event_id or venue_id");
    }

    // Ensure profile exists
    await ensureUserProfile(user, serviceClient);

    const attribution = await resolvePortalAttributionForWrite(request, {
      endpoint: "/api/saved",
      body,
      requireWhenHinted: true,
    });
    if (attribution.response) return attribution.response;
    const portalId = attribution.portalId;

    // Insert saved item
    const insertData: { user_id: string; event_id?: number; venue_id?: number; portal_id?: string } = {
      user_id: user.id,
    };

    if (event_id) insertData.event_id = event_id;
    if (venue_id) insertData.venue_id = venue_id;
    if (portalId) insertData.portal_id = portalId;

    const { error } = await serviceClient
      .from("saved_items")
      .insert(insertData as never);

    if (error) {
      // Might be duplicate - that's OK
      if (error.code === "23505") {
        return NextResponse.json({ success: true, alreadySaved: true });
      }
      logger.error("Save error", error, { userId: user.id, eventId: event_id, venueId: venue_id, component: "saved" });
      return NextResponse.json({ error: "Operation failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Save API error", error, { userId: user.id, component: "saved" });
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
});

/**
 * DELETE /api/saved
 * Remove a saved item
 */
export const DELETE = withAuth(async (request, { user, serviceClient }) => {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  try {
    const { searchParams } = new URL(request.url);
    const eventId = parseIntParam(searchParams.get("event_id"));
    const venueId = parseIntParam(searchParams.get("venue_id"));

    if (eventId === null && venueId === null) {
      return validationError("Missing or invalid event_id or venue_id");
    }

    let query = serviceClient
      .from("saved_items")
      .delete()
      .eq("user_id", user.id);

    if (eventId !== null) {
      query = query.eq("event_id", eventId);
    } else if (venueId !== null) {
      query = query.eq("venue_id", venueId);
    }

    const { error } = await query;

    if (error) {
      logger.error("Unsave error", error, { userId: user.id, eventId, venueId, component: "saved" });
      return NextResponse.json({ error: "Operation failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Unsave API error", error, { userId: user.id, component: "saved" });
    return NextResponse.json({ error: "Failed to unsave" }, { status: 500 });
  }
});
