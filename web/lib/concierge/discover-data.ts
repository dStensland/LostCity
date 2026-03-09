/**
 * Discover Feed Data Layer
 *
 * Server-side fetcher that reshapes concierge data for the single-surface
 * Discover feed. Replaces the 3-pillar ConciergeExperienceData with a flat
 * DiscoverFeedData object optimized for a scrollable contextual feed.
 */

import type { Portal } from "@/lib/portal-context";
import type {
  DiscoverFeedData,
  PropertyMoment,
  RegularHang,
} from "./concierge-types";
import type { WeatherData } from "@/lib/weather-utils";
import type { AgentNarrative, SignatureVenue } from "@/lib/forth-types";
import { getForthFeed, getForthPropertyData } from "@/lib/forth-data";
import { getPortalWeather } from "@/lib/weather";
import { getConciergeConfig } from "./concierge-config";
import { buildAmbientContext } from "./ambient-context";
import { createClient } from "@/lib/supabase/server";
import { haversineDistanceKm } from "@/lib/geo";
import { getPortalSourceAccess } from "@/lib/federation";
import { applyFederatedPortalScopeToQuery } from "@/lib/portal-scope";
import { getLocalDateString } from "@/lib/formats";
import { isActiveNow, formatTimeWindow } from "@/lib/specials-utils";

// ---------------------------------------------------------------------------
// Property moment computation
// ---------------------------------------------------------------------------

/**
 * Maps SignatureVenue.id → DB venue slug.
 * Some signature venues use a short id (e.g. "elektra") while the DB slug
 * has a disambiguating suffix (e.g. "elektra-forth"). This map handles both
 * the matching case (id === slug) and the mismatch cases.
 */
const SIGNATURE_ID_TO_SLUG: Record<string, string> = {
  "il-premio": "il-premio",
  "elektra": "elektra-forth",
  "bar-premio": "bar-premio",
  "moonlight": "moonlight-forth",
};

/** Minimal shape of venue_specials rows returned from DB. */
type DbPropertySpecial = {
  title: string;
  time_start: string | null;
  time_end: string | null;
  days_of_week: number[] | null;
};

/** Keyed by DB venue slug → array of active specials for that venue. */
type PropertySpecialsMap = Map<string, DbPropertySpecial[]>;

/**
 * Compute property moments for the "At FORTH Hotel" section.
 *
 * Pure function — accepts a pre-fetched specials map so it can be tested
 * without a DB connection. `getDiscoverFeedData` is responsible for fetching
 * and passing the map.
 *
 * Resolution order for each venue:
 *   1. First active (isActiveNow) real special from the DB map.
 *   2. First real special in the map (regardless of active state) for status
 *      derivation — falls through to time window logic.
 *   3. mockSpecial / mockNote fields as backward-compat fallback.
 */
function computePropertyMoments(
  signatureVenues: SignatureVenue[],
  now: Date,
  specialsMap: PropertySpecialsMap = new Map()
): PropertyMoment[] {
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentMinutes = currentHour * 60 + currentMinute;

  return signatureVenues.map((venue) => {
    const dbSlug = SIGNATURE_ID_TO_SLUG[venue.id] ?? venue.id;
    const venueSpecials = specialsMap.get(dbSlug) ?? [];

    // Prefer the first DB special that is currently active.
    const activeSpecial = venueSpecials.find((s) => isActiveNow(s));
    // Fallback: any special in the list (for upcoming status + context lines).
    const bestSpecial = activeSpecial ?? venueSpecials[0] ?? null;

    let specialTitle: string | null;
    let windows: TimeWindow;

    if (bestSpecial) {
      specialTitle = bestSpecial.title;
      windows = timeWindowFromSpecial(bestSpecial);
    } else {
      // No DB specials — fall back to mock fields
      specialTitle = venue.mockSpecial || null;
      windows = getVenueWindowsFromMock(venue);
    }

    const status = computeStatus(currentMinutes, windows);
    const contextLine = buildContextLine(specialTitle, venue, status, windows, currentMinutes, bestSpecial);

    return {
      venue,
      status,
      contextLine,
      specialTitle,
    };
  }).sort((a, b) => {
    const priority: Record<PropertyMoment["status"], number> = {
      active_now: 0,
      starting_soon: 1,
      later: 2,
      closed: 3,
    };
    return priority[a.status] - priority[b.status];
  });
}

