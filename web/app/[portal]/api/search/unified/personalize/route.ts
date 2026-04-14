import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const PersonalizeSchema = z.object({
  eventIds: z.array(z.string().max(64)).max(100).optional(),
  venueIds: z.array(z.string().max(64)).max(100).optional(),
});

export const dynamic = "force-dynamic";
export const maxDuration = 5;

/**
 * CSRF defense via Origin header check. SameSite=Lax cookies block classic
 * form-POST CSRF but NOT cross-site fetch() with credentials. An explicit
 * Origin header comparison catches the latter. Mirrors the helper used in
 * /api/user/recent-searches — kept inline so this route has no new imports.
 */
function isAllowedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false; // modern browsers always send Origin on non-GET
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

/**
 * Private personalization hydration endpoint.
 *
 * POST /{portal}/api/search/unified/personalize
 *
 * Takes a list of event IDs and venue IDs, returns which are saved / which
 * have RSVPs by the authenticated user. Separate from /unified so the
 * public endpoint stays cacheable at the edge. Cache-Control: private, no-store.
 *
 * Per spec §3.3: this is the Option B split-endpoint model — public search
 * payload is deterministic and cacheable; user-specific state hydrates
 * separately via this endpoint after the skeleton paints.
 *
 * Schema notes (verified against production codebase):
 *   - saved_items: columns are user_id, event_id (int4), venue_id (int4).
 *     No item_type discriminator — separate nullable FK columns per entity.
 *   - event_rsvps: columns are user_id, event_id (int4), status.
 *
 * The search service emits string IDs (Candidate.id = string). Client
 * passes those string IDs here; we coerce to integers for the DB queries.
 * Non-numeric IDs are filtered out before querying.
 */
export const POST = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rl = await applyRateLimit(request, RATE_LIMITS.read, `user:${user.id}`);
  if (rl) return rl;

  let body;
  try {
    body = PersonalizeSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid input", detail: err instanceof Error ? err.message : "unknown" },
      { status: 400 }
    );
  }

  // Coerce string IDs → integers. Non-numeric IDs are silently dropped —
  // they can't match integer FK columns in saved_items / event_rsvps.
  const toInts = (ids: string[]): number[] =>
    ids.flatMap((id) => {
      const n = parseInt(id, 10);
      return Number.isFinite(n) && n > 0 ? [n] : [];
    });

  const eventIntIds = toInts(body.eventIds ?? []);
  const venueIntIds = toInts(body.venueIds ?? []);

  // Fetch saved + RSVP state in parallel
  const [savedEvents, rsvpEvents, savedVenues] = await Promise.all([
    eventIntIds.length === 0
      ? Promise.resolve([])
      : serviceClient
          .from("saved_items")
          .select("event_id")
          .eq("user_id", user.id)
          .in("event_id", eventIntIds)
          .not("event_id", "is", null)
          .then((r) => (r.data ?? []) as Array<{ event_id: number }>),
    eventIntIds.length === 0
      ? Promise.resolve([])
      : serviceClient
          .from("event_rsvps")
          .select("event_id, status")
          .eq("user_id", user.id)
          .in("event_id", eventIntIds)
          .then((r) => (r.data ?? []) as Array<{ event_id: number; status: string }>),
    venueIntIds.length === 0
      ? Promise.resolve([])
      : serviceClient
          .from("saved_items")
          .select("venue_id")
          .eq("user_id", user.id)
          .in("venue_id", venueIntIds)
          .not("venue_id", "is", null)
          .then((r) => (r.data ?? []) as Array<{ venue_id: number }>),
  ]);

  const response = NextResponse.json({
    // Return as strings to match the string IDs the client passed in
    savedEventIds: savedEvents.map((r) => String(r.event_id)),
    rsvpEvents: rsvpEvents.map((r) => ({ eventId: String(r.event_id), status: r.status })),
    savedVenueIds: savedVenues.map((r) => String(r.venue_id)),
  });

  response.headers.set("Cache-Control", "private, no-store, must-revalidate");
  return response;
});
