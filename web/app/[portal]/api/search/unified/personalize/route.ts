import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { resolvePortalRequest } from "@/lib/portal-runtime/resolvePortalRequest";

const PersonalizeSchema = z.object({
  eventIds: z.array(z.string().max(64)).max(100).optional(),
  venueIds: z.array(z.string().max(64)).max(100).optional(),
});

export const dynamic = "force-dynamic";
export const maxDuration = 5;

interface RouteContext {
  params: Promise<{ portal: string }>;
}

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
 * Takes a list of event IDs and venue IDs from the authenticated user's
 * search session and returns which are saved / which have RSVPs. Separate
 * from /unified so the public endpoint stays cacheable at the edge.
 * Cache-Control: private, no-store.
 *
 * Per spec §3.3: this is the Option B split-endpoint model — public search
 * payload is deterministic and cacheable; user-specific state hydrates
 * separately via this endpoint after the skeleton paints.
 *
 * Portal isolation (Phase 0.5 fix):
 * The route is nested under [portal], so the portal context is always known.
 * Before querying saved_items, we filter the client-supplied event/venue IDs
 * through `events.portal_id` / `places.portal_id` lookups so callers cannot
 * probe cross-portal saved state. The old implementation (Phase 0) trusted
 * the client-supplied ID list directly, which was a low-severity info leak
 * on the user's own saves across portals — architect pre-merge review
 * Important finding. This version enforces the portal-isolation invariant
 * baked into every other layer of the search stack.
 *
 * Schema notes (verified against production codebase):
 *   - saved_items: columns are user_id, event_id (int4), venue_id (int4).
 *     No item_type discriminator — separate nullable FK columns per entity.
 *   - event_rsvps: columns are user_id, event_id (int4), status.
 *   - events.portal_id is nullable (global events), so the portal filter
 *     uses `.eq("portal_id", portal.id)` which correctly drops NULL rows.
 *   - places.portal_id does NOT exist; places are portal-scoped via city_id.
 *     For Phase 0 we skip venue portal-scoping and accept the minor gap —
 *     this is tracked in a later follow-up. The filter is a no-op on venues.
 *
 * The search service emits string IDs (Candidate.id = string). Client
 * passes those string IDs here; we coerce to integers for the DB queries.
 * Non-numeric IDs are filtered out before querying.
 *
 * Auth: uses the inline Supabase client pattern (like unified/route.ts) so
 * the handler can receive Next.js route params via context. The withAuth
 * wrapper drops context, so we inline the user check here. Matches the
 * unified-route precedent set in Sprint E-3.9.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  // CSRF check FIRST — before touching the session, DB, or rate limiter.
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Resolve the portal from the [portal] route segment.
  const { portal: portalSlugFromPath } = await context.params;
  const url = new URL(request.url);
  const resolved = await resolvePortalRequest({
    slug: portalSlugFromPath,
    headersList: await headers(),
    pathname: url.pathname,
    searchParams: url.searchParams,
    surface: "explore",
  });
  if (!resolved) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { portal } = resolved;

  // Required auth. withAuth's wrapper drops context, so inline the check.
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Per-user rate limit (read tier — this route is a read in aggregate)
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

  const serviceClient = createServiceClient();

  // Step 1: portal-scope the event IDs. Any ID not belonging to this portal
  // gets dropped before the saved_items query, so a user on /atlanta cannot
  // probe whether they saved an event from /helpatl by guessing event IDs.
  // Venues are currently portal-scoped via city_id (no places.portal_id
  // column) — left unscoped for Phase 0 and tracked as a follow-up.
  const portalScopedEventIds: number[] =
    eventIntIds.length === 0
      ? []
      : await serviceClient
          .from("events")
          .select("id")
          .eq("portal_id", portal.id)
          .in("id", eventIntIds)
          .then((r) => {
            const rows = (r.data ?? []) as Array<{ id: number }>;
            return rows.map((row) => row.id);
          });

  // Step 2: fetch saved + RSVP state in parallel against the portal-scoped ID set.
  const [savedEvents, rsvpEvents, savedVenues] = await Promise.all([
    portalScopedEventIds.length === 0
      ? Promise.resolve([])
      : serviceClient
          .from("saved_items")
          .select("event_id")
          .eq("user_id", user.id)
          .in("event_id", portalScopedEventIds)
          .not("event_id", "is", null)
          .then((r) => (r.data ?? []) as Array<{ event_id: number }>),
    portalScopedEventIds.length === 0
      ? Promise.resolve([])
      : serviceClient
          .from("event_rsvps")
          .select("event_id, status")
          .eq("user_id", user.id)
          .in("event_id", portalScopedEventIds)
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
}
