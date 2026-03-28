import { NextResponse } from "next/server";
import { checkBodySize, validationError } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { ensureUserProfile } from "@/lib/user-utils";
import { withAuth } from "@/lib/api-middleware";
import { resolvePortalAttributionForWrite } from "@/lib/portal-attribution";
import { logger } from "@/lib/logger";
import { ENABLE_HANGS_V1 } from "@/lib/launch-flags";
import type { CreateHangRequest, UpdateHangRequest } from "@/lib/types/hangs";

const VALID_VISIBILITIES = ["private", "friends", "public"] as const;
const DEFAULT_DURATION_HOURS = 4;
const MAX_DURATION_HOURS = 8;
const MAX_NOTE_LENGTH = 280;

// Venue + event select string reused across GET branches
const VENUE_SELECT = "id, name, slug, image_url, neighborhood, address";
const HANG_WITH_VENUE_SELECT = `*, venue:places(${VENUE_SELECT}), event:events(id, title, start_date)`;

/**
 * POST /api/hangs
 * Create a new hang (active check-in or planned future hang).
 *
 * Active hangs use the end_and_start_hang RPC, which atomically ends any
 * existing active hang and inserts the new one in a single transaction.
 * Planned hangs use a direct insert — no uniqueness constraint applies.
 */
