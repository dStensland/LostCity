import { createClient, createPortalScopedClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getLocalDateString } from "@/lib/formats";
import { errorResponse, parseIntParam } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier} from "@/lib/rate-limit";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";
import { applyPortalScopeToQuery, filterByPortalCity } from "@/lib/portal-scope";
import { applyVenueGate } from "@/lib/feed-gate";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const supabase = await createClient();
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(parseIntParam(searchParams.get("limit")) ?? 10, 1), 100);
  const portalExclusive = searchParams.get("portal_exclusive") === "true";
  const portalContext = await resolvePortalQueryContext(supabase, searchParams);
  if (portalContext.hasPortalParamMismatch) {
    return NextResponse.json(
      { error: "portal and portal_id parameters must reference the same portal" },
      { status: 400 }
    );
  }
  const portalClient = await createPortalScopedClient(portalContext.portalId);
  const portalCity = !portalExclusive ? portalContext.filters.city : undefined;

  const venueId = parseInt(id);
  if (isNaN(venueId)) {
    return NextResponse.json({ error: "Invalid venue ID" }, { status: 400 });
  }

  const today = getLocalDateString();

  let query = portalClient
    .from("events")
    .select(`
      id,
      title,
      start_date,
      start_time,
      end_time,
      is_all_day,
      category:category_id,
      series:series_id(slug),
      venue:places(city)
    `)
    .eq("venue_id", venueId)
    .gte("start_date", today)
    .is("canonical_event_id", null) // Only show canonical events, not duplicates
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(limit);

  query = applyPortalScopeToQuery(query, {
    portalId: portalContext.portalId,
    portalExclusive,
    publicOnlyWhenNoPortal: true,
  });

  query = applyVenueGate(query);

  const { data: events, error } = await query;

  if (error) {
    return errorResponse(error, "GET /api/places/[id]/events");
  }

  const scopedEvents = filterByPortalCity(
    (events || []) as Array<{ venue?: { city?: string | null } | null }>,
    portalCity,
    { allowMissingCity: true }
  );

  // Flatten series join into series_slug for the client
  const flatEvents = scopedEvents.map((e: Record<string, unknown>) => {
    const series = e.series as { slug: string } | null;
    const venue = e.venue as unknown;
    void venue;
    return {
      ...e,
      series_slug: series?.slug || null,
      series: undefined,
      venue: undefined,
    };
  });

  return NextResponse.json({ events: flatEvents }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
  });
}
