/**
 * GET /api/portals/[slug]/city-pulse
 *
 * Unified City Pulse feed endpoint. Returns mixed content types
 * (events, destinations, specials) with context awareness.
 * Auth is optional — anonymous gets base feed, authenticated gets
 * personalization layer.
 */

import { createClient, createPortalScopedClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  addDays,
  startOfDay,
  isFriday,
  isSaturday,
  isSunday,
  nextFriday,
  nextSunday,
} from "date-fns";
import { getLocalDateString } from "@/lib/formats";
import { fetchSocialProofCounts } from "@/lib/social-proof";
import { getPortalSourceAccess } from "@/lib/federation";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import { errorResponse } from "@/lib/api-utils";
import {
  normalizePortalSlug,
  resolvePortalSlugAlias,
} from "@/lib/portal-aliases";
import { applyManifestFederatedScopeToQuery } from "@/lib/portal-scope";
import { buildPortalManifest } from "@/lib/portal-manifest";
import {
  suppressEventImagesIfVenueFlagged,
} from "@/lib/image-quality-suppression";
import { getSharedCacheJson, setSharedCacheJson } from "@/lib/shared-cache";
import { getWeatherVenueFilter } from "@/lib/city-pulse/weather-mapping";
import { buildFeedContext } from "@/lib/city-pulse/context";
import { getTimeSlot } from "@/lib/city-pulse/time-slots";
import { getAllConversionPrompts } from "@/lib/city-pulse/conversion-prompts";
import {
  ALL_INTEREST_IDS,
  DEFAULT_INTEREST_IDS,
  getInterestQueryConfig,
} from "@/lib/city-pulse/interests";
import {
  buildBannerSection,
  buildRightNowSection,
  buildTonightSection,
  buildTheSceneSection,
  buildThemedSpecialsSection,
  buildWeatherDiscoverySection,
  buildThisWeekendSection,
  buildThisWeekSection,
  buildYourPeopleSection,
  buildNewFromSpotsSection,
  buildTrendingSection,
  buildComingUpSection,
  buildBrowseSection,
  buildTabEventPool,
} from "@/lib/city-pulse/section-builders";
import { resolveHeader } from "@/lib/city-pulse/header-resolver";
import type {
  CityPulseResponse,
  CityPulseSpecialItem,
  FeedHeaderRow,
  FriendGoingInfo,
  PersonalizationLevel,
  UserSignals,
  TimeSlot,
} from "@/lib/city-pulse/types";
import type { FeedSectionData } from "@/components/feed/FeedSection";
import type { FeedEventData } from "@/components/EventCard";
import type { Spot } from "@/lib/spots-constants";

// ---------------------------------------------------------------------------
// Cache configuration
// ---------------------------------------------------------------------------

const CACHE_NAMESPACE = "api:city-pulse";
const ANON_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
const AUTH_CACHE_TTL_MS = 60 * 1000; // 1 min
const CACHE_MAX_ENTRIES = 200;

const ANON_CACHE_CONTROL =
  "public, s-maxage=300, stale-while-revalidate=3600";
const AUTH_CACHE_CONTROL =
  "private, max-age=60, stale-while-revalidate=120";

export const revalidate = 300;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = { params: Promise<{ slug: string }> };

type PortalData = {
  id: string;
  slug: string;
  name: string;
  portal_type: string;
  parent_portal_id?: string | null;
  settings: Record<string, unknown> | null;
  filters?: Record<string, unknown> | string | null;
};

// Event select for Supabase queries (reused from portal feed)
const EVENT_SELECT = `
  id, title, start_date, start_time, end_date, end_time,
  is_all_day, is_free, price_min, price_max,
  category:category_id, genres, image_url, featured_blurb,
  tags, festival_id, is_tentpole, is_featured, series_id, source_id, organization_id,
  series:series_id(id, frequency, day_of_week),
  venue:venues(id, name, neighborhood, slug, venue_type, location_designator, city)
`;

const VENUE_SELECT = `
  id, name, slug, address, neighborhood, city, venue_type,
  venue_types, lat, lng, image_url, short_description,
  vibes, genres, price_level, hours_display,
  hours, featured, active,
  location_designator
`;

// ---------------------------------------------------------------------------
// Helper: parse portal filters
// ---------------------------------------------------------------------------

function parsePortalFilters(
  raw: Record<string, unknown> | string | null | undefined,
): { city?: string; cities?: string[]; geo_center?: [number, number]; geo_radius_km?: number } {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw as { city?: string; cities?: string[]; geo_center?: [number, number] };
}

// ---------------------------------------------------------------------------
// Helper: get current ISO weekday (1=Mon, 7=Sun)
// ---------------------------------------------------------------------------