export const POST = withAuth(async (request, { user, serviceClient }) => {
  if (!ENABLE_HANGS_V1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sizeCheck = checkBodySize(request);
  if (sizeCheck) return sizeCheck;

  const rateLimitId = `${user.id}:${getClientIdentifier(request)}`;
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, rateLimitId);
  if (rateLimitResult) return rateLimitResult;

  try {
    const body: CreateHangRequest = await request.json();
    const {
      venue_id,
      event_id,
      note,
      visibility = "friends",
      planned_for,
      duration_hours,
    } = body;

    // --- Validation ---
    if (typeof venue_id !== "number" || !Number.isInteger(venue_id) || venue_id <= 0) {
      return validationError("venue_id is required and must be a positive integer");
    }

    if (event_id !== undefined && event_id !== null) {
      if (typeof event_id !== "number" || !Number.isInteger(event_id) || event_id <= 0) {
        return validationError("event_id must be a positive integer");
      }
    }

    if (note !== undefined && note !== null) {
      if (typeof note !== "string" || note.length > MAX_NOTE_LENGTH) {
        return validationError(`note must be a string of at most ${MAX_NOTE_LENGTH} characters`);
      }
    }

    if (!VALID_VISIBILITIES.includes(visibility as typeof VALID_VISIBILITIES[number])) {
      return validationError("visibility must be private, friends, or public");
    }

    let plannedForDate: Date | null = null;
    if (planned_for !== undefined && planned_for !== null) {
      const parsed = new Date(planned_for);
      if (isNaN(parsed.getTime())) {
        return validationError("planned_for must be a valid ISO timestamp");
      }
      if (parsed.getTime() <= Date.now()) {
        return validationError("planned_for must be a future timestamp");
      }
      plannedForDate = parsed;
    }

    if (duration_hours !== undefined && duration_hours !== null) {
      if (
        typeof duration_hours !== "number" ||
        !Number.isFinite(duration_hours) ||
        duration_hours <= 0 ||
        duration_hours > MAX_DURATION_HOURS
      ) {
        return validationError(`duration_hours must be between 0 and ${MAX_DURATION_HOURS}`);
      }
    }

    // --- Profile + attribution ---
    await ensureUserProfile(user, serviceClient);

    const attribution = await resolvePortalAttributionForWrite(request, {
      endpoint: "/api/hangs",
      body,
      requireWhenHinted: true,
    });
    if (attribution.response) return attribution.response;
    const portalId = attribution.portalId;

    // --- Compute auto_expire_at ---
    const durationMs = (duration_hours ?? DEFAULT_DURATION_HOURS) * 60 * 60 * 1000;
    const baseTime = plannedForDate ?? new Date();
    const autoExpireAt = new Date(baseTime.getTime() + durationMs);

    // --- Create hang ---
    if (plannedForDate) {
      // Planned hang: direct insert. No uniqueness constraint on planned hangs.
      const { data, error } = await serviceClient
        .from("hangs")
        .insert({
          user_id: user.id,
          venue_id,
          event_id: event_id ?? null,
          portal_id: portalId,
          status: "planned",
          visibility,
          note: note ?? null,
          planned_for: plannedForDate.toISOString(),
          auto_expire_at: autoExpireAt.toISOString(),
        } as never)
        .select(HANG_WITH_VENUE_SELECT)
        .single();

      if (error) {
        logger.error("Hang insert error (planned)", error, {
          userId: user.id,
          venueId: venue_id,
          component: "hangs",
        });
        return NextResponse.json({ error: "Failed to create hang" }, { status: 500 });
      }

      return NextResponse.json({ hang: data }, { status: 201 });
    }

    // Active hang: use RPC to atomically end any existing active hang and create this one.
    const { data, error } = await serviceClient.rpc("end_and_start_hang" as never, {
      p_user_id: user.id,
      p_venue_id: venue_id,
      p_event_id: event_id ?? null,
      p_portal_id: portalId,
      p_visibility: visibility,
      p_note: note ?? null,
      p_auto_expire_at: autoExpireAt.toISOString(),
    } as never);

    if (error) {
      logger.error("end_and_start_hang RPC error", error, {
        userId: user.id,
        venueId: venue_id,
        component: "hangs",
      });
      return NextResponse.json({ error: "Failed to create hang" }, { status: 500 });
    }

    // RPC returns a row set. Fetch the created hang with venue/event joined.
    const rpcRow = Array.isArray(data) ? data[0] : data;
    if (!rpcRow) {
      return NextResponse.json({ error: "Failed to create hang" }, { status: 500 });
    }

    const { data: hangWithVenue, error: fetchError } = await serviceClient
      .from("hangs")
      .select(HANG_WITH_VENUE_SELECT)
      .eq("id", rpcRow.id)
      .single();

    if (fetchError) {
      logger.error("Hang fetch after create error", fetchError, {
        userId: user.id,
        hangId: rpcRow.id,
        component: "hangs",
      });
      // Return the bare RPC row rather than 500 — the hang was created.
      return NextResponse.json({ hang: rpcRow }, { status: 201 });
    }

    return NextResponse.json({ hang: hangWithVenue }, { status: 201 });
  } catch (error) {
    logger.error("Hangs POST error", error, { userId: user.id, component: "hangs" });
    return NextResponse.json({ error: "Failed to create hang" }, { status: 500 });
  }
});

/**
 * GET /api/hangs
 * Get the current user's active hang and upcoming planned hangs.
 *
 * Returns:
 *   { active: HangWithVenue | null, planned: HangWithVenue[] }
 */
export const GET = withAuth(async (request, { user, serviceClient }) => {
  if (!ENABLE_HANGS_V1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rateLimitId = `${user.id}:${getClientIdentifier(request)}`;
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, rateLimitId);
  if (rateLimitResult) return rateLimitResult;

  try {
    const now = new Date().toISOString();

    // Active hang — at most one due to DB unique index
    const { data: activeData, error: activeError } = await serviceClient
      .from("hangs")
      .select(HANG_WITH_VENUE_SELECT)
      .eq("user_id", user.id)
      .eq("status", "active")
      .gt("auto_expire_at", now)
      .maybeSingle();

    if (activeError) {
      logger.error("Hangs GET active error", activeError, {
        userId: user.id,
        component: "hangs",
      });
      return NextResponse.json({ error: "Failed to fetch hang" }, { status: 500 });
    }

    // Planned hangs — may be multiple
    const { data: plannedData, error: plannedError } = await serviceClient
      .from("hangs")
      .select(HANG_WITH_VENUE_SELECT)
      .eq("user_id", user.id)
      .eq("status", "planned")
      .gt("planned_for", now)
      .order("planned_for", { ascending: true });

    if (plannedError) {
      logger.error("Hangs GET planned error", plannedError, {
        userId: user.id,
        component: "hangs",
      });
      return NextResponse.json({ error: "Failed to fetch hang" }, { status: 500 });
    }

    return NextResponse.json({
      active: activeData ?? null,
      planned: plannedData ?? [],
    });
  } catch (error) {
    logger.error("Hangs GET error", error, { userId: user.id, component: "hangs" });
    return NextResponse.json({ error: "Failed to fetch hang" }, { status: 500 });
  }
});

