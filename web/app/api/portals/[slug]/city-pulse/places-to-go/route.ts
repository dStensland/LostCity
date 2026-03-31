/**
 * GET /api/portals/[slug]/city-pulse/places-to-go
 *
 * Returns the Places to Go section for the CityPulse feed.
 * Groups active places into 12 categories, scores each by contextual fit
 * and activity, and returns the top 3 per category with callout strings
 * and category-level summaries.
 *
 * Cache: 30 min, keyed by portal + time slot + date.
 * Below-the-fold — does not block the initial feed render.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, createPortalScopedClient } from "@/lib/supabase/server";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import {
  normalizePortalSlug,
  resolvePortalSlugAlias,
} from "@/lib/portal-aliases";
import { buildPortalManifest } from "@/lib/portal-manifest";
import { applyManifestFederatedScopeToQuery } from "@/lib/portal-scope";
import { getPortalSourceAccess } from "@/lib/federation";
import { getLocalDateString, getLocalDateStringOffset } from "@/lib/formats";
import { getSharedCacheJson, setSharedCacheJson } from "@/lib/shared-cache";
import { applyFeedGate } from "@/lib/feed-gate";
import { isOpenAt, type HoursData } from "@/lib/hours";
import type { CurrentWeatherResponse } from "@/app/api/weather/current/route";
import {
  PLACES_TO_GO_CATEGORIES,
  ALL_PLACES_TO_GO_TYPES,
  getCategoryKeyForPlaceType,
  buildSeeAllHref,
  CHAIN_VENUE_PREFIXES,
} from "@/lib/places-to-go/constants";
import {
  scorePlaceForCategory,
  passesQualityGate,
} from "@/lib/places-to-go/scoring";
import { buildCallouts, buildSummary } from "@/lib/places-to-go/callouts";
import type {
  PlacesToGoResponse,
  PlacesToGoCategory,
  PlacesToGoCard,
  PlaceContext,
} from "@/lib/places-to-go/types";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CACHE_NAMESPACE = "places-to-go";
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=3600";

function getTimeSlot(hour: number): string {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "late_night";
}

const PLACE_SELECT = `
  id, name, slug, place_type, neighborhood, image_url, hours, vibes, cuisine,
  created_at, is_active, indoor_outdoor, nearest_marta_station, description,
  short_description, city,
  place_profile(featured, library_pass),
  place_vertical_details(outdoor)
`;

type Props = { params: Promise<{ slug: string }> };

// ---------------------------------------------------------------------------
// Row shapes from Supabase
// ---------------------------------------------------------------------------

type PlaceRow = {
  id: number;
  name: string;
  slug: string;
  place_type: string | null;
  neighborhood: string | null;
  image_url: string | null;
  hours: HoursData | null;
  vibes: string[] | null;
  cuisine: string | null;
  created_at: string | null;
  is_active: boolean | null;
  indoor_outdoor: "indoor" | "outdoor" | "both" | null;
  nearest_marta_station: string | null;
  description: string | null;
  short_description: string | null;
  city: string | null;
  place_profile: {
    featured: boolean | null;
    library_pass: unknown | null;
  } | null;
  place_vertical_details: {
    outdoor: OutdoorDetails | null;
  } | null;
};

type OutdoorDetails = {
  difficulty?: string | null;
  drive_time_minutes?: number | null;
  best_seasons?: string[] | null;
  weather_fit_tags?: string[] | null;
  best_time_of_day?: string | null;
};

type EventCountRow = {
  place_id: number;
  title: string | null;
  start_date: string | null;
};

type SpecialRow = {
  place_id: number;
  title: string;
  type: string;
  days_of_week: number[] | null;
  time_start: string | null;
  time_end: string | null;
};

type OccasionRow = {
  place_id: number;
  occasion: string;
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await params;
  const canonicalSlug = resolvePortalSlugAlias(normalizePortalSlug(slug));

  const now = new Date();
  const currentHour = now.getHours();
  const timeSlot = getTimeSlot(currentHour);
  const today = getLocalDateString(now);

  // Cache check
  const cacheKey = `${canonicalSlug}|${timeSlot}|${today}`;
  const cached = await getSharedCacheJson<PlacesToGoResponse>(
    CACHE_NAMESPACE,
    cacheKey,
  );
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "Cache-Control": CACHE_CONTROL },
    });
  }

  // Weather fetch (3s timeout, graceful failure)
  let weather: CurrentWeatherResponse | null = null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const weatherRes = await fetch(
      new URL("/api/weather/current", request.url).toString(),
      { signal: controller.signal },
    );
    clearTimeout(timeoutId);
    if (weatherRes.ok) {
      weather = (await weatherRes.json()) as CurrentWeatherResponse;
    }
  } catch {
    // Weather is optional — proceed without it
  }

  const supabase = await createClient();

  // Portal lookup
  const portalResult = await supabase
    .from("portals")
    .select("id, slug, name, portal_type, parent_portal_id, settings, filters")
    .eq("slug", canonicalSlug)
    .eq("status", "active")
    .maybeSingle();

  if (!portalResult.data) {
    return NextResponse.json({ categories: [] }, { status: 404 });
  }

  const portalData = portalResult.data as {
    id: string;
    slug: string;
    name: string;
    portal_type: string;
    parent_portal_id?: string | null;
    settings: Record<string, unknown> | null;
    filters?: Record<string, unknown> | string | null;
  };

  // Parse filters
  const portalFilters = parsePortalFilters(portalData.filters);
  const portalCity = portalFilters.city;

  // Portal scoping
  const portalClient = await createPortalScopedClient(portalData.id);
  const federationAccess = await getPortalSourceAccess(portalData.id);
  const hasSubscribedSources = federationAccess.sourceIds.length > 0;

  const manifest = buildPortalManifest({
    portalId: portalData.id,
    slug: canonicalSlug,
    portalType: portalData.portal_type,
    parentPortalId: portalData.parent_portal_id,
    settings: portalData.settings,
    filters: portalFilters as { city?: string; cities?: string[] },
    sourceIds: hasSubscribedSources ? federationAccess.sourceIds : [],
  });

  const applyPortalScope = <T>(query: T): T => {
    return applyManifestFederatedScopeToQuery(query, manifest, {
      sourceIds: hasSubscribedSources ? federationAccess.sourceIds : [],
      publicOnlyWhenNoPortal: true,
    });
  };

  // Main places query
  let placesQuery = supabase
    .from("places")
    .select(PLACE_SELECT)
    .in("place_type", ALL_PLACES_TO_GO_TYPES as string[])
    .eq("is_active", true)
    .neq("location_designator", "recovery_meeting");

  if (portalCity) {
    placesQuery = placesQuery.ilike("city", `%${portalCity}%`);
  }

  placesQuery = placesQuery.limit(500);

  const { data: placesRaw } = await placesQuery;

  // Filter chain venues
  const places = ((placesRaw ?? []) as PlaceRow[]).filter((p) => {
    const nameLower = (p.name ?? "").toLowerCase();
    return !CHAIN_VENUE_PREFIXES.some((prefix) => nameLower.startsWith(prefix));
  });

  if (places.length === 0) {
    const emptyResult: PlacesToGoResponse = { categories: [] };
    await setSharedCacheJson(CACHE_NAMESPACE, cacheKey, emptyResult, CACHE_TTL_MS);
    return NextResponse.json(emptyResult, {
      headers: { "Cache-Control": CACHE_CONTROL },
    });
  }

  // Bucket places by category
  const categoryBuckets = new Map<string, PlaceRow[]>();
  for (const cat of PLACES_TO_GO_CATEGORIES) {
    categoryBuckets.set(cat.key, []);
  }
  for (const place of places) {
    if (!place.place_type) continue;
    const catKey = getCategoryKeyForPlaceType(place.place_type);
    if (!catKey) continue;
    categoryBuckets.get(catKey)?.push(place);
  }

  // Collect all place IDs
  const allIds = places.map((p) => p.id);
  const weekAhead = getLocalDateStringOffset(7);

  // 3 parallel secondary queries
  const [eventCountMap, specialsMap, occasionsMap] = await Promise.all([
    fetchEventCounts(allIds, today, weekAhead, portalClient, applyPortalScope),
    fetchActiveSpecials(allIds, supabase, now),
    fetchOccasions(allIds, supabase),
  ]);

  // Determine current season
  const currentMonth = now.getMonth() + 1; // 1-12
  const currentSeason = getSeason(currentMonth);

  // Build category response objects
  const categories: PlacesToGoCategory[] = [];

  for (const catConfig of PLACES_TO_GO_CATEGORIES) {
    const bucket = categoryBuckets.get(catConfig.key) ?? [];
    if (bucket.length === 0) continue;

    // Score each place
    const scored: Array<{ place: PlaceRow; ctx: PlaceContext; score: number }> =
      [];

    // Collect stats across all places for summary
    let totalCount = 0;
    let weatherMatchCount = 0;
    let eventsThisWeekCount = 0;
    let eventsTonight = 0;
    let dogFriendlyCount = 0;
    let familyCount = 0;
    let withinDriveTime = 0;
    let easyCount = 0;
    let exhibitionsCount = 0;
    let showsCurrent = 0;
    let showsTonight = 0;
    let showsThisWeek = 0;
    let happyHourNow = 0;
    let newThisMonth = 0;
    let actsTonight = 0;
    let actsThisWeek = 0;
    let marketsThisWeekend = 0;
    let programsThisWeek = 0;
    let toursThisWeek = 0;
    let venueCountWithEvents = 0;
    let openingsThisWeek = 0;

    for (const place of bucket) {
      const eventData = eventCountMap.get(place.id) ?? {
        total: 0,
        today: 0,
        todayTitle: null,
      };
      const special = specialsMap.get(place.id) ?? null;
      const occasions = occasionsMap.get(place.id) ?? null;
      const outdoor = place.place_vertical_details?.outdoor ?? null;

      const createdDaysAgo = place.created_at
        ? Math.floor(
            (now.getTime() - new Date(place.created_at).getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : null;

      // Weather matching
      const weatherFitTags = outdoor?.weather_fit_tags ?? null;
      let weatherMatch = false;
      if (weather && weatherFitTags && weatherFitTags.length > 0) {
        const conditionLower = weather.condition.toLowerCase();
        weatherMatch = weatherFitTags.some((tag) => {
          const tagLower = tag.toLowerCase();
          if (tagLower === "sunny" || tagLower === "clear") {
            return (
              conditionLower.includes("sun") ||
              conditionLower.includes("clear") ||
              conditionLower.includes("fair")
            );
          }
          if (tagLower === "rainy" || tagLower === "rain") {
            return weather.isRainy;
          }
          if (tagLower === "cloudy" || tagLower === "overcast") {
            return (
              conditionLower.includes("cloud") ||
              conditionLower.includes("overcast")
            );
          }
          return conditionLower.includes(tagLower);
        });
      }

      // Season matching
      const bestSeasons = outdoor?.best_seasons ?? null;
      const seasonMatch =
        bestSeasons !== null && bestSeasons.includes(currentSeason);

      // Time of day matching
      const bestTimeOfDay = outdoor?.best_time_of_day ?? null;
      const timeOfDayMatch = bestTimeOfDay !== null
        ? bestTimeOfDay === timeSlot
        : false;

      const isNew = createdDaysAgo !== null && createdDaysAgo < 30;

      const ctx: PlaceContext = {
        weatherMatchIndoor: place.indoor_outdoor === "indoor" && weather?.isRainy === true,
        weatherMatchOutdoor:
          place.indoor_outdoor === "outdoor" && weather?.isRainy === false,
        weatherMatch,
        timeOfDayMatch,
        seasonMatch,
        eventsToday: eventData.today,
        eventsThisWeek: eventData.total,
        hasImage: !!place.image_url,
        hasDescription: !!(place.description || place.short_description),
        isFeatured: place.place_profile?.featured ?? false,
        occasions,
        vibes: place.vibes ?? null,
        cuisine: place.cuisine ?? null,
        neighborhood: place.neighborhood ?? null,
        nearestMarta: place.nearest_marta_station ?? null,
        difficulty: outdoor?.difficulty ?? null,
        driveTimeMinutes: outdoor?.drive_time_minutes ?? null,
        bestSeasons,
        weatherFitTags,
        shortDescription: place.short_description ?? null,
        libraryPass: place.place_profile?.library_pass != null ? true : null,
        isNew,
        hasActiveSpecial: special !== null,
        specialTitle: special?.title ?? null,
        specialTimeEnd: special?.timeEnd ?? null,
        indoorOutdoor: place.indoor_outdoor ?? null,
        createdDaysAgo,
        hasNewEventsThisWeek: eventData.total > 0,
        todayEventTitle: eventData.todayTitle,
      };

      if (!passesQualityGate(ctx)) continue;

      const score = scorePlaceForCategory(ctx);
      scored.push({ place, ctx, score });

      // Accumulate stats
      totalCount++;
      if (weatherMatch) weatherMatchCount++;
      if (eventData.total > 0) {
        eventsThisWeekCount += eventData.total;
        venueCountWithEvents++;
      }
      if (eventData.today > 0) eventsTonight += eventData.today;
      if (occasions?.includes("dog_friendly")) dogFriendlyCount++;
      if (occasions?.includes("family_friendly")) familyCount++;
      const dm = outdoor?.drive_time_minutes ?? null;
      if (dm !== null && dm <= 45) withinDriveTime++;
      if (outdoor?.difficulty === "easy") easyCount++;
      if (special !== null) happyHourNow++;
      if (isNew) newThisMonth++;

      // Category-specific stats
      if (catConfig.key === "museums") {
        if (eventData.total > 0) exhibitionsCount++;
      }
      if (catConfig.key === "galleries_studios") {
        if (eventData.total > 0) showsCurrent++;
        if (eventData.today > 0) openingsThisWeek++;
      }
      if (catConfig.key === "theaters_stage") {
        if (eventData.today > 0) showsTonight++;
        if (eventData.total > 0) showsThisWeek++;
      }
      if (catConfig.key === "music_venues") {
        if (eventData.today > 0) actsTonight++;
        if (eventData.total > 0) actsThisWeek++;
      }
      if (catConfig.key === "markets_local") {
        if (eventData.total > 0) marketsThisWeekend++;
      }
      if (catConfig.key === "libraries_learning") {
        if (eventData.total > 0) programsThisWeek += eventData.total;
      }
      if (catConfig.key === "historic_sites") {
        if (eventData.total > 0) toursThisWeek += eventData.total;
      }
    }

    if (totalCount === 0) continue;

    // Sort by score, take top 3
    scored.sort((a, b) => b.score - a.score);
    const top3 = scored.slice(0, 3);

    // Build PlacesToGoCard for each
    const cards: PlacesToGoCard[] = top3.map(({ place, ctx }) => {
      const openResult = isOpenAt(place.hours, now);
      const callouts = buildCallouts(catConfig.key, ctx);
      return {
        id: place.id,
        name: place.name,
        slug: place.slug,
        image_url: place.image_url,
        neighborhood: place.neighborhood,
        is_open: openResult.isOpen,
        callouts,
        event_count: ctx.eventsThisWeek,
        href: `/${canonicalSlug}/places/${place.slug}`,
      };
    });

    // Compute aggregate stats for summary
    const summaryStats: Record<string, number | string | undefined> = {
      totalCount,
      weatherMatchCount,
      eventsThisWeekCount,
      eventsTonight,
      dogFriendlyCount,
      familyCount,
      withinDriveTime,
      easyCount,
      exhibitionsCount,
      showsCurrent,
      openingsThisWeek,
      showsTonight,
      showsThisWeek,
      happyHourNow,
      newThisMonth,
      actsTonight,
      actsThisWeek,
      marketsThisWeekend,
      programsThisWeek,
      toursThisWeek,
      venueCountWithEvents,
      eventsThisWeek: eventsThisWeekCount,
    };

    const summary = buildSummary(catConfig.key, summaryStats);
    const hasActivityToday = eventsTonight > 0 || happyHourNow > 0;

    const category: PlacesToGoCategory = {
      key: catConfig.key,
      label: catConfig.label,
      accent_color: catConfig.accentColor,
      icon_type: catConfig.iconType,
      count: totalCount,
      summary,
      has_activity_today: hasActivityToday,
      places: cards,
      see_all_href: buildSeeAllHref(canonicalSlug, catConfig),
    };

    categories.push(category);
  }

  // Require at least 3 categories
  const result: PlacesToGoResponse =
    categories.length >= 3 ? { categories } : { categories: [] };

  await setSharedCacheJson(CACHE_NAMESPACE, cacheKey, result, CACHE_TTL_MS);

  return NextResponse.json(result, {
    headers: { "Cache-Control": CACHE_CONTROL },
  });
}

// ---------------------------------------------------------------------------
// Secondary query helpers
// ---------------------------------------------------------------------------

async function fetchEventCounts(
  allIds: number[],
  today: string,
  weekAhead: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  portalClient: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applyPortalScope: (q: any) => any,
): Promise<Map<number, { total: number; today: number; todayTitle: string | null }>> {
  const map = new Map<number, { total: number; today: number; todayTitle: string | null }>();
  const batchSize = 200;

  for (let i = 0; i < allIds.length; i += batchSize) {
    const batch = allIds.slice(i, i + batchSize);
    let evQ = portalClient
      .from("events")
      .select("place_id, title, start_date")
      .in("place_id", batch)
      .gte("start_date", today)
      .lte("start_date", weekAhead)
      .is("canonical_event_id", null);
    evQ = applyPortalScope(evQ);
    evQ = applyFeedGate(evQ);
    const { data: evRows } = await evQ.limit(2000);

    if (evRows) {
      for (const row of evRows as EventCountRow[]) {
        const pid = row.place_id;
        const existing = map.get(pid) ?? { total: 0, today: 0, todayTitle: null };
        existing.total += 1;
        if (row.start_date === today) {
          existing.today += 1;
          if (!existing.todayTitle && row.title) {
            existing.todayTitle = row.title;
          }
        }
        map.set(pid, existing);
      }
    }
  }

  return map;
}

async function fetchActiveSpecials(
  allIds: number[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  now: Date,
): Promise<Map<number, { title: string; timeEnd: string | null }>> {
  const map = new Map<number, { title: string; timeEnd: string | null }>();

  const { data: rows } = await supabase
    .from("place_specials")
    .select("place_id, title, type, days_of_week, time_start, time_end")
    .in("place_id", allIds)
    .eq("is_active", true)
    .eq("type", "happy_hour");

  if (!rows) return map;

  // JS getDay(): 0=Sun..6=Sat → ISO 8601: 1=Mon..7=Sun
  const jsDay = now.getDay();
  const isoDay = jsDay === 0 ? 7 : jsDay;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const row of rows as SpecialRow[]) {
    // Check day of week
    if (row.days_of_week && row.days_of_week.length > 0) {
      if (!row.days_of_week.includes(isoDay)) continue;
    }

    // Check time window
    if (row.time_start || row.time_end) {
      const startMins = row.time_start ? timeStringToMinutes(row.time_start) : 0;
      const endMins = row.time_end ? timeStringToMinutes(row.time_end) : 24 * 60;
      if (startMins >= 0 && currentMinutes < startMins) continue;
      if (endMins >= 0 && currentMinutes > endMins) continue;
    }

    // Format the end time for display
    let timeEnd: string | null = null;
    if (row.time_end) {
      timeEnd = formatTimeForDisplay(row.time_end);
    }

    // Only keep the first match per place
    if (!map.has(row.place_id)) {
      map.set(row.place_id, { title: row.title, timeEnd });
    }
  }

  return map;
}

async function fetchOccasions(
  allIds: number[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<Map<number, string[]>> {
  const map = new Map<number, string[]>();

  const { data: rows } = await supabase
    .from("place_occasions")
    .select("place_id, occasion")
    .in("place_id", allIds);

  if (!rows) return map;

  for (const row of rows as OccasionRow[]) {
    const existing = map.get(row.place_id) ?? [];
    existing.push(row.occasion);
    map.set(row.place_id, existing);
  }

  return map;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parsePortalFilters(
  raw: Record<string, unknown> | string | null | undefined,
): { city?: string; cities?: string[] } {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw as { city?: string; cities?: string[] };
}

function getSeason(month: number): string {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "fall";
  return "winter";
}

/** Parse "HH:MM:SS" or "HH:MM" to minutes since midnight. Returns -1 on failure. */
function timeStringToMinutes(timeStr: string): number {
  const parts = timeStr.split(":");
  if (parts.length < 2) return -1;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return -1;
  return h * 60 + m;
}

/** Format "HH:MM:SS" to "7pm" or "7:30pm" for display. */
function formatTimeForDisplay(timeStr: string): string {
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (!Number.isFinite(h)) return timeStr;
  const period = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  if (m === 0) return `${h12}${period}`;
  return `${h12}:${m.toString().padStart(2, "0")}${period}`;
}