type TimeWindow = { open: number; close: number };

/** Convert a DB special's time_start / time_end into a TimeWindow (minutes from midnight). */
function timeWindowFromSpecial(special: DbPropertySpecial): TimeWindow {
  const toMinutes = (t: string | null): number | null => {
    if (!t) return null;
    const [h, m] = t.split(":").map(Number);
    if (Number.isNaN(h)) return null;
    return h * 60 + (m || 0);
  };

  const open = toMinutes(special.time_start);
  const close = toMinutes(special.time_end);
  if (open !== null && close !== null) return { open, close };
  if (open !== null) return { open, close: open + 3 * 60 }; // 3-hour window if no end
  return { open: 16 * 60, close: 23 * 60 }; // generic fallback
}

/** Legacy: derive time window from mockNote text (e.g. "5pm to 7pm"). */
function getVenueWindowsFromMock(venue: SignatureVenue): TimeWindow {
  const note = (venue.mockNote || "").toLowerCase();
  const timeMatch = note.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|–|-)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);

  if (timeMatch) {
    let startH = parseInt(timeMatch[1]);
    const startPeriod = timeMatch[3];
    let endH = parseInt(timeMatch[4]);
    const endPeriod = timeMatch[6];

    if (startPeriod === "pm" && startH < 12) startH += 12;
    if (startPeriod === "am" && startH === 12) startH = 0;
    if (endPeriod === "pm" && endH < 12) endH += 12;
    if (endPeriod === "am" && endH === 12) endH = 0;

    return { open: startH * 60, close: endH * 60 };
  }

  if (venue.kind === "restaurant") {
    return { open: 11 * 60, close: 22 * 60 };
  }
  return { open: 16 * 60, close: 24 * 60 };
}

function computeStatus(
  currentMinutes: number,
  windows: TimeWindow
): PropertyMoment["status"] {
  if (currentMinutes >= windows.open && currentMinutes < windows.close) {
    return "active_now";
  }
  // Starting within 60 minutes
  const timeUntilOpen = windows.open - currentMinutes;
  if (timeUntilOpen > 0 && timeUntilOpen <= 60) {
    return "starting_soon";
  }
  if (currentMinutes < windows.open) {
    return "later";
  }
  return "closed";
}

function buildContextLine(
  specialTitle: string | null,
  venue: SignatureVenue,
  status: PropertyMoment["status"],
  windows: TimeWindow,
  currentMinutes: number,
  special: DbPropertySpecial | null
): string {
  // Build a formatted time range from DB special if available, otherwise derive from window.
  const timeRange = special
    ? formatTimeWindow(special.time_start, special.time_end)
    : null;

  switch (status) {
    case "active_now":
      if (specialTitle && timeRange) {
        return `${specialTitle} · ${timeRange}`;
      }
      if (specialTitle) {
        return `${specialTitle} happening now`;
      }
      return `Open now · ${venue.typeLabel}`;
    case "starting_soon": {
      const minutesUntil = windows.open - currentMinutes;
      if (specialTitle) {
        return `${specialTitle} starts in ${minutesUntil} min`;
      }
      return `Opens in ${minutesUntil} min`;
    }
    case "later": {
      if (specialTitle && timeRange) {
        return `${specialTitle} · ${timeRange}`;
      }
      const openHour = Math.floor(windows.open / 60);
      const period = openHour >= 12 ? "pm" : "am";
      const hour12 = openHour % 12 || 12;
      return `Opens at ${hour12}${period} · ${venue.typeLabel}`;
    }
    case "closed":
      return `${venue.typeLabel} · Check back tomorrow`;
  }
}

