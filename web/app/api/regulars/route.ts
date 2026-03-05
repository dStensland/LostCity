/**
 * GET /api/regulars
 *
 * Returns recurring weekly events (series_id IS NOT NULL) for the next 7 days.
 * Used by the Regulars Find tab. Mirrors the city-pulse recurring query
 * but returns raw events for client-side activity-type matching.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createPortalScopedClient } from "@/lib/supabase/server";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";
import {
  applyFederatedPortalScopeToQuery,
  filterByPortalCity,
  parsePortalContentFilters,
  filterByPortalContentScope,
} from "@/lib/portal-scope";
import { getPortalSourceAccess } from "@/lib/federation";
import { getLocalDateString } from "@/lib/formats";
import { getSharedCacheJson, setSharedCacheJson } from "@/lib/shared-cache";
import {
  dedupeEventsById,
  filterOutInactiveVenueEvents,
} from "@/lib/event-feed-health";
import { applyVenueGate } from "@/lib/feed-gate";

const CACHE_NAMESPACE = "api:regulars";
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 min
const CACHE_CONTROL = "public, s-maxage=180, stale-while-revalidate=360";

const EVENT_SELECT = `
  id, title, start_date, start_time, end_date, end_time,
  is_all_day, is_free, price_min, price_max,
  category:category_id, genres, tags, image_url,
  series_id, source_id,
  is_recurring, recurrence_rule,
  series:series_id(id, frequency, day_of_week, series_type),
  venue:venues(id, name, neighborhood, slug, venue_type, city, image_url, active)
`;

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = new URL(request.url);

  // Optional weekday filter: "monday", "tuesday,wednesday", etc.
  const weekdayParam = searchParams.get("weekday");
  const portalExclusive = searchParams.get("portal_exclusive") === "true";

  const supabase = await createClient();
  const portalContext = await resolvePortalQueryContext(supabase, searchParams);
  if (portalContext.hasPortalParamMismatch) {
    return NextResponse.json(
      { error: "portal and portal_id parameters must reference the same portal" },
      { status: 400 },
    );
  }
  const portalId = portalContext.portalId;
  const portalClient = await createPortalScopedClient(portalId);
  const sourceAccess = portalId ? await getPortalSourceAccess(portalId) : null;
  const portalCity = !portalExclusive ? portalContext.filters.city : undefined;
  const portalContentFilters = parsePortalContentFilters(
    portalContext.filters as Record<string, unknown> | null,
  );

  // Date range: today through +7 days (portal-local time, not UTC)
  const now = new Date();
  const today = getLocalDateString(now);
  const weekAhead = getLocalDateString(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));

  // Cache
  const cacheBucket = Math.floor(Date.now() / CACHE_TTL_MS);
  const cacheKey = [
    portalId || "no-portal",
    portalCity || "all-cities",
    weekdayParam || "all-days",
    cacheBucket,
  ].join("|");

  const cached = await getSharedCacheJson<{ events: unknown[] }>(
    CACHE_NAMESPACE,
    cacheKey,
  );
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "Cache-Control": CACHE_CONTROL },
    });
  }

  // Build query — recurring events only, excluding non-hang categories
  // (film showtimes, theater runs, community activism, etc. have series_id
  // but aren't "regular hangs" — they dominate the results otherwise)
  let query = portalClient
    .from("events")
    .select(EVENT_SELECT)
    .gte("start_date", today)
    .lte("start_date", weekAhead)
    .not("series_id", "is", null)
    .is("canonical_event_id", null)
    .or("is_class.eq.false,is_class.is.null")
    .or("is_sensitive.eq.false,is_sensitive.is.null")
    .not("category_id", "in", "(film,theater,community,wellness,family,learning)")
    .not("tags", "cs", '{"class"}'); // Exclude class-tagged events (paint-and-sip, workshops)

  query = applyVenueGate(query);

  // Apply portal scope (federation, city filter)
  if (sourceAccess) {
    query = applyFederatedPortalScopeToQuery(query, sourceAccess) as typeof query;
  }

  // Optional weekday filtering — compute target dates
  if (weekdayParam) {
    const targetDates = computeWeekdayDates(weekdayParam, today, weekAhead);
    if (targetDates.length > 0) {
      query = query.in("start_date", targetDates);
    }
  }

  query = query
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(5000);

  const { data: rawEvents, error } = await query;

  if (error) {
    console.error("[regulars] Query error:", error.message);
    return NextResponse.json(
      { error: "Failed to fetch regulars" },
      { status: 500 },
    );
  }

  // Post-query filtering
  type EventRow = {
    id: number;
    venue?: { city?: string | null; active?: boolean | null } | null;
    [key: string]: unknown;
  };
  let events = (rawEvents ?? []) as EventRow[];

  // Filter by portal city if needed
  if (portalCity) {
    events = filterByPortalCity(events, portalCity) as EventRow[];
  }

  // Filter by portal content scope
  if (portalContentFilters) {
    events = filterByPortalContentScope(events, portalContentFilters) as EventRow[];
  }

  // Dedup & health
  events = dedupeEventsById(events);
  events = filterOutInactiveVenueEvents(events) as EventRow[];

  const payload = { events };

  // Cache the result
  await setSharedCacheJson(CACHE_NAMESPACE, cacheKey, payload, CACHE_TTL_MS);

  return NextResponse.json(payload, {
    headers: { "Cache-Control": CACHE_CONTROL },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/** Given comma-separated weekday names and a date range, return all matching dates. */
function computeWeekdayDates(
  weekdayParam: string,
  startDate: string,
  endDate: string,
): string[] {
  const targetDays = weekdayParam
    .toLowerCase()
    .split(",")
    .map((d) => WEEKDAY_MAP[d.trim()])
    .filter((d) => d !== undefined);

  if (targetDays.length === 0) return [];

  const dates: string[] = [];
  const current = new Date(startDate + "T12:00:00"); // noon avoids DST edge cases
  const end = new Date(endDate + "T12:00:00");

  while (current <= end) {
    if (targetDays.includes(current.getDay())) {
      dates.push(getLocalDateString(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}