/**
 * PATCH /api/hangs
 * Update the active hang (note, visibility) or end it immediately.
 *
 * Body:
 *   { action?: 'end', note?: string, visibility?: HangVisibility }
 */
export const PATCH = withAuth(async (request, { user, serviceClient }) => {
  if (!ENABLE_HANGS_V1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sizeCheck = checkBodySize(request);
  if (sizeCheck) return sizeCheck;

  const rateLimitId = `${user.id}:${getClientIdentifier(request)}`;
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, rateLimitId);
  if (rateLimitResult) return rateLimitResult;

  try {
    const body: UpdateHangRequest = await request.json();
    const { action, note, visibility } = body;

    if (action === "end") {
      // End the active hang
      const { error } = await serviceClient
        .from("hangs")
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
        } as never)
        .eq("user_id", user.id)
        .eq("status", "active");

      if (error) {
        logger.error("Hang end error (PATCH)", error, {
          userId: user.id,
          component: "hangs",
        });
        return NextResponse.json({ error: "Failed to end hang" }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // Partial update: note and/or visibility
    if (note === undefined && visibility === undefined) {
      return validationError("Provide note, visibility, or action to update");
    }

    if (note !== undefined && note !== null) {
      if (typeof note !== "string" || note.length > MAX_NOTE_LENGTH) {
        return validationError(`note must be a string of at most ${MAX_NOTE_LENGTH} characters`);
      }
    }

    if (visibility !== undefined) {
      if (!VALID_VISIBILITIES.includes(visibility as typeof VALID_VISIBILITIES[number])) {
        return validationError("visibility must be private, friends, or public");
      }
    }

    const updates: Record<string, unknown> = {};
    if (note !== undefined) updates.note = note;
    if (visibility !== undefined) updates.visibility = visibility;

    const { data, error } = await serviceClient
      .from("hangs")
      .update(updates as never)
      .eq("user_id", user.id)
      .eq("status", "active")
      .select(HANG_WITH_VENUE_SELECT)
      .maybeSingle();

    if (error) {
      logger.error("Hang update error", error, { userId: user.id, component: "hangs" });
      return NextResponse.json({ error: "Failed to update hang" }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "No active hang found" }, { status: 404 });
    }

    return NextResponse.json({ hang: data });
  } catch (error) {
    logger.error("Hangs PATCH error", error, { userId: user.id, component: "hangs" });
    return NextResponse.json({ error: "Failed to update hang" }, { status: 500 });
  }
});

/**
 * DELETE /api/hangs
 * End the current active hang immediately.
 */
export const DELETE = withAuth(async (request, { user, serviceClient }) => {
  if (!ENABLE_HANGS_V1) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rateLimitId = `${user.id}:${getClientIdentifier(request)}`;
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.write, rateLimitId);
  if (rateLimitResult) return rateLimitResult;

  try {
    const { error } = await serviceClient
      .from("hangs")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
      } as never)
      .eq("user_id", user.id)
      .eq("status", "active");

    if (error) {
      logger.error("Hang delete error", error, { userId: user.id, component: "hangs" });
      return NextResponse.json({ error: "Failed to end hang" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Hangs DELETE error", error, { userId: user.id, component: "hangs" });
    return NextResponse.json({ error: "Failed to end hang" }, { status: 500 });
  }
});