function getCurrentISOWeekday(now: Date): number {
  const jsDay = now.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

// ---------------------------------------------------------------------------
// Helper: compute special status (extracted from specials route)
// ---------------------------------------------------------------------------

type SpecialRow = {
  id: number;
  venue_id: number;
  title: string;
  type: string;
  description: string | null;
  days_of_week: number[] | null;
  time_start: string | null;
  time_end: string | null;
  start_date: string | null;
  end_date: string | null;
  price_note: string | null;
};

type SpecialStatus = {
  state: "active_now" | "starting_soon" | "inactive";
  startsInMinutes: number | null;
  remainingMinutes: number | null;
};

function getTimeMinutes(time: string | null): number | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function getSpecialStatus(
  special: SpecialRow,
  now: Date,
  today: string,
): SpecialStatus {
  // Date eligibility
  if (special.start_date && special.start_date > today) {
    return { state: "inactive", startsInMinutes: null, remainingMinutes: null };
  }
  if (special.end_date && special.end_date < today) {
    return { state: "inactive", startsInMinutes: null, remainingMinutes: null };
  }

  const currentIsoDay = getCurrentISOWeekday(now);
  if (special.days_of_week?.length && !special.days_of_week.includes(currentIsoDay)) {
    return { state: "inactive", startsInMinutes: null, remainingMinutes: null };
  }

  // Guard: if days_of_week is NULL, infer from title keywords
  // Prevents "Sunday Brunch" showing active on Monday, etc.
  if (!special.days_of_week?.length) {
    const titleLower = special.title.toLowerCase();
    const DAY_KEYWORDS: Record<string, number> = {
      monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
      friday: 5, saturday: 6, sunday: 7,
    };
    for (const [dayName, isoDay] of Object.entries(DAY_KEYWORDS)) {
      if (titleLower.includes(dayName) && currentIsoDay !== isoDay) {
        return { state: "inactive", startsInMinutes: null, remainingMinutes: null };
      }
    }
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const start = getTimeMinutes(special.time_start);
  const end = getTimeMinutes(special.time_end);
  const upcomingWindow = 120; // 2 hours

  if (start === null && end === null) {
    return { state: "active_now", startsInMinutes: null, remainingMinutes: null };
  }

  if (start !== null && end !== null) {
    // Overnight
    if (start > end) {
      if (currentMinutes >= start || currentMinutes <= end) {
        const remaining = currentMinutes <= end
          ? end - currentMinutes
          : (1440 - currentMinutes) + end;
        return { state: "active_now", startsInMinutes: 0, remainingMinutes: remaining };
      }
      const startsIn = start - currentMinutes;
      if (startsIn >= 0 && startsIn <= upcomingWindow) {
        return { state: "starting_soon", startsInMinutes: startsIn, remainingMinutes: null };
      }
      return { state: "inactive", startsInMinutes: startsIn, remainingMinutes: null };
    }

    if (currentMinutes >= start && currentMinutes <= end) {
      return { state: "active_now", startsInMinutes: 0, remainingMinutes: end - currentMinutes };
    }
    if (currentMinutes < start) {
      const startsIn = start - currentMinutes;
      if (startsIn <= upcomingWindow) {
        return { state: "starting_soon", startsInMinutes: startsIn, remainingMinutes: null };
      }
    }
    return { state: "inactive", startsInMinutes: null, remainingMinutes: null };
  }

  if (start !== null) {
    if (currentMinutes >= start) {
      return { state: "active_now", startsInMinutes: 0, remainingMinutes: null };
    }
    const startsIn = start - currentMinutes;
    if (startsIn <= upcomingWindow) {
      return { state: "starting_soon", startsInMinutes: startsIn, remainingMinutes: null };
    }
  }

  if (end !== null && currentMinutes <= end) {
    return { state: "active_now", startsInMinutes: null, remainingMinutes: end - currentMinutes };
  }

  return { state: "inactive", startsInMinutes: null, remainingMinutes: null };
}

// ---------------------------------------------------------------------------
// Helper: resolve curated sections into FeedSectionData shape
// ---------------------------------------------------------------------------

type RawPortalSection = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  section_type: "auto" | "curated" | "mixed";
  block_type: string;
  layout: string;
  items_per_row?: number;
  max_items?: number;
  style?: Record<string, unknown> | null;
  block_content?: Record<string, unknown> | null;
  auto_filter?: Record<string, unknown> | null;
  portal_section_items?: Array<{
    id: string;
    entity_type: string;
    entity_id: number;
    display_order: number;
  }>;
};

function getDateRange(filter: string): { start: string; end: string } {
  const now = new Date();
  const todayDate = startOfDay(now);
  switch (filter) {
    case "today":
      return { start: getLocalDateString(todayDate), end: getLocalDateString(todayDate) };
    case "tomorrow": {
      const tmrw = addDays(todayDate, 1);
      return { start: getLocalDateString(tmrw), end: getLocalDateString(tmrw) };
    }
    case "this_weekend": {
      let friday: Date;
      let sunday: Date;
      if (isFriday(now) || isSaturday(now) || isSunday(now)) {
        friday = isFriday(now) ? todayDate : addDays(todayDate, -(now.getDay() - 5));
        sunday = isSunday(now) ? todayDate : addDays(todayDate, 7 - now.getDay());
      } else {
        friday = nextFriday(todayDate);
        sunday = nextSunday(todayDate);
      }
      return { start: getLocalDateString(friday), end: getLocalDateString(sunday) };
    }
    case "next_7_days":
      return { start: getLocalDateString(todayDate), end: getLocalDateString(addDays(todayDate, 7)) };
    case "next_30_days":
      return { start: getLocalDateString(todayDate), end: getLocalDateString(addDays(todayDate, 30)) };
    default:
      return { start: getLocalDateString(todayDate), end: getLocalDateString(addDays(todayDate, 14)) };
  }
}

/**
 * Resolves raw portal_sections rows into FeedSectionData shape
 * by matching events from the event pool.
 */
function resolveCuratedSections(
  rawSections: RawPortalSection[],
  eventPool: FeedEventData[],
): FeedSectionData[] {
  // Build lookup map by event ID
  const eventMap = new Map<number, FeedEventData>();
  for (const e of eventPool) {
    eventMap.set(e.id, e);
  }

  return rawSections.map((section) => {
    const limit = section.max_items || 12;

    // Non-event block types just need empty events
    if (
      ["category_grid", "announcement", "external_link", "countdown"].includes(
        section.block_type,
      )
    ) {
      return {
        id: section.id,
        title: section.title,
        slug: section.slug,
        description: section.description,
        section_type: section.section_type,
        block_type: section.block_type,
        layout: section.layout,
        items_per_row: section.items_per_row,
        style: section.style,
        block_content: section.block_content,
        auto_filter: section.auto_filter as FeedSectionData["auto_filter"],
        events: [],
      };
    }

    let events: FeedEventData[] = [];

    if (section.section_type === "curated") {
      // Resolve pinned items
      const items = (section.portal_section_items || [])
        .filter((item) => item.entity_type === "event")
        .sort((a, b) => a.display_order - b.display_order);
      events = items
        .map((item) => eventMap.get(item.entity_id))
        .filter((e): e is FeedEventData => e !== undefined)
        .slice(0, limit);
    } else if (
      (section.section_type === "auto" || section.section_type === "mixed") &&
      section.auto_filter
    ) {
      const filter = section.auto_filter as Record<string, unknown>;
      let filtered = [...eventPool];

      // Date filter
      if (filter.date_filter && typeof filter.date_filter === "string") {
        const { start, end } = getDateRange(filter.date_filter);
        filtered = filtered.filter(
          (e) => e.start_date >= start && e.start_date <= end,
        );
      }

      // Category filter
      if (Array.isArray(filter.categories) && filter.categories.length) {
        filtered = filtered.filter(
          (e) => e.category && (filter.categories as string[]).includes(e.category),
        );
      }

      // Nightlife mode
      if (filter.nightlife_mode) {
        const nightlifeVenueTypes = new Set([
          "bar", "nightclub", "rooftop", "karaoke",
          "brewery", "cocktail_bar",
        ]);
        const entertainmentVenueTypes = new Set([
          "music_venue", "theater", "amphitheater",
        ]);
        const entertainmentCategories = new Set(["music", "comedy", "dance"]);
        filtered = filtered.filter((e) => {
          if (e.category === "nightlife") return true;
          const vType = (e as unknown as Record<string, unknown>).venue &&
            typeof (e as unknown as Record<string, unknown>).venue === "object"
            ? ((e as unknown as Record<string, unknown>).venue as Record<string, unknown>)?.venue_type as string | undefined
            : undefined;
          const atNightlifeVenue = vType && nightlifeVenueTypes.has(vType);
          const atEntertainmentVenue = vType && entertainmentVenueTypes.has(vType);
          const startsEvening = e.start_time && e.start_time >= "17:00";
          if (atNightlifeVenue && startsEvening) return true;
          if (e.category && entertainmentCategories.has(e.category)) {
            if ((atNightlifeVenue || atEntertainmentVenue) && startsEvening) return true;
            return e.start_time ? e.start_time >= "19:00" : false;
          }
          return false;
        });
      }

      // Free filter
      if (filter.is_free) {
        filtered = filtered.filter((e) => e.is_free);
      }

      // Tag filter (tags exist on raw data but not in FeedEventData type)
      if (Array.isArray(filter.tags) && filter.tags.length) {
        const tagSet = new Set(filter.tags as string[]);
        filtered = filtered.filter((e) => {
          const tags = (e as unknown as Record<string, unknown>).tags;
          return Array.isArray(tags) && tags.some((t: string) => tagSet.has(t));
        });
      }

      events = filtered.slice(0, limit);

      // For mixed sections, prepend curated items
      if (section.section_type === "mixed") {
        const curatedItems = (section.portal_section_items || [])
          .filter((item) => item.entity_type === "event")
          .sort((a, b) => a.display_order - b.display_order);
        const curatedEvents = curatedItems
          .map((item) => eventMap.get(item.entity_id))
          .filter((e): e is FeedEventData => e !== undefined);
        const curatedIds = new Set(curatedEvents.map((e) => e.id));
        events = [...curatedEvents, ...events.filter((e) => !curatedIds.has(e.id))].slice(0, limit);
      }
    }

    // Events already have `category` via the alias in EVENT_SELECT
    const feedEvents = events;

    return {
      id: section.id,
      title: section.title,
      slug: section.slug,
      description: section.description,
      section_type: section.section_type,
      block_type: section.block_type,
      layout: section.layout,
      items_per_row: section.items_per_row,
      style: section.style,
      block_content: section.block_content,
      auto_filter: section.auto_filter as FeedSectionData["auto_filter"],
      events: feedEvents,
    } as FeedSectionData;
  });
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest, { params }: Props) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await params;
  const requestSlug = normalizePortalSlug(slug);
  const canonicalSlug = resolvePortalSlugAlias(requestSlug);
  const { searchParams } = new URL(request.url);
  const timeSlotOverride = searchParams.get("time_slot") as TimeSlot | null;
  const dayOverride = searchParams.get("day") as string | null;
  const requestedTab = searchParams.get("tab") as "this_week" | "coming_up" | null;

  // Parse interest chips for per-category fetching (6 events each)
  const interestsParam = searchParams.get("interests");
  const requestedInterests = interestsParam
    ? interestsParam.split(",").filter((id) => ALL_INTEREST_IDS.includes(id))
    : [...DEFAULT_INTEREST_IDS];

  const now = new Date();
  const timeSlot = timeSlotOverride || getTimeSlot(now.getHours());

  // Late-night continuity: before 5am, people still think of it as the
  // previous night. Shift "today" back so the feed shows last night's events.
  const effectiveNow = new Date(now);
  if (timeSlot === "late_night" && now.getHours() < 5) {
    effectiveNow.setDate(effectiveNow.getDate() - 1);
  }
  const today = getLocalDateString(effectiveNow);

  // ---------------------------------------------------------------------------
  // Auth check (optional)
  // ---------------------------------------------------------------------------

  const supabase = await createClient();
  let userId: string | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    // Anonymous is fine
  }

  const isAuthenticated = !!userId;

  // ---------------------------------------------------------------------------
  // Cache check (skip when admin overrides are active)
  // ---------------------------------------------------------------------------

  const hasAdminOverrides = !!(timeSlotOverride || dayOverride);

  const cacheKey = isAuthenticated
    ? `${userId}|${canonicalSlug}|${Math.floor(now.getTime() / 60000)}`
    : `${canonicalSlug}|${timeSlot}|${today}`;

  if (!hasAdminOverrides && !requestedTab) {
    const cached = await getSharedCacheJson<CityPulseResponse>(
      CACHE_NAMESPACE,
      cacheKey,
    );
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          "Cache-Control": isAuthenticated
            ? AUTH_CACHE_CONTROL
            : ANON_CACHE_CONTROL,
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Portal lookup
  // ---------------------------------------------------------------------------

  let portalResult = await supabase
    .from("portals")
    .select("id, slug, name, portal_type, parent_portal_id, settings, filters")
    .eq("slug", canonicalSlug)
    .eq("status", "active")
    .maybeSingle();

  if (portalResult.error && portalResult.error.message?.includes("column")) {
    portalResult = await supabase
      .from("portals")
      .select("id, slug, name, portal_type, settings")
      .eq("slug", canonicalSlug)
      .eq("status", "active")
      .maybeSingle();
  }

  const portalData = portalResult.data as PortalData | null;
  if (!portalData) {
    return errorResponse("Portal not found", "city-pulse", 404);
  }

  const portalClient = await createPortalScopedClient(portalData.id);
  const portalFilters = parsePortalFilters(portalData.filters);
  const portalCity = portalFilters.city;
  const geoCenter = portalFilters.geo_center;

  // Build manifest + feed context in parallel (independent of each other)
  const [federationAccess, feedContext] = await Promise.all([
    getPortalSourceAccess(portalData.id),
    buildFeedContext({
      portalId: portalData.id,
      portalSlug: canonicalSlug,
      portalLat: geoCenter?.[0],
      portalLng: geoCenter?.[1],
      timeSlotOverride: timeSlotOverride || undefined,
      dayOverride: dayOverride || undefined,
      now,
    }),
  ]);

  const hasSubscribedSources =
    federationAccess.sourceIds && federationAccess.sourceIds.length > 0;

  const manifest = buildPortalManifest({
    portalId: portalData.id,
    slug: canonicalSlug,
    portalType: portalData.portal_type,
    parentPortalId: (portalData as { parent_portal_id?: string | null }).parent_portal_id,
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

  // ---------------------------------------------------------------------------
  // Parallel data queries
  // ---------------------------------------------------------------------------

  // Date boundaries — aligned with frontend tab windows:
  // TODAY = today, THIS WEEK = +1 to +7 days, COMING UP = +8 to +28 days
  // Uses effectiveNow so late-night (before 5am) aligns with the previous day
  const tomorrow = getLocalDateString(addDays(effectiveNow, 1));
  const dayOfWeek = effectiveNow.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
  const endOfWeek = getLocalDateString(addDays(effectiveNow, daysUntilSunday));
  const weekAhead = getLocalDateString(addDays(effectiveNow, 7));
  const twoWeeksAhead = getLocalDateString(addDays(effectiveNow, 14));
  const fourWeeksAhead = getLocalDateString(addDays(effectiveNow, 28));

  // Build event queries
  const buildEventQuery = (start: string, end: string, limit: number) => {
    let q = portalClient
      .from("events")
      .select(EVENT_SELECT)
      .gte("start_date", start)
      .lte("start_date", end)
      .is("canonical_event_id", null)
      .or("is_class.eq.false,is_class.is.null")
      .or("is_sensitive.eq.false,is_sensitive.is.null");
    q = applyPortalScope(q);
    return q
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(limit);
  };

  // Count-only query (HEAD, zero rows — cheap for real tab badge counts)
  const buildCountQuery = (start: string, end: string) => {
    let q = portalClient
      .from("events")
      .select("id", { count: "exact", head: true })
      .gte("start_date", start)
      .lte("start_date", end)
      .is("canonical_event_id", null)
      .or("is_class.eq.false,is_class.is.null")
      .or("is_sensitive.eq.false,is_sensitive.is.null");
    q = applyPortalScope(q);
    return q;
  };

  // Lightweight category + tags query — fetches only the fields needed
  // for per-category counting. No payload bloat, just small strings.
  const buildCategoryQuery = (start: string, end: string) => {
    let q = portalClient
      .from("events")
      .select("category_id, genres, tags")
      .gte("start_date", start)
      .lte("start_date", end)
      .is("canonical_event_id", null)
      .or("is_class.eq.false,is_class.is.null")
      .or("is_sensitive.eq.false,is_sensitive.is.null");
    q = applyPortalScope(q);
    return q;
  };

  /** Count events by category and genre/tag from lightweight query results */
  const buildCategoryCounts = (
    rows: { category_id: string | null; genres: string[] | null; tags: string[] | null }[],
  ): Record<string, number> => {
    const counts: Record<string, number> = {};
    for (const row of rows) {
      // Count by category
      if (row.category_id) {
        counts[row.category_id] = (counts[row.category_id] || 0) + 1;
      }
      // Count by genres (for genre-based chips like trivia, karaoke, etc.)
      if (Array.isArray(row.genres)) {
        for (const g of row.genres) {
          counts[`genre:${g}`] = (counts[`genre:${g}`] || 0) + 1;
        }
      }
      // Count by tags (genre chips also check tags array)
      if (Array.isArray(row.tags)) {
        for (const t of row.tags) {
          counts[`tag:${t}`] = (counts[`tag:${t}`] || 0) + 1;
        }
      }
    }
    return counts;
  };

  // Per-interest event queries — fetch 6 events per active interest chip
  // to guarantee category representation in the event pool
  const PER_INTEREST_LIMIT = 6;
  const buildInterestQueries = (start: string, end: string) => {
    const queries: Array<Promise<{ data: FeedEventData[] | null }>> = [];
    for (const chipId of requestedInterests) {
      const config = getInterestQueryConfig(chipId);
      if (!config) continue;

      let q = portalClient
        .from("events")
        .select(EVENT_SELECT)
        .gte("start_date", start)
        .lte("start_date", end)
        .is("canonical_event_id", null)
        .or("is_class.eq.false,is_class.is.null")
        .or("is_sensitive.eq.false,is_sensitive.is.null");

      if (config.type === "category") {
        q = q.eq("category_id", config.categoryId);
      } else {
        q = q.or(config.filter);
      }

      q = applyPortalScope(q);
      queries.push(
        q
          .order("start_date", { ascending: true })
          .order("start_time", { ascending: true })
          .limit(PER_INTEREST_LIMIT) as unknown as Promise<{ data: FeedEventData[] | null }>,
      );
    }
    return queries;
  };

  // Weather venue filter
  const weatherFilter = feedContext.weather
    ? getWeatherVenueFilter(feedContext.weather as import("@/lib/weather-utils").WeatherData)
    : null;

  // Build venue query for weather discovery
  // Uses geo bounding box from portal center (city column is often NULL)
  // Matches venues by venue_type OR by overlapping vibes for broader results
  const buildWeatherVenueQuery = () => {
    if (!weatherFilter) return Promise.resolve({ data: [] });
    const typesList = weatherFilter.venue_types.join(",");
    const vibesList = weatherFilter.vibes.join(",");
    let q = supabase
      .from("venues")
      .select(VENUE_SELECT)
      .eq("active", true)
      .or(`venue_type.in.(${typesList}),vibes.ov.{${vibesList}}`);
    // Geo-scope: use portal center + radius as bounding box (≈0.3° ≈ 20mi)
    if (geoCenter) {
      const radiusKm = portalFilters.geo_radius_km ?? 25;
      const degOffset = radiusKm / 111; // ~111km per degree
      q = q
        .gte("lat", geoCenter[0] - degOffset)
        .lte("lat", geoCenter[0] + degOffset)
        .gte("lng", geoCenter[1] - degOffset)
        .lte("lng", geoCenter[1] + degOffset);
    } else if (portalCity) {
      q = q.ilike("city", `%${portalCity}%`);
    }
    return q.limit(20);
  };

  // Specials query — use geo bounding box via venue join (city column is often NULL)
  const buildSpecialsQuery = () => {
    let q = supabase
      .from("venue_specials")
      .select(`
        id, venue_id, title, type, description,
        days_of_week, time_start, time_end,
        start_date, end_date, price_note,
        venue:venues!inner(id, name, slug, neighborhood, venue_type, image_url, city)
      `)
      .eq("is_active", true)
      .eq("venue.active", true);
    if (portalCity) {
      q = q.ilike("venue.city", `%${portalCity}%`);
    }
    return q.limit(50);
  };

  // Feed header CMS configs (ordered by priority, first match wins)
  const buildHeadersQuery = () =>
    supabase
      .from("portal_feed_headers")
      .select("*")
      .eq("portal_id", portalData.id)
      .eq("is_active", true)
      .order("priority", { ascending: true });

  // User profile for template vars (display_name, username)
  const buildProfileQuery = () =>
    userId
      ? supabase.from("profiles").select("display_name, username").eq("id", userId).maybeSingle()
      : Promise.resolve({ data: null });

  // Curated sections (same as portal feed)
  const buildCuratedQuery = () => {
    return supabase
      .from("portal_sections")
      .select(`
        id, title, slug, description, section_type, block_type,
        layout, items_per_row, max_items, auto_filter, block_content,
        display_order, is_visible,
        schedule_start, schedule_end, show_on_days,
        show_after_time, show_before_time, style,
        portal_section_items(id, entity_type, entity_id, display_order)
      `)
      .eq("portal_id", portalData.id)
      .eq("is_visible", true)
      .order("display_order", { ascending: true });
  };

  // Trending events (high social proof / marked trending)
  const buildTrendingQuery = () => {
    let q = portalClient
      .from("events")
      .select(EVENT_SELECT)
      .gte("start_date", today)
      .lte("start_date", twoWeeksAhead)
      .is("canonical_event_id", null)
      .or("is_class.eq.false,is_class.is.null")
      .or("is_sensitive.eq.false,is_sensitive.is.null");
    q = applyPortalScope(q);
    return q
      .order("is_featured", { ascending: false, nullsFirst: false })
      .order("attendee_count", { ascending: false, nullsFirst: false })
      .order("start_date", { ascending: true })
      .limit(20);
  };

  // Evening events query — ensures Tonight section has events even when
  // the main today query's LIMIT is filled by morning/afternoon events
  const buildEveningQuery = () => {
    let q = portalClient
      .from("events")
      .select(EVENT_SELECT)
      .eq("start_date", today)
      .gte("start_time", "17:00:00")
      .is("canonical_event_id", null)
      .or("is_class.eq.false,is_class.is.null")
      .or("is_sensitive.eq.false,is_sensitive.is.null");
    q = applyPortalScope(q);
    return q
      .order("start_time", { ascending: true })
      .limit(30);
  };

  // User signals (if authenticated)
  const loadUserSignals = async (): Promise<UserSignals | null> => {
    if (!userId) return null;

    const [prefsResult, followedVenuesResult, followedOrgsResult, friendIdsResult] =
      await Promise.all([
        supabase
          .from("user_preferences")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("follows")
          .select("followed_venue_id")
          .eq("follower_id", userId)
          .not("followed_venue_id", "is", null),
        supabase
          .from("follows")
          .select("followed_organization_id")
          .eq("follower_id", userId)
          .not("followed_organization_id", "is", null),
        supabase.rpc(
          "get_friend_ids" as never,
          { user_id: userId } as never,
        ) as unknown as Promise<{
          data: { friend_id: string }[] | null;
        }>,
      ]);

    const followedVenueIds =
      (followedVenuesResult.data as { followed_venue_id: number | null }[] | null)
        ?.map((f) => f.followed_venue_id)
        .filter((id): id is number => id !== null) ?? [];

    const followedOrganizationIds =
      (followedOrgsResult.data as { followed_organization_id: string | null }[] | null)
        ?.map((f) => f.followed_organization_id)
        .filter((id): id is string => id !== null) ?? [];

    const friendIds = (friendIdsResult.data || []).map((r) => r.friend_id);

    // Source → org mapping
    let producerSourceIds: number[] = [];
    const sourceOrganizationMap: Record<number, string> = {};
    if (followedOrganizationIds.length > 0) {
      const { data: sources } = await supabase
        .from("sources")
        .select("id, organization_id")
        .in("organization_id", followedOrganizationIds);
      if (sources) {
        producerSourceIds = sources.map((s: { id: number }) => s.id);
        for (const s of sources as { id: number; organization_id: string }[]) {
          sourceOrganizationMap[s.id] = s.organization_id;
        }
      }
    }

    return {
      userId,
      followedVenueIds,
      followedOrganizationIds,
      producerSourceIds,
      sourceOrganizationMap,
      friendIds,
      prefs: prefsResult.data as UserSignals["prefs"],
    };
  };

  // ---------------------------------------------------------------------------
  // Tab counts — always fetched (cheap HEAD queries, zero rows transferred)
  // ---------------------------------------------------------------------------

  const countQueries = Promise.all([
    buildCountQuery(today, today),
    buildCountQuery(tomorrow, weekAhead),
    buildCountQuery(weekAhead, fourWeeksAhead),
  ]);

  const categoryQueries = Promise.all([
    buildCategoryQuery(today, today),
    buildCategoryQuery(tomorrow, weekAhead),
    buildCategoryQuery(weekAhead, fourWeeksAhead),
  ]);

  // ---------------------------------------------------------------------------
  // Tab-only mode: ?tab=this_week or ?tab=coming_up
  // Returns just the requested tab's events + fresh counts — minimal payload
  // ---------------------------------------------------------------------------

  if (requestedTab) {
    const [tabStart, tabEnd] =
      requestedTab === "this_week"
        ? [tomorrow, weekAhead]
        : [weekAhead, fourWeeksAhead];

    const tabEventQuery = buildEventQuery(tabStart, tabEnd, 500);
    const tabInterestQueries = buildInterestQueries(tabStart, tabEnd);

    const [tabEventsResult, tabInterestResults, countResults, categoryResults, tabUserSignals] = await Promise.all([
      tabEventQuery,
      Promise.all(tabInterestQueries),
      countQueries,
      categoryQueries,
      loadUserSignals(),
    ]);

    // Merge base pool + per-interest results, deduplicating by event ID
    const baseEvents = (tabEventsResult.data || []) as FeedEventData[];
    const seenTabIds = new Set(baseEvents.map((e) => e.id));
    const interestExtras: FeedEventData[] = [];
    for (const r of tabInterestResults) {
      for (const e of (r.data || []) as FeedEventData[]) {
        if (!seenTabIds.has(e.id)) {
          seenTabIds.add(e.id);
          interestExtras.push(e);
        }
      }
    }
    const mergedTabEvents = [...baseEvents, ...interestExtras];

    const tabEvents = suppressEventImagesIfVenueFlagged(
      mergedTabEvents,
    ) as FeedEventData[];

    // Social proof for tab events
    const tabEventIds = tabEvents.map((e) => e.id);
    const tabSocialCounts = await fetchSocialProofCounts(tabEventIds);
    const tabEventsWithProof = tabEvents.map((e) => {
      const counts = tabSocialCounts.get(e.id);
      return counts
        ? { ...e, going_count: counts.going || 0, interested_count: counts.interested || 0 }
        : e;
    });

    // Friend RSVPs for tab events
    const friendsGoingMap: Record<number, FriendGoingInfo[]> = {};
    if (tabUserSignals && tabUserSignals.friendIds.length > 0 && tabEventIds.length > 0) {
      const { data: friendRsvps } = await supabase
        .from("event_rsvps")
        .select("event_id, user_id")
        .in("event_id", tabEventIds)
        .in("user_id", tabUserSignals.friendIds)
        .in("status", ["going", "interested"]);

      const rsvps = (friendRsvps || []) as { event_id: number; user_id: string }[];
      if (rsvps.length > 0) {
        const rsvpUserIds = [...new Set(rsvps.map((r) => r.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, display_name")
          .in("id", rsvpUserIds);

        const profilesMap = (profiles || []).reduce(
          (acc, p) => {
            const profile = p as { id: string; username: string; display_name: string | null };
            acc[profile.id] = { username: profile.username, display_name: profile.display_name };
            return acc;
          },
          {} as Record<string, { username: string; display_name: string | null }>,
        );

        for (const rsvp of rsvps) {
          const profile = profilesMap[rsvp.user_id];
          if (!profile) continue;
          if (!friendsGoingMap[rsvp.event_id]) {
            friendsGoingMap[rsvp.event_id] = [];
          }
          friendsGoingMap[rsvp.event_id].push({
            user_id: rsvp.user_id,
            username: profile.username,
            display_name: profile.display_name,
          });
        }
      }
    }

    // Build an uncapped event pool for the tab — the frontend handles
    // interest-chip filtering, so we send ALL events (deduped) in one section.
    const tabPoolSection = buildTabEventPool(
      requestedTab as "this_week" | "coming_up",
      tabEventsWithProof,
      tabUserSignals,
      friendsGoingMap,
    );
    const tabSections = [tabPoolSection];

    // Always return HEAD counts for tab badges — these represent the true
    // total for each date range. The frontend handles interest filtering
    // client-side, so tab badges should stay stable when switching tabs.
    const tabCountResults = countResults.map((r) => r.count ?? 0);
    const tabCountsObj = {
      today: tabCountResults[0],
      this_week: tabCountResults[1],
      coming_up: tabCountResults[2],
    };

    const tabResponse: CityPulseResponse = {
      portal: { slug: canonicalSlug, name: portalData.name },
      context: feedContext,
      header: {} as CityPulseResponse["header"],
      sections: tabSections.filter(Boolean) as import("@/lib/city-pulse/types").CityPulseSection[],
      curated_sections: [],
      personalization: {
        level: !userId ? "anonymous" : "logged_in",
        applied: false,
      },
      events_pulse: { total_active: 0, trending_event: null },
      tab_counts: tabCountsObj,
      category_counts: {
        today: buildCategoryCounts((categoryResults[0].data || []) as any[]),
        this_week: buildCategoryCounts((categoryResults[1].data || []) as any[]),
        coming_up: buildCategoryCounts((categoryResults[2].data || []) as any[]),
      },
    };

    return NextResponse.json(tabResponse, {
      headers: {
        "Cache-Control": hasAdminOverrides
          ? "no-store"
          : isAuthenticated
            ? AUTH_CACHE_CONTROL
            : ANON_CACHE_CONTROL,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Full load mode (initial request, no ?tab= param)
  // Fetches today events + counts. Skips week/coming-up event data.
  // ---------------------------------------------------------------------------

  const todayInterestQueries = buildInterestQueries(today, today);

  // Query for this week's recurring events (tomorrow → end of week, series_id not null)
  const buildWeekRecurringQuery = () => {
    let q = portalClient
      .from("events")
      .select(EVENT_SELECT)
      .gte("start_date", today)
      .lte("start_date", weekAhead)
      .not("series_id", "is", null)
      .is("canonical_event_id", null)
      .or("is_class.eq.false,is_class.is.null")
      .or("is_sensitive.eq.false,is_sensitive.is.null");
    q = applyPortalScope(q);
    return q
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(200);
  };

  const [
    todayEventsResult,
    eveningEventsResult,
    todayInterestResults,
    trendingResult,
    weatherVenuesResult,
    specialsResult,
    curatedResult,
    headersResult,
    profileResult,
    userSignals,
    countResults,
    categoryResults,
    weekRecurringResult,
  ] = await Promise.all([
    buildEventQuery(today, today, 50),
    buildEveningQuery(),
    Promise.all(todayInterestQueries),
    buildTrendingQuery(),
    buildWeatherVenueQuery(),
    buildSpecialsQuery(),
    buildCuratedQuery(),
    buildHeadersQuery(),
    buildProfileQuery(),
    loadUserSignals(),
    countQueries,
    categoryQueries,
    buildWeekRecurringQuery(),
  ]);

  const tabCountResults = countResults.map((r) => r.count ?? 0);
  const tab_counts = {
    today: tabCountResults[0],
    this_week: tabCountResults[1],
    coming_up: tabCountResults[2],
  };

  // ---------------------------------------------------------------------------
  // Process raw results
  // ---------------------------------------------------------------------------

  // Merge today + evening + per-interest events, deduplicating by ID
  const todayRaw = (todayEventsResult.data || []) as FeedEventData[];
  const eveningRaw = (eveningEventsResult.data || []) as FeedEventData[];
  const seenIds = new Set(todayRaw.map((e) => e.id));
  for (const e of eveningRaw) {
    if (!seenIds.has(e.id)) { seenIds.add(e.id); todayRaw.push(e); }
  }
  // Merge per-interest results — guarantees ≤6 events per active category
  for (const r of todayInterestResults) {
    for (const e of (r.data || []) as FeedEventData[]) {
      if (!seenIds.has(e.id)) { seenIds.add(e.id); todayRaw.push(e); }
    }
  }
  const todayEvents = suppressEventImagesIfVenueFlagged(todayRaw) as FeedEventData[];

  const weekRecurringEvents = suppressEventImagesIfVenueFlagged(
    (weekRecurringResult.data || []) as FeedEventData[],
  ) as FeedEventData[];

  const trendingEvents = suppressEventImagesIfVenueFlagged(
    (trendingResult.data || []) as FeedEventData[],
  ) as FeedEventData[];

  const weatherVenues = (weatherVenuesResult.data || []) as Spot[];

  // Process specials: compute status
  const rawSpecials = (specialsResult.data || []) as Array<
    SpecialRow & { venue: Pick<Spot, "id" | "name" | "slug" | "neighborhood" | "venue_type" | "image_url"> }
  >;

  const activeSpecials: CityPulseSpecialItem["special"][] = [];
  for (const s of rawSpecials) {
    const status = getSpecialStatus(s, now, today);
    if (status.state === "active_now" || status.state === "starting_soon") {
      activeSpecials.push({
        id: s.id,
        venue: s.venue,
        title: s.title,
        type: s.type,
        state: status.state,
        starts_in_minutes: status.startsInMinutes,
        remaining_minutes: status.remainingMinutes,
        price_note: s.price_note,
        description: s.description,
      });
    }
  }

  // Sort: active_now first, then starting_soon
  activeSpecials.sort((a, b) => {
    if (a.state === "active_now" && b.state !== "active_now") return -1;
    if (a.state !== "active_now" && b.state === "active_now") return 1;
    return (a.starts_in_minutes ?? 999) - (b.starts_in_minutes ?? 999);
  });

  // Event pool for curated sections + social proof (today + trending only on initial load)
  const allEvents = [...todayEvents, ...trendingEvents];

  // ---------------------------------------------------------------------------
  // Parallel post-processing: social proof, friend RSVPs, new from spots
  // These all depend on the main Promise.all results but NOT on each other
  // ---------------------------------------------------------------------------

  const allEventIds = Array.from(new Set(allEvents.map((e) => e.id)));

  // Launch all three in parallel
  const [socialCounts, friendsGoingMap, newFromSpots] = await Promise.all([
    // 1. Social proof counts
    fetchSocialProofCounts(allEventIds),

    // 2. Friend RSVPs + profiles (internal sequential chain)
    (async (): Promise<Record<number, FriendGoingInfo[]>> => {
      const map: Record<number, FriendGoingInfo[]> = {};
      if (!userSignals || userSignals.friendIds.length === 0) return map;

      const { data: friendRsvps } = await supabase
        .from("event_rsvps")
        .select("event_id, user_id")
        .in("event_id", allEventIds)
        .in("user_id", userSignals.friendIds)
        .in("status", ["going", "interested"]);

      const rsvps = (friendRsvps || []) as { event_id: number; user_id: string }[];
      if (rsvps.length === 0) return map;

      const rsvpUserIds = [...new Set(rsvps.map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", rsvpUserIds);

      const profilesMap = (profiles || []).reduce(
        (acc, p) => {
          const profile = p as { id: string; username: string; display_name: string | null };
          acc[profile.id] = { username: profile.username, display_name: profile.display_name };
          return acc;
        },
        {} as Record<string, { username: string; display_name: string | null }>,
      );

      for (const rsvp of rsvps) {
        const profile = profilesMap[rsvp.user_id];
        if (!profile) continue;
        if (!map[rsvp.event_id]) {
          map[rsvp.event_id] = [];
        }
        map[rsvp.event_id].push({
          user_id: rsvp.user_id,
          username: profile.username,
          display_name: profile.display_name,
        });
      }
      return map;
    })(),

    // 3. New from followed spots
    (async (): Promise<FeedEventData[]> => {
      if (!userSignals || userSignals.followedVenueIds.length === 0) return [];
      const { data: followedEvents } = await portalClient
        .from("events")
        .select(EVENT_SELECT)
        .gte("start_date", today)
        .lte("start_date", twoWeeksAhead)
        .in("venue_id", userSignals.followedVenueIds.slice(0, 50))
        .is("canonical_event_id", null)
        .or("is_class.eq.false,is_class.is.null")
        .order("start_date", { ascending: true })
        .limit(10);
      return suppressEventImagesIfVenueFlagged(
        (followedEvents || []) as FeedEventData[],
      ) as FeedEventData[];
    })(),
  ]);

  // Apply social proof to event pools
  const applySocialProof = (events: FeedEventData[]): FeedEventData[] =>
    events.map((e) => {
      const counts = socialCounts.get(e.id);
      return counts
        ? { ...e, going_count: counts.going || 0, interested_count: counts.interested || 0 }
        : e;
    });

  const todayEventsWithProof = applySocialProof(todayEvents);
  const trendingEventsWithProof = applySocialProof(trendingEvents);

  const curatedSections = resolveCuratedSections(
    (curatedResult.data || []) as unknown as RawPortalSection[],
    [...todayEventsWithProof, ...trendingEventsWithProof],
  );

  // ---------------------------------------------------------------------------
  // Your People (friend RSVPs)
  // ---------------------------------------------------------------------------

  const friendRsvpEvents: Array<{ event: FeedEventData; friends: FriendGoingInfo[] }> = [];
  if (Object.keys(friendsGoingMap).length > 0) {
    const allEventsForFriends = [...todayEventsWithProof];
    const eventMap = new Map(allEventsForFriends.map((e) => [e.id, e]));
    for (const [eventIdStr, friends] of Object.entries(friendsGoingMap)) {
      const eventId = Number(eventIdStr);
      const event = eventMap.get(eventId);
      if (event && friends.length > 0) {
        friendRsvpEvents.push({ event, friends });
      }
    }
    // Sort by friend count desc
    friendRsvpEvents.sort((a, b) => b.friends.length - a.friends.length);
  }

  // Trending destinations (featured venues from weather-matched pool)
  const trendingDestinations: Spot[] = weatherVenues
    .filter((v) => v.featured)
    .slice(0, 6);

  // ---------------------------------------------------------------------------
  // Open-now destinations (venues with active specials as proxy for "open")
  // ---------------------------------------------------------------------------

  const openDestinations = activeSpecials
    .filter((s) => s.state === "active_now" && s.venue)
    .reduce((acc, s) => {
      // Deduplicate by venue id
      if (!acc.some((d) => d.id === s.venue.id)) {
        acc.push({
          ...s.venue,
          // Expand to Spot shape with what we have
          address: null,
          city: null,
          lat: null,
          lng: null,
          short_description: null,
          vibes: null,
          genres: null,
          price_level: null,
          hours_display: null,
          featured: false,
          active: true,
          venue_types: null,
          location_designator: null,
          is_open: true,
        } as never);
      }
      return acc;
    }, [] as Array<import("@/lib/spots-constants").Spot & { is_open: boolean }>)
    .slice(0, 4);

  // ---------------------------------------------------------------------------
  // Assemble sections — today + specials + sidebar only (no week/coming-up)
  // ---------------------------------------------------------------------------

  const theSceneSection = buildTheSceneSection(
    todayEventsWithProof,
    weekRecurringEvents,
    userSignals,
    friendsGoingMap,
  );

  const sections = [
    buildBannerSection(feedContext),
    buildRightNowSection(
      feedContext,
      { todayEvents: todayEventsWithProof, activeSpecials, openDestinations },
      userSignals,
      friendsGoingMap,
    ),
    buildTonightSection(
      feedContext,
      { todayEvents: todayEventsWithProof, activeSpecials },
      userSignals,
      friendsGoingMap,
    ),
    theSceneSection,
    buildThemedSpecialsSection(feedContext, activeSpecials),
    buildWeatherDiscoverySection(
      feedContext,
      weatherVenues,
      weatherFilter?.label ?? "",
      weatherFilter?.subtitle ?? "",
      userSignals,
    ),
    buildYourPeopleSection({ friendRsvps: friendRsvpEvents }),
    buildNewFromSpotsSection(newFromSpots),
    buildTrendingSection(trendingEventsWithProof, trendingDestinations, userSignals, friendsGoingMap),
    buildBrowseSection(canonicalSlug),
  ].filter(Boolean) as import("@/lib/city-pulse/types").CityPulseSection[];

  // ---------------------------------------------------------------------------
  // Insert conversion prompts for anonymous/low-pref users
  // ---------------------------------------------------------------------------

  const personalizationLevel: PersonalizationLevel = !userId
    ? "anonymous"
    : userSignals?.prefs?.favorite_categories?.length
      ? userSignals.friendIds.length > 0
        ? "has_social"
        : "has_prefs"
      : "logged_in";

  const conversionPrompts = getAllConversionPrompts(
    personalizationLevel,
    canonicalSlug,
  );

  // Insert conversion items after their target sections
  for (const section of sections) {
    const prompt = conversionPrompts.get(section.type);
    if (prompt) {
      section.items.push(prompt);
    }
  }

  // ---------------------------------------------------------------------------
  // Resolve feed header (CMS override layer)
  // ---------------------------------------------------------------------------

  const topTrendingEvent = trendingEventsWithProof.length > 0
    ? trendingEventsWithProof[0].title
    : null;

  const eventsPulse = {
    total_active: todayEventsWithProof.length,
    trending_event: topTrendingEvent,
  };

  const headerCandidates = (headersResult.data || []) as FeedHeaderRow[];
  const userProfile = profileResult.data as { display_name: string | null; username: string | null } | null;

  const resolvedHeader = await resolveHeader({
    candidates: headerCandidates,
    context: feedContext,
    portalSlug: canonicalSlug,
    portalId: portalData.id,
    portalName: portalData.name,
    eventsPulse,
    now,
    user: userProfile,
    supabase,
    portalCity,
  });

  // ---------------------------------------------------------------------------
  // Apply event moderation (suppress / boost) from feed header
  // ---------------------------------------------------------------------------

  const suppressedIds = new Set(resolvedHeader.suppressed_event_ids);
  const boostedIds = new Set(resolvedHeader.boosted_event_ids);

  if (suppressedIds.size > 0 || boostedIds.size > 0) {
    for (const section of sections) {
      if (suppressedIds.size > 0) {
        section.items = section.items.filter(
          (item) => item.item_type !== "event" || !suppressedIds.has(item.event.id),
        );
      }

      if (boostedIds.size > 0) {
        const boosted: typeof section.items = [];
        const rest: typeof section.items = [];
        for (const item of section.items) {
          if (item.item_type === "event" && boostedIds.has(item.event.id)) {
            boosted.push(item);
          } else {
            rest.push(item);
          }
        }
        if (boosted.length > 0) {
          section.items = [...boosted, ...rest];
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Build response
  // ---------------------------------------------------------------------------

  const response: CityPulseResponse = {
    portal: {
      slug: canonicalSlug,
      name: portalData.name,
    },
    context: feedContext,
    header: resolvedHeader,
    sections,
    curated_sections: curatedSections,
    personalization: {
      level: personalizationLevel,
      applied: isAuthenticated && personalizationLevel !== "logged_in",
    },
    events_pulse: eventsPulse,
    tab_counts,
    category_counts: {
      today: buildCategoryCounts((categoryResults[0].data || []) as any[]),
      this_week: buildCategoryCounts((categoryResults[1].data || []) as any[]),
      coming_up: buildCategoryCounts((categoryResults[2].data || []) as any[]),
    },
  };

  // ---------------------------------------------------------------------------
  // Cache + return
  // ---------------------------------------------------------------------------

  if (!hasAdminOverrides && !requestedTab) {
    await setSharedCacheJson(
      CACHE_NAMESPACE,
      cacheKey,
      response,
      isAuthenticated ? AUTH_CACHE_TTL_MS : ANON_CACHE_TTL_MS,
      { maxEntries: CACHE_MAX_ENTRIES },
    );
  }

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": hasAdminOverrides
        ? "no-store"
        : isAuthenticated
          ? AUTH_CACHE_CONTROL
          : ANON_CACHE_CONTROL,
    },
  });
}