// ---------------------------------------------------------------------------
// Regulars query
// ---------------------------------------------------------------------------

async function fetchRegulars(
  portal: Portal,
  geoCenter: [number, number],
  radiusKm: number
): Promise<RegularHang[]> {
  const supabase = await createClient();
  const [centerLat, centerLng] = geoCenter;

  // Bounding box for initial filter (cheaper than haversine at the DB level)
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.max(Math.cos((centerLat * Math.PI) / 180), 0.01));

  // Today's date string — recurring events are instantiated per-date,
  // so querying by start_date is correct (no days_of_week column on events).
  const today = getLocalDateString(new Date());

  // Federation scope — restricts results to sources the portal subscribes to.
  const sourceAccess = await getPortalSourceAccess(portal.id);

  let query = supabase
    .from("events")
    .select(`
      id, title, image_url, start_date, start_time, source_id, category_id,
      venues!inner(name, slug, lat, lng)
    `)
    .eq("start_date", today)
    .not("series_id", "is", null)
    .eq("is_regular_ready", true)
    .is("canonical_event_id", null)
    .or("is_class.eq.false,is_class.is.null")
    .or("is_sensitive.eq.false,is_sensitive.is.null")
    .not("venues.lat", "is", null)
    .not("venues.lng", "is", null)
    .gte("venues.lat", centerLat - latDelta)
    .lte("venues.lat", centerLat + latDelta)
    .gte("venues.lng", centerLng - lngDelta)
    .lte("venues.lng", centerLng + lngDelta)
    .limit(50);

  // Apply portal federation scope to prevent data leakage across portals
  query = applyFederatedPortalScopeToQuery(query, {
    portalId: portal.id,
    sourceIds: sourceAccess.sourceIds,
  }) as typeof query;

  const { data: events } = await query;

  if (!events || events.length === 0) return [];

  type RegularRow = {
    id: number;
    title: string;
    image_url: string | null;
    start_date: string;
    start_time: string | null;
    source_id: number | null;
    category_id: string | null;
    venues: { name: string; slug: string; lat: number; lng: number };
  };

  const rows = events as unknown as RegularRow[];

  return rows
    .map((row) => {
      const venue = row.venues;
      const distKm = haversineDistanceKm(centerLat, centerLng, venue.lat, venue.lng);
      if (distKm > radiusKm) return null;

      // Derive ISO day of week (1=Mon … 7=Sun) from start_date
      const d = new Date(row.start_date + "T12:00:00"); // noon avoids DST edge cases
      const isoDayOfWeek = d.getDay() === 0 ? 7 : d.getDay();

      return {
        id: row.id,
        title: row.title,
        venue_name: venue.name,
        venue_slug: venue.slug,
        day_of_week: isoDayOfWeek,
        start_time: row.start_time,
        activity_type: row.category_id || "event",
        distance_km: Math.round(distKm * 100) / 100,
        image_url: row.image_url,
      } satisfies RegularHang;
    })
    .filter((r): r is RegularHang => r !== null)
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, 8);
}

// ---------------------------------------------------------------------------
// Signature venue specials fetch
// ---------------------------------------------------------------------------

/**
 * Fetch active venue_specials for the given signature venues.
 * Returns a map keyed by DB venue slug → specials array.
 *
 * Steps:
 *   1. Resolve venue slugs from SignatureVenue.id via SIGNATURE_ID_TO_SLUG.
 *   2. Lookup venue DB IDs by slug.
 *   3. Fetch active specials for those IDs.
 *   4. Group by slug for O(1) lookup in computePropertyMoments.
 *
 * Errors are swallowed — on failure we return an empty map and the caller
 * falls back to mock data, so the feature doesn't regress.
 */
async function fetchSignatureVenueSpecials(
  signatureVenues: SignatureVenue[]
): Promise<PropertySpecialsMap> {
  const result: PropertySpecialsMap = new Map();

  if (signatureVenues.length === 0) return result;

  const slugs = signatureVenues
    .map((v) => SIGNATURE_ID_TO_SLUG[v.id] ?? v.id)
    .filter(Boolean);

  if (slugs.length === 0) return result;

  try {
    const supabase = await createClient();

    // 1. Resolve slugs → venue IDs
    const { data: venueRows, error: venueErr } = await supabase
      .from("venues")
      .select("id, slug")
      .in("slug", slugs);

    if (venueErr || !venueRows || venueRows.length === 0) return result;

    const venueIdToSlug = new Map<number, string>();
    const venueIds: number[] = [];
    for (const row of venueRows as { id: number; slug: string }[]) {
      venueIdToSlug.set(row.id, row.slug);
      venueIds.push(row.id);
    }

    // 2. Fetch active specials for those venue IDs
    const { data: specialsRows, error: specialsErr } = await supabase
      .from("venue_specials")
      .select("venue_id, title, time_start, time_end, days_of_week")
      .in("venue_id", venueIds)
      .eq("is_active", true);

    if (specialsErr || !specialsRows) return result;

    // 3. Group by slug
    for (const row of specialsRows as {
      venue_id: number;
      title: string;
      time_start: string | null;
      time_end: string | null;
      days_of_week: number[] | null;
    }[]) {
      const slug = venueIdToSlug.get(row.venue_id);
      if (!slug) continue;
      if (!result.has(slug)) result.set(slug, []);
      result.get(slug)!.push({
        title: row.title,
        time_start: row.time_start,
        time_end: row.time_end,
        days_of_week: row.days_of_week,
      });
    }
  } catch {
    // Non-fatal — fall back to mock data
    return new Map();
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function getDiscoverFeedData(
  portal: Portal
): Promise<DiscoverFeedData> {
  const now = new Date();
  const geoCenter = portal.filters?.geo_center as [number, number] | undefined;
  const radiusKm = (portal.filters?.geo_radius_km as number) || 5;

  // Parallel fetch all data sources
  const [feedData, weather, regulars] = await Promise.all([
    getForthFeed(portal),
    geoCenter?.[0] && geoCenter?.[1]
      ? getPortalWeather(portal.id, geoCenter[0], geoCenter[1])
      : Promise.resolve(null as WeatherData | null),
    geoCenter?.[0] && geoCenter?.[1]
      ? fetchRegulars(portal, geoCenter, radiusKm)
      : Promise.resolve([] as RegularHang[]),
  ]);

  const propertyData = getForthPropertyData(portal);
  const { sections, destinations, agentNarrative } = feedData;
  const { conciergePhone } = propertyData;

  // Extract tonight events from feed sections
  const tonightSection = sections.find(
    (s) => s.slug === "tonight" || s.slug === "today" || s.slug === "this-evening"
  );
  const tonightEvents = tonightSection?.events || [];

  // Extract coming-up events (non-tonight sections)
  const tonightSlugs = new Set(["tonight", "today", "this-evening"]);
  const comingUpEvents = sections
    .filter((s) => !tonightSlugs.has(s.slug || ""))
    .flatMap((s) => s.events);

  // Fetch real venue_specials for signature venues and pass to computePropertyMoments.
  const propertySpecialsMap = await fetchSignatureVenueSpecials(
    propertyData.signatureVenues
  );

  // Compute property moments from signature venues
  const propertyMoments = computePropertyMoments(
    propertyData.signatureVenues,
    now,
    propertySpecialsMap
  );

  // Build ambient context + config
  const ambient = buildAmbientContext(now, weather, portal.name);
  const config = getConciergeConfig(portal, conciergePhone);

  return {
    ambient,
    config,
    propertyData,
    propertyMoments,
    tonightEvents,
    comingUpEvents,
    regulars,
    destinations,
    agentNarrative: agentNarrative as AgentNarrative | null,
  };
}
