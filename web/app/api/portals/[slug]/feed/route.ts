import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { addDays, startOfDay, nextFriday, nextSunday, isFriday, isSaturday, isSunday } from "date-fns";
import { getLocalDateString } from "@/lib/formats";
import { getPortalSourceAccess } from "@/lib/federation";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { errorResponse, isValidUUID } from "@/lib/api-utils";
import { fetchSocialProofCounts } from "@/lib/search";
import { normalizePortalSlug, resolvePortalSlugAlias } from "@/lib/portal-aliases";
import { applyManifestFederatedScopeToQuery } from "@/lib/portal-scope";
import { buildPortalManifest, shouldApplyCityFilter } from "@/lib/portal-manifest";

// Cache feed for 5 minutes at CDN, allow stale for 1 hour while revalidating
export const revalidate = 300;

const FEED_CACHE_TTL_MS = 5 * 60 * 1000;
const FEED_CACHE_MAX_ENTRIES = 100;
const FEED_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=3600";

const feedPayloadCache = new Map<string, { expiresAt: number; payload: unknown }>();

function getCachedFeedPayload(cacheKey: string): unknown | null {
  const entry = feedPayloadCache.get(cacheKey);
  if (!entry) {
    return null;
  }
  if (entry.expiresAt <= Date.now()) {
    feedPayloadCache.delete(cacheKey);
    return null;
  }
  return entry.payload;
}

function setCachedFeedPayload(cacheKey: string, payload: unknown): void {
  if (feedPayloadCache.size >= FEED_CACHE_MAX_ENTRIES) {
    const firstKey = feedPayloadCache.keys().next().value;
    if (firstKey) {
      feedPayloadCache.delete(firstKey);
    }
  }
  feedPayloadCache.set(cacheKey, {
    expiresAt: Date.now() + FEED_CACHE_TTL_MS,
    payload,
  });
}

type Props = {
  params: Promise<{ slug: string }>;
};

type SectionItem = {
  id: string;
  entity_type: string;
  entity_id: number;
  display_order: number;
};

type Section = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  section_type: "auto" | "curated" | "mixed";
  block_type: string;
  layout: string;
  items_per_row: number;
  max_items: number;
  auto_filter: AutoFilter | null;
  block_content: Record<string, unknown> | null;
  display_order: number;
  is_visible: boolean;
  schedule_start: string | null;
  schedule_end: string | null;
  show_on_days: string[] | null;
  show_after_time: string | null;
  show_before_time: string | null;
  style: Record<string, unknown> | null;
  portal_section_items: SectionItem[];
};

type AutoFilter = {
  categories?: string[];
  subcategories?: string[];
  neighborhoods?: string[];
  tags?: string[];
  is_free?: boolean;
  price_max?: number;
  date_filter?: "today" | "tomorrow" | "this_weekend" | "next_7_days" | "next_30_days";
  sort_by?: "date" | "popularity" | "trending" | "random";
  source_ids?: number[];
  venue_ids?: number[];
  exclude_ids?: number[];
  exclude_categories?: string[]; // Categories to exclude from results
  event_ids?: number[]; // Specific events to show (for pinned/featured content)
  nightlife_mode?: boolean; // Compound filter: nightlife + music/comedy/dance/gaming at nightlife venues or after 7pm
};

type Event = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  is_all_day: boolean;
  is_free: boolean;
  price_min: number | null;
  price_max: number | null;
  category: string | null;
  genres?: string[] | null;
  subcategory?: string | null;
  image_url: string | null;
  description: string | null;
  featured_blurb: string | null;
  going_count?: number;
  interested_count?: number;
  recommendation_count?: number;
  tags?: string[] | null;
  source_id?: number | null;
  series_id?: string | null;
  series?: {
    id: string;
    slug: string;
    title: string;
    series_type: string;
    image_url: string | null;
    frequency: string | null;
    day_of_week: string | null;
    festival?: {
      id: string;
      slug: string;
      name: string;
      image_url: string | null;
      festival_type?: string | null;
      location: string | null;
      neighborhood: string | null;
    } | null;
  } | null;
  venue: {
    id: number;
    name: string;
    neighborhood: string | null;
    slug: string | null;
    venue_type: string | null;
    city: string | null;
  } | null;
};

// Check if section should be visible based on schedule rules
function isSectionVisible(section: Section): boolean {
  const now = new Date();
  const today = getLocalDateString();
  const currentTime = now.toTimeString().slice(0, 5); // HH:MM
  const currentDay = now.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();

  // Check date range
  if (section.schedule_start && today < section.schedule_start) {
    return false;
  }
  if (section.schedule_end && today > section.schedule_end) {
    return false;
  }

  // Check day of week
  if (section.show_on_days && section.show_on_days.length > 0) {
    if (!section.show_on_days.includes(currentDay)) {
      return false;
    }
  }

  // Check time of day
  if (section.show_after_time && currentTime < section.show_after_time) {
    return false;
  }
  if (section.show_before_time && currentTime > section.show_before_time) {
    return false;
  }

  return true;
}

// Get date range for filter
function getDateRange(filter: string): { start: string; end: string } {
  const now = new Date();
  const today = startOfDay(now);

  switch (filter) {
    case "today":
      return {
        start: getLocalDateString(today),
        end: getLocalDateString(today),
      };
    case "tomorrow":
      const tomorrow = addDays(today, 1);
      return {
        start: getLocalDateString(tomorrow),
        end: getLocalDateString(tomorrow),
      };
    case "this_weekend": {
      // Friday through Sunday
      let friday: Date;
      let sunday: Date;

      if (isFriday(now) || isSaturday(now) || isSunday(now)) {
        // We're in the weekend, use current week
        friday = isFriday(now) ? today : addDays(today, -(now.getDay() - 5));
        sunday = isSunday(now) ? today : addDays(today, 7 - now.getDay());
      } else {
        // Use next weekend
        friday = nextFriday(today);
        sunday = nextSunday(today);
      }

      return {
        start: getLocalDateString(friday),
        end: getLocalDateString(sunday),
      };
    }
    case "next_7_days":
      return {
        start: getLocalDateString(today),
        end: getLocalDateString(addDays(today, 7)),
      };
    case "next_30_days":
      return {
        start: getLocalDateString(today),
        end: getLocalDateString(addDays(today, 30)),
      };
    default:
      return {
        start: getLocalDateString(today),
        end: getLocalDateString(addDays(today, 14)),
      };
  }
}

// Classify a nightlife event into its activity type
// Reusable across nightlife carousel counting + event stamping
function classifyNightlifeActivity(event: { title: string; category: string | null; genres?: string[] | null; subcategory?: string | null }): string {
  // Genre values that map directly to nightlife activity keys
  const genreActivityMap: Record<string, string> = {
    karaoke: "karaoke",
    trivia: "trivia",
    bar_games: "bar_games",
    poker: "poker",
    bingo: "bingo",
    dj: "dj",
    drag: "drag",
    burlesque: "drag",         // Merged into drag
    latin_night: "latin_night",
    line_dancing: "line_dancing",
    party: "party",
    pub_crawl: "pub_crawl",
    specials: "specials",
  };
  const nightlifeSubcatMap: Record<string, string> = {
    "nightlife.karaoke": "karaoke",
    "nightlife.trivia": "trivia",
    "nightlife.bar_games": "bar_games",
    "nightlife.poker": "poker",
    "nightlife.bingo": "bingo",
    "nightlife.dj": "dj",
    "nightlife.drag": "drag",
    "nightlife.burlesque": "drag",
    "nightlife.latin_night": "latin_night",
    "nightlife.line_dancing": "line_dancing",
    "nightlife.party": "party",
    "nightlife.pub_crawl": "pub_crawl",
    "nightlife.specials": "specials",
  };
  const titlePatterns: [RegExp, string][] = [
    [/karaoke/i, "karaoke"],
    [/trivia/i, "trivia"],
    [/bingo/i, "bingo"],
    [/poker/i, "poker"],
    [/two.?step|line.?danc|country.?danc/i, "line_dancing"],
    [/salsa|bachata|latin|reggaeton/i, "latin_night"],
    [/drag\b|cabaret|burlesque/i, "drag"],
    [/\bdj\b|dance.?party|club.?night/i, "dj"],
    [/bocce|skee.?ball|curling|darts|shuffleboard|bowling|arcade|bar.?game/i, "bar_games"],
    [/pub.?crawl/i, "pub_crawl"],
  ];

  // 1. Check genres first (preferred source)
  if (event.genres?.length) {
    for (const genre of event.genres) {
      if (genreActivityMap[genre]) return genreActivityMap[genre];
    }
  }
  // 2. Fallback: check legacy subcategory
  if (event.subcategory && nightlifeSubcatMap[event.subcategory]) {
    return nightlifeSubcatMap[event.subcategory];
  }
  // 3. Infer from title
  for (const [pattern, key] of titlePatterns) {
    if (pattern.test(event.title)) {
      return key;
    }
  }
  // 4. Fall back to cross-category mapping
  if (event.category === "music") return "live_music";
  if (event.category === "comedy") return "comedy";
  if (event.category === "dance") return "dance";
  return "other";
}

const NIGHTLIFE_ACTIVITY_LABELS: Record<string, string> = {
  karaoke: "Karaoke",
  trivia: "Trivia",
  bar_games: "Bar Games",
  poker: "Poker",
  bingo: "Bingo",
  dj: "DJ Night",
  drag: "Drag & Cabaret",
  latin_night: "Latin Night",
  line_dancing: "Line Dancing",
  party: "Party",
  pub_crawl: "Pub Crawl",
  specials: "Specials",
  live_music: "Live Music",
  comedy: "Freakin Clowns",
  dance: "Dance",
  other: "Nightlife",
};

const COMMUNITY_SECTION_HINT = /\b(get[-\s]?involved|volunteer|activism|civic|community\s+support|community\s+action)\b/i;

function isCommunityActionSection(section: Pick<Section, "slug" | "title" | "auto_filter">): boolean {
  const categories = section.auto_filter?.categories || [];
  const subcategories = section.auto_filter?.subcategories || [];
  const tags = section.auto_filter?.tags || [];

  if (categories.some((category) => category === "community" || category === "activism")) {
    return true;
  }

  if (subcategories.some((subcategory) => /\b(community|volunteer|activism|civic)\b/i.test(subcategory))) {
    return true;
  }

  if (tags.some((tag) => /\b(volunteer|activism|community|civic)\b/i.test(tag))) {
    return true;
  }

  return COMMUNITY_SECTION_HINT.test(`${section.slug} ${section.title}`);
}

// GET /api/portals/[slug]/feed - Get feed content for a portal
export async function GET(request: NextRequest, { params }: Props) {
  // Rate limit - use read limit since this is a common read endpoint
  const rateLimitResult = await applyRateLimit(request, RATE_LIMITS.read, getClientIdentifier(request));
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await params;
  const requestSlug = normalizePortalSlug(slug);
  const canonicalSlug = resolvePortalSlugAlias(requestSlug);
  const { searchParams } = new URL(request.url);
  const sectionIds = searchParams.get("sections")?.split(",").filter(Boolean);
  const parsedLimit = Number.parseInt(searchParams.get("limit") || "5", 10);
  const defaultLimit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 50)) : 5;
  const sectionKey = (sectionIds || []).slice().sort().join(",");
  const cacheKey = `${canonicalSlug}|${defaultLimit}|${sectionKey}`;
  const cachedPayload = getCachedFeedPayload(cacheKey);
  if (cachedPayload) {
    return NextResponse.json(cachedPayload, {
      headers: {
        "Cache-Control": FEED_CACHE_CONTROL,
      },
    });
  }

  const supabase = await createClient();

  // Get portal
  // Try with parent_portal_id first, fall back if column doesn't exist (older schemas)
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

  const portalData = portalResult.data as { id: string; slug: string; name: string; portal_type: string; parent_portal_id?: string | null; settings: Record<string, unknown>; filters?: Record<string, unknown> | string | null } | null;

  if (portalResult.error || !portalData) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  // Parse portal filters to extract city constraint for geo-filtering
  let portalFilters: { city?: string; cities?: string[] } = {};
  if (portalData.filters) {
    if (typeof portalData.filters === "string") {
      try { portalFilters = JSON.parse(portalData.filters); } catch { /* ignore */ }
    } else {
      portalFilters = portalData.filters as { city?: string; cities?: string[] };
    }
  }
  const portalCities = Array.from(new Set(
    [...(portalFilters.cities || []), ...(portalFilters.city ? [portalFilters.city] : [])]
      .map((c) => c?.trim().toLowerCase())
      .filter(Boolean) as string[]
  ));

  const portal = {
    id: portalData.id,
    slug: requestSlug,
    name: portalData.name,
    portal_type: portalData.portal_type,
    parent_portal_id: portalData.parent_portal_id ?? null,
    settings: portalData.settings,
  };

  // Validate portal ID to prevent injection
  if (!isValidUUID(portal.id)) {
    return NextResponse.json({ error: "Invalid portal" }, { status: 400 });
  }

  const feedSettings = (portal.settings?.feed || {}) as {
    feed_type?: string;
    featured_section_ids?: string[];
    items_per_section?: number;
    default_layout?: string;
  };

  // Fetch federation access in parallel with section lookup.
  const federationAccessPromise = getPortalSourceAccess(portal.id);

  // Determine which sections to fetch
  let sectionsToFetch = sectionIds;
  if (!sectionsToFetch && feedSettings.featured_section_ids?.length) {
    sectionsToFetch = feedSettings.featured_section_ids;
  }

  // Fetch sections with their items
  let sectionsQuery = supabase
    .from("portal_sections")
    .select(`
      id,
      title,
      slug,
      description,
      section_type,
      block_type,
      layout,
      items_per_row,
      max_items,
      auto_filter,
      block_content,
      display_order,
      is_visible,
      schedule_start,
      schedule_end,
      show_on_days,
      show_after_time,
      show_before_time,
      style,
      portal_section_items(id, entity_type, entity_id, display_order)
    `)
    .eq("portal_id", portal.id)
    .eq("is_visible", true)
    .order("display_order", { ascending: true });

  if (sectionsToFetch?.length) {
    sectionsQuery = sectionsQuery.in("id", sectionsToFetch);
  }

  const { data: sectionsData, error: sectionsError } = await sectionsQuery;

  if (sectionsError) {
    return errorResponse(sectionsError, "portal feed sections");
  }

  const allSections = (sectionsData || []) as Section[];

  // Filter sections by visibility rules
  const sections = allSections.filter((section) => {
    if (!isSectionVisible(section)) return false;

    // Health-vertical sections belong only on hospital portals, not city feeds.
    const hospitalOnlySections = ["outdoor-wellness", "food-access-support", "public-health-resources"];
    if (hospitalOnlySections.includes(section.slug) && portal.portal_type !== "hospital") {
      return false;
    }

    return true;
  });

  // Collect all curated and pinned event IDs from sections
  const eventIds = new Set<number>();
  const pinnedEventIds = new Set<number>();
  for (const section of sections) {
    if (section.section_type === "curated" || section.section_type === "mixed") {
      for (const item of section.portal_section_items || []) {
        if (item.entity_type === "event") {
          eventIds.add(item.entity_id);
        }
      }
    }
    if (section.auto_filter?.event_ids?.length) {
      for (const id of section.auto_filter.event_ids) {
        pinnedEventIds.add(id);
      }
    }
  }

  const today = getLocalDateString();
  const curatedEventSelect = `
        id,
        title,
        start_date,
        start_time,
        end_date,
        end_time,
        is_all_day,
        is_free,
        price_min,
        price_max,
        category,
        image_url,
        description,
        featured_blurb,
        tags,
        series_id,
        series:series_id(
          id,
          slug,
          title,
          series_type,
          image_url,
          frequency,
          day_of_week,
          festival:festivals(id, slug, name, image_url, festival_type, location, neighborhood)
        ),
        venue:venues(id, name, neighborhood, slug, venue_type)
      `;

  const curatedEventsPromise = eventIds.size > 0
    ? supabase
      .from("events")
      .select(curatedEventSelect)
      .in("id", Array.from(eventIds))
      .or(`start_date.gte.${today},end_date.gte.${today}`)
      .is("canonical_event_id", null)
      .or("is_class.eq.false,is_class.is.null")
      .or("is_sensitive.eq.false,is_sensitive.is.null")
    : Promise.resolve({ data: [] as Event[] });

  const pinnedEventsPromise = pinnedEventIds.size > 0
    ? supabase
      .from("events")
      .select(curatedEventSelect)
      .in("id", Array.from(pinnedEventIds))
      .is("canonical_event_id", null)
      .or("is_class.eq.false,is_class.is.null")
      .or("is_sensitive.eq.false,is_sensitive.is.null")
    : Promise.resolve({ data: [] as Event[] });

  const [{ data: curatedEvents }, { data: pinnedEvents }, federationAccess] = await Promise.all([
    curatedEventsPromise,
    pinnedEventsPromise,
    federationAccessPromise,
  ]);

  const manifest = buildPortalManifest({
    portalId: portal.id,
    slug: portal.slug,
    portalType: portal.portal_type,
    parentPortalId: portal.parent_portal_id,
    settings: portal.settings,
    filters: portalFilters,
    sourceIds: federationAccess.sourceIds,
  });
  const enforcePortalCityFilter = shouldApplyCityFilter(manifest);
  const hasSubscribedSources = manifest.scope.allowFederatedSources;

  // Merge curated + pinned event rows into a single lookup map
  const eventMap = new Map<number, Event>();
  for (const event of (curatedEvents || []) as Event[]) {
    eventMap.set(event.id, event);
  }
  for (const event of (pinnedEvents || []) as Event[]) {
    eventMap.set(event.id, event);
  }

  // Step 3: Determine if we need auto-filtered events and get widest date range needed
  const sectionsNeedingAutoEvents = sections.filter(
    s => (s.section_type === "auto" || s.section_type === "mixed") &&
         s.auto_filter &&
         !s.auto_filter.event_ids?.length &&
         !["category_grid", "announcement", "external_link", "countdown"].includes(s.block_type)
  );

  // Build master event pool for auto sections
  const autoEventPool = new Map<number, Event>();

  if (sectionsNeedingAutoEvents.length > 0) {
    // Source/venue-constrained sections can be starved by a globally limited pool.
    // Track explicit constraints so we can merge a targeted supplement query.
    const constrainedSourceIds = Array.from(
      new Set(
        sectionsNeedingAutoEvents.flatMap(section => section.auto_filter?.source_ids || [])
      )
    );
    const constrainedVenueIds = Array.from(
      new Set(
        sectionsNeedingAutoEvents.flatMap(section => section.auto_filter?.venue_ids || [])
      )
    );

    // Find the widest date range needed across all sections
    let maxEndDate = getLocalDateString(addDays(new Date(), 14)); // Default 2 weeks

    for (const section of sectionsNeedingAutoEvents) {
      const filter = section.auto_filter!;
      if (filter.date_filter) {
        const { end } = getDateRange(filter.date_filter);
        if (end > maxEndDate) maxEndDate = end;
      }
    }

    // Calculate max events needed
    // Per-section budget for each date bucket
    const requestedPerBucket = sectionsNeedingAutoEvents.reduce((sum, s) => {
      return sum + ((s.max_items || feedSettings.items_per_section || defaultLimit) * 2);
    }, 0);
    // Keep cold-load DB fanout bounded for large portals while preserving enough candidates.
    const perBucketLimit = Math.max(40, Math.min(requestedPerBucket, 120));

    // Build a base query with shared filters, then run it per date bucket
    // so that busy days (100+ events) don't starve later dates
    const eventSelect = `
        id,
        title,
        start_date,
        start_time,
        end_date,
        end_time,
        is_all_day,
        is_free,
        price_min,
        price_max,
        category,
        image_url,
        description,
        featured_blurb,
        tags,
        series_id,
        series:series_id(
          id,
          slug,
          title,
          series_type,
          image_url,
          frequency,
          day_of_week,
          festival:festivals(id, slug, name, image_url, festival_type, location, neighborhood)
        ),
        source_id,
        venue:venues(id, name, neighborhood, slug, venue_type, city)
    `;

    const applyPortalFilter = (query: ReturnType<typeof supabase.from>) => {
      return applyManifestFederatedScopeToQuery(query, manifest, {
        sourceIds: hasSubscribedSources ? federationAccess.sourceIds : [],
        publicOnlyWhenNoPortal: true,
      });
    };

    // Date bucket boundaries
    const dayOfWeek = new Date().getDay();
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const endOfWeekDate = new Date();
    endOfWeekDate.setDate(endOfWeekDate.getDate() + daysUntilSunday);
    const endOfWeekStr = getLocalDateString(endOfWeekDate);
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = getLocalDateString(tomorrowDate);

    // Run 3 queries in parallel: today, rest of week, rest of month
    const buildBucketQuery = (startDate: string, endDate: string, limit: number) => {
      let q = supabase
        .from("events")
        .select(eventSelect)
        .gte("start_date", startDate)
        .lte("start_date", endDate)
        .is("canonical_event_id", null)
        .or("is_class.eq.false,is_class.is.null")
        .or("is_sensitive.eq.false,is_sensitive.is.null");
      q = applyPortalFilter(q);
      return q
        .order("start_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(limit);
    };

    const [todayResult, weekResult, laterResult] = await Promise.all([
      buildBucketQuery(today, today, perBucketLimit),
      daysUntilSunday > 0
        ? buildBucketQuery(tomorrowStr, endOfWeekStr, perBucketLimit)
        : Promise.resolve({ data: [] as Event[] }),
      buildBucketQuery(
        getLocalDateString(new Date(endOfWeekDate.getTime() + 86400000)),
        maxEndDate,
        perBucketLimit
      ),
    ]);

    // Merge all buckets into the pool
    const addToPool = (events: Event[]) => {
      for (const event of events) {
        if (event.source_id && federationAccess.categoryConstraints.has(event.source_id)) {
          const allowedCategories = federationAccess.categoryConstraints.get(event.source_id);
          if (allowedCategories !== null && allowedCategories !== undefined && event.category && !allowedCategories.includes(event.category)) {
            continue;
          }
        }
        // Filter out events from wrong cities (e.g. Nashville events leaking into Atlanta portals)
        if (enforcePortalCityFilter && portalCities.length > 0 && event.venue?.city) {
          const venueCity = event.venue.city.trim().toLowerCase();
          if (venueCity && !portalCities.some((pc) => {
            // Exact match or word-boundary match (handles "East Atlanta", "Atlanta, GA")
            if (venueCity === pc) return true;
            // Check if the portal city appears as a whole word in the venue city
            const regex = new RegExp(`\\b${pc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
            return regex.test(venueCity);
          })) {
            continue;
          }
        }
        autoEventPool.set(event.id, event);
      }
    };

    addToPool((todayResult.data || []) as Event[]);
    addToPool(((weekResult as { data: Event[] | null }).data || []) as Event[]);
    addToPool((laterResult.data || []) as Event[]);

    // Supplemental query: explicitly pull from constrained sources/venues so those
    // sections always have a fair candidate pool before section-level filtering.
    if (constrainedSourceIds.length > 0 || constrainedVenueIds.length > 0) {
      let constrainedQuery = supabase
        .from("events")
        .select(`
          id,
          title,
          start_date,
          start_time,
          end_date,
          end_time,
          is_all_day,
          is_free,
          price_min,
          price_max,
          category,
            image_url,
          description,
          featured_blurb,
          tags,
          series_id,
          series:series_id(
            id,
            slug,
            title,
            series_type,
            image_url,
            frequency,
            day_of_week,
            festival:festivals(id, slug, name, image_url, festival_type, location, neighborhood)
          ),
          source_id,
          venue:venues(id, name, neighborhood, slug, venue_type)
        `)
        .or(`start_date.gte.${today},end_date.gte.${today}`) // Include ongoing events (exhibitions)
        .lte("start_date", maxEndDate)
        .is("canonical_event_id", null)
        .or("is_class.eq.false,is_class.is.null")
        .or("is_sensitive.eq.false,is_sensitive.is.null");

      if (constrainedSourceIds.length > 0 && constrainedVenueIds.length > 0) {
        constrainedQuery = constrainedQuery.or(
          `source_id.in.(${constrainedSourceIds.join(",")}),venue_id.in.(${constrainedVenueIds.join(",")})`
        );
      } else if (constrainedSourceIds.length > 0) {
        constrainedQuery = constrainedQuery.in("source_id", constrainedSourceIds);
      } else if (constrainedVenueIds.length > 0) {
        constrainedQuery = constrainedQuery.in("venue_id", constrainedVenueIds);
      }

      // Re-apply portal federation visibility guardrails
      constrainedQuery = applyPortalFilter(constrainedQuery);

      const supplementalLimit = Math.min(
        220,
        Math.max(constrainedSourceIds.length * 30, constrainedVenueIds.length * 25, 80)
      );

      const { data: constrainedEvents } = await constrainedQuery
        .order("start_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(supplementalLimit);

      addToPool((constrainedEvents || []) as Event[]);
    }

    // Supplemental query: nightlife_mode sections need nightlife + late-night events
    // that may be cut off by the per-bucket limit on busy days (events ordered by start_time)
    const hasNightlifeSection = sectionsNeedingAutoEvents.some(s => s.auto_filter?.nightlife_mode);
    if (hasNightlifeSection) {
      let nightlifeQuery = supabase
        .from("events")
        .select(eventSelect)
        .or(`start_date.gte.${today},end_date.gte.${today}`)
        .lte("start_date", maxEndDate)
        .is("canonical_event_id", null)
        .or("is_class.eq.false,is_class.is.null")
        .or("is_sensitive.eq.false,is_sensitive.is.null")
        .or(`category.eq.nightlife,category.in.(music,comedy,dance,gaming)`);
      nightlifeQuery = applyPortalFilter(nightlifeQuery);
      const { data: nightlifeEvents } = await nightlifeQuery
        .order("start_date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(80);

      addToPool((nightlifeEvents || []) as Event[]);
    }

    // Filter regular showtimes from the auto event pool
    // Showtimes belong in the dedicated showtimes rollup, not curated feeds
    for (const [eventId, event] of autoEventPool) {
      if (event.tags?.includes("showtime")) {
        autoEventPool.delete(eventId);
      }
    }
  }

  // Step 4: Check if any section needs popularity sorting - batch fetch RSVP counts
  const needsPopularitySort = sectionsNeedingAutoEvents.some(s => s.auto_filter?.sort_by === "popularity");
  const rsvpCounts: Record<number, number> = {};

  if (needsPopularitySort && autoEventPool.size > 0) {
    const { data: rsvpData } = await supabase
      .from("event_rsvps")
      .select("event_id")
      .in("event_id", Array.from(autoEventPool.keys()))
      .eq("status", "going");

    for (const rsvp of (rsvpData || []) as { event_id: number }[]) {
      rsvpCounts[rsvp.event_id] = (rsvpCounts[rsvp.event_id] || 0) + 1;
    }
  }

  // Step 5: Add programmatic holiday sections
  const holidaySections: Section[] = [];
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // 1-12
  const currentDay = currentDate.getDate();

  // Add holiday sections starting late January through early March
  const showHolidaySections =
    (currentMonth === 1 && currentDay >= 20) || // Late January
    currentMonth === 2 || // All of February
    (currentMonth === 3 && currentDay <= 5); // Early March for Mardi Gras

  if (showHolidaySections) {
    // Friday the 13th section (Feb 10-13)
    if (currentMonth === 2 && currentDay >= 10 && currentDay <= 13) {
      holidaySections.push({
        id: `friday-the-13th-${currentYear}`,
        title: "Friday the 13th",
        slug: "friday-the-13th",
        description: "Embrace the unlucky",
        section_type: "auto",
        block_type: "collapsible_events",
        layout: "grid",
        items_per_row: 2,
        max_items: 20,
        auto_filter: {
          tags: ["friday-13"],
          date_filter: "next_7_days",
          sort_by: "date",
        },
        block_content: null,
        display_order: -8,
        is_visible: true,
        schedule_start: null,
        schedule_end: null,
        show_on_days: null,
        show_after_time: null,
        show_before_time: null,
        style: {
          accent_color: "#00ff41", // Matrix green
          icon: "knife",
        },
        portal_section_items: [],
      });
    }

    // Valentine's Day section (Jan 20 - Feb 14)
    if ((currentMonth === 1 && currentDay >= 20) || (currentMonth === 2 && currentDay <= 14)) {
      holidaySections.push({
        id: `valentines-${currentYear}`,
        title: "Valentine's Day",
        slug: "valentines-day",
        description: "Be still thy beating heart",
        section_type: "auto",
        block_type: "collapsible_events",
        layout: "grid",
        items_per_row: 2,
        max_items: 20,
        auto_filter: {
          tags: ["valentines"],
          date_filter: "next_30_days",
          sort_by: "date",
        },
        block_content: null,
        display_order: -5,
        is_visible: true,
        schedule_start: null,
        schedule_end: null,
        show_on_days: null,
        show_after_time: null,
        show_before_time: null,
        style: {
          accent_color: "#FF69B4", // Neon pink
          icon: "anatomical-heart",
        },
        portal_section_items: [],
      });
    }

    // Mardi Gras section (Feb 12-17 for Fat Tuesday Feb 17, 2026)
    if (currentMonth === 2 && currentDay >= 12 && currentDay <= 17) {
      holidaySections.push({
        id: `mardi-gras-${currentYear}`,
        title: "Mardi Gras",
        slug: "mardi-gras",
        description: "Laissez les bons temps rouler",
        section_type: "auto",
        block_type: "collapsible_events",
        layout: "grid",
        items_per_row: 2,
        max_items: 20,
        auto_filter: {
          tags: ["mardi-gras"],
          date_filter: "next_7_days",
          sort_by: "date",
        },
        block_content: null,
        display_order: -3,
        is_visible: true,
        schedule_start: null,
        schedule_end: null,
        show_on_days: null,
        show_after_time: null,
        show_before_time: null,
        style: {
          accent_color: "#ffd700", // Mardi Gras gold
          icon: "mardi-gras-mask",
        },
        portal_section_items: [],
      });
    }

    // Lunar New Year section (Jan 20 - Feb 28)
    if ((currentMonth === 1 && currentDay >= 20) || currentMonth === 2) {
      holidaySections.push({
        id: `lunar-new-year-${currentYear}`,
        title: "Lunar New Year",
        slug: "lunar-new-year",
        description: "A Year of Fire Horsin' Around",
        section_type: "auto",
        block_type: "collapsible_events",
        layout: "grid",
        items_per_row: 2,
        max_items: 20,
        auto_filter: {
          tags: ["lunar-new-year"],
          date_filter: "next_30_days",
          sort_by: "date",
        },
        block_content: null,
        display_order: -4,
        is_visible: true,
        schedule_start: null,
        schedule_end: null,
        show_on_days: null,
        show_after_time: null,
        show_before_time: null,
        style: {
          accent_color: "#DC143C", // Crimson red
          icon: "fire-horse",
        },
        portal_section_items: [],
      });
    }

    // Super Bowl section (show the full week leading up + game day)
    if (currentMonth === 2 && currentDay >= 2 && currentDay <= 9) {
      holidaySections.push({
        id: `super-bowl-${currentYear}`,
        title: "Super Bowl LX",
        slug: "super-bowl",
        description: "Patriots vs Seahawks - Watch parties & game day events",
        section_type: "auto",
        block_type: "collapsible_events",
        layout: "grid",
        items_per_row: 2,
        max_items: 20,
        auto_filter: {
          tags: ["super-bowl"],
          date_filter: "next_7_days",
          sort_by: "date",
        },
        block_content: null,
        display_order: -7,
        is_visible: true,
        schedule_start: null,
        schedule_end: null,
        show_on_days: null,
        show_after_time: null,
        show_before_time: null,
        style: {
          accent_color: "var(--neon-green)",
          icon: "football",
        },
        portal_section_items: [],
      });
    }

    // Black History Month section (Jan 20 - Feb 28)
    if ((currentMonth === 1 && currentDay >= 20) || currentMonth === 2) {
      holidaySections.push({
        id: `black-history-month-${currentYear}`,
        title: "Black History Month",
        slug: "black-history-month",
        description: "Celebrate and learn",
        section_type: "auto",
        block_type: "collapsible_events",
        layout: "grid",
        items_per_row: 2,
        max_items: 20,
        auto_filter: {
          tags: ["black-history-month"],
          date_filter: "next_30_days",
          sort_by: "date",
        },
        block_content: null,
        display_order: -6,
        is_visible: true,
        schedule_start: null,
        schedule_end: null,
        show_on_days: null,
        show_after_time: null,
        show_before_time: null,
        style: {
          accent_color: "#e53935", // Pan-African red
          icon: "raised-fist",
        },
        portal_section_items: [],
      });
    }
  }

  // Fetch events for holiday sections and track them by tag
  const holidayEventsByTag = new Map<string, Event[]>();
  if (holidaySections.length > 0) {
    // Collect all unique tags from holiday sections
    const holidayTags = holidaySections
      .map(section => section.auto_filter?.tags?.[0])
      .filter((tag): tag is string => tag !== undefined);

    if (holidayTags.length > 0) {
      // Fetch all holiday events in a single query using OR conditions
      const tagConditions = holidayTags.map(tag => `tags.cs.{${tag}}`).join(",");

      const { data: allHolidayEvents } = await supabase
        .from("events")
        .select(`
          id,
          title,
          start_date,
          start_time,
          end_date,
          end_time,
          is_all_day,
          is_free,
          price_min,
          price_max,
          category,
            image_url,
          description,
          featured_blurb,
          tags,
          series_id,
          series:series_id(
            id,
            slug,
            title,
            series_type,
            image_url,
            frequency,
            day_of_week,
            festival:festivals(id, slug, name, image_url, festival_type, location, neighborhood)
          ),
          venue:venues(id, name, neighborhood, slug, venue_type, city)
      `)
      .or(tagConditions)
      .gte("start_date", today)
      .lte("start_date", getLocalDateString(addDays(new Date(), 30)))
      .is("canonical_event_id", null)
      .or("is_class.eq.false,is_class.is.null")
      .or("is_sensitive.eq.false,is_sensitive.is.null")
      .order("start_date", { ascending: true })
      .limit(Math.max(80, holidayTags.length * 60));

      // Group events by tag, filtering out wrong-city events
      if (allHolidayEvents) {
        for (const event of allHolidayEvents as (Event & { tags?: string[] })[]) {
          // Filter out events from wrong cities
          if (portalCities.length > 0 && event.venue?.city) {
            const venueCity = event.venue.city.trim().toLowerCase();
            if (venueCity && !portalCities.some((pc) => {
              if (venueCity === pc) return true;
              const regex = new RegExp(`\\b${pc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
              return regex.test(venueCity);
            })) {
              continue;
            }
          }

          // Store in eventMap
          eventMap.set(event.id, event);

          // Assign to appropriate tag buckets
          for (const tag of holidayTags) {
            if (event.tags?.includes(tag)) {
              if (!holidayEventsByTag.has(tag)) {
                holidayEventsByTag.set(tag, []);
              }
              holidayEventsByTag.get(tag)!.push(event);
            }
          }
        }
      }
    }
  }

  // Step 6: Build sections synchronously using pre-fetched data
  const feedSections = sections.map((section) => {
    let events: Event[] = [];
    let fullFilteredPool: Event[] | null = null;
    // Nightlife carousel needs a larger pool for client-side filtering across activity types
    const isNightlifeSection = !!(section.auto_filter as Record<string, unknown>)?.nightlife_mode;
    const isCommunitySection = isCommunityActionSection(section);
    const baseLimit = section.max_items || feedSettings.items_per_section || defaultLimit;
    const limit = isNightlifeSection ? 50 : (isCommunitySection ? Math.max(baseLimit, 10) : baseLimit);

    // Non-event block types don't need events
    if (["category_grid", "announcement", "external_link", "countdown"].includes(section.block_type)) {
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
        auto_filter: section.auto_filter,
        events: [],
      };
    }

    // Check for pinned event_ids first (works for any section type)
    if (section.auto_filter?.event_ids?.length) {
      events = section.auto_filter.event_ids
        .map(id => eventMap.get(id))
        .filter((e): e is Event => e !== undefined);
    } else if (section.section_type === "curated") {
      // Get events from curated items
      const items = (section.portal_section_items || [])
        .filter((item) => item.entity_type === "event")
        .sort((a, b) => a.display_order - b.display_order);

      events = items
        .map((item) => eventMap.get(item.entity_id))
        .filter((e): e is Event => e !== undefined)
        .slice(0, limit);
    } else if ((section.section_type === "auto" || section.section_type === "mixed") && section.auto_filter) {
      // Filter from pre-fetched pool instead of making new query
      const filter = section.auto_filter;

      // Start with all pool events
      let filtered = Array.from(autoEventPool.values());

      // Apply date filter
      if (filter.date_filter) {
        const { start, end } = getDateRange(filter.date_filter);
        filtered = filtered.filter(e => e.start_date >= start && e.start_date <= end);
      }

      // Apply category filter
      if (filter.categories?.length) {
        filtered = filtered.filter(e => e.category && filter.categories!.includes(e.category));
      }

      // Apply nightlife_mode compound filter
      // Includes: all nightlife events + music/comedy/dance/gaming at nightlife venues or starting after 7pm
      if (filter.nightlife_mode) {
        const nightlifeVenueTypes = new Set(["bar", "club", "nightclub", "lounge", "rooftop", "karaoke", "sports_bar", "brewery", "cocktail_bar", "wine_bar"]);
        const nightlifeAdjacentCategories = new Set(["music", "comedy", "dance", "gaming"]);
        filtered = filtered.filter(e => {
          // Always include events with nightlife category
          if (e.category === "nightlife") return true;
          // Include adjacent categories at nightlife venues or after 7pm
          if (e.category && nightlifeAdjacentCategories.has(e.category)) {
            const atNightlifeVenue = e.venue?.venue_type && nightlifeVenueTypes.has(e.venue.venue_type);
            const startsAfter7pm = e.start_time && e.start_time >= "19:00";
            return atNightlifeVenue || startsAfter7pm;
          }
          return false;
        });
      }

      // Restrict to specific source IDs (strict portal attribution)
      if (filter.source_ids?.length) {
        const sourceSet = new Set(filter.source_ids);
        filtered = filtered.filter(e => e.source_id !== null && e.source_id !== undefined && sourceSet.has(e.source_id));
      }

      // Restrict to specific venue IDs
      if (filter.venue_ids?.length) {
        const venueSet = new Set(filter.venue_ids);
        filtered = filtered.filter(e => e.venue?.id !== null && e.venue?.id !== undefined && venueSet.has(e.venue.id));
      }

      // Restrict to specific neighborhoods
      if (filter.neighborhoods?.length) {
        const neighborhoods = new Set(filter.neighborhoods.map(n => n.toLowerCase()));
        filtered = filtered.filter(e => e.venue?.neighborhood && neighborhoods.has(e.venue.neighborhood.toLowerCase()));
      }

      // Match events that include at least one requested tag
      if (filter.tags?.length) {
        const tagSet = new Set(filter.tags);
        filtered = filtered.filter(e => Array.isArray(e.tags) && e.tags.some(tag => tagSet.has(tag)));
      }

      // Exclude categories
      if (filter.exclude_categories?.length) {
        filtered = filtered.filter(e => !e.category || !filter.exclude_categories!.includes(e.category));
      }

      // Apply subcategory filter (uses genres[] with subcategory fallback)
      if (filter.subcategories?.length) {
        // Convert dotted subcategory values to genre values (strip prefix)
        const genreValues = filter.subcategories.map((sub) => {
          const parts = sub.split(".");
          return parts.length > 1 ? parts.slice(1).join(".") : sub;
        });
        // Extract parent categories for fallback
        const parentCategories = new Set(
          filter.subcategories.map((sub) => sub.split(".")[0])
        );

        filtered = filtered.filter(e => {
          // Check genres first (preferred)
          if (e.genres?.some((g: string) => genreValues.includes(g))) return true;
          // Fallback: check legacy subcategory
          if (e.subcategory && filter.subcategories!.includes(e.subcategory)) return true;
          // If no genre/subcategory match, include if category matches a parent
          return e.category && parentCategories.has(e.category) && !e.genres?.length && !e.subcategory;
        });
      }

      // Apply free filter
      if (filter.is_free) {
        filtered = filtered.filter(e => e.is_free);
      }

      // Apply price max filter
      if (filter.price_max !== undefined) {
        filtered = filtered.filter(e => e.is_free || (e.price_min !== null && e.price_min <= filter.price_max!));
      }

      // Apply exclusions
      if (filter.exclude_ids?.length) {
        const excludeSet = new Set(filter.exclude_ids);
        filtered = filtered.filter(e => !excludeSet.has(e.id));
      }

      // For nightlife_mode, prioritize actual nightlife-category events over adjacent categories
      // so the limited pool captures diverse activity types (karaoke, trivia, DJ) instead of
      // being filled entirely by early-starting music/comedy events
      if (filter.nightlife_mode) {
        filtered.sort((a, b) => {
          const aNightlife = a.category === "nightlife" ? 0 : 1;
          const bNightlife = b.category === "nightlife" ? 0 : 1;
          if (aNightlife !== bNightlife) return aNightlife - bNightlife;
          // Within same priority, sort by start_time
          return (a.start_time || "23:59").localeCompare(b.start_time || "23:59");
        });
      }

      // Save full filtered pool before slicing (used by nightlife carousel for category counts)
      fullFilteredPool = filter.nightlife_mode ? [...filtered] : null;

      // Apply sorting
      switch (filter.sort_by) {
        case "popularity":
          filtered = filtered.map(e => ({ ...e, going_count: rsvpCounts[e.id] || 0 }));
          filtered.sort((a, b) => (b.going_count || 0) - (a.going_count || 0));
          break;
        case "trending":
          // For now, same as date sort
          filtered.sort((a, b) => a.start_date.localeCompare(b.start_date));
          break;
        case "random":
          filtered = filtered.sort(() => Math.random() - 0.5);
          break;
        default:
          // Already sorted by date from query
          break;
      }

      // Distribute events across progressive date buckets (today / this week / later)
      // so one busy day doesn't monopolize the entire section
      if (limit >= 8 && filtered.length > limit) {
        const todayStr = getLocalDateString();
        const dayOfWeek = new Date().getDay();
        const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
        const endOfWeekDate = new Date();
        endOfWeekDate.setDate(endOfWeekDate.getDate() + daysUntilSunday);
        const endOfWeekStr = getLocalDateString(endOfWeekDate);

        const todayPool = filtered.filter(e => e.start_date === todayStr);
        const weekPool = filtered.filter(e => e.start_date > todayStr && e.start_date <= endOfWeekStr);
        const laterPool = filtered.filter(e => e.start_date > endOfWeekStr);

        // Budget: today gets half, week and later split the rest
        const todayBudget = Math.min(todayPool.length, Math.ceil(limit / 2));
        const remaining = limit - todayBudget;
        const weekBudget = Math.min(weekPool.length, Math.ceil(remaining / 2));
        const laterBudget = Math.min(laterPool.length, remaining - weekBudget);

        // Fill any unused budget from other buckets
        let result = [
          ...todayPool.slice(0, todayBudget),
          ...weekPool.slice(0, weekBudget),
          ...laterPool.slice(0, laterBudget),
        ];

        // If we have room left, backfill from whichever buckets have more
        if (result.length < limit) {
          const used = new Set(result.map(e => e.id));
          const backfill = filtered.filter(e => !used.has(e.id));
          result = [...result, ...backfill.slice(0, limit - result.length)];
        }

        events = result;
      } else {
        events = filtered.slice(0, limit);
      }

      // For mixed sections, also add curated items at the top
      if (section.section_type === "mixed") {
        const curatedItems = (section.portal_section_items || [])
          .filter((item) => item.entity_type === "event")
          .sort((a, b) => a.display_order - b.display_order);

        const curatedEvents = curatedItems
          .map((item) => eventMap.get(item.entity_id))
          .filter((e): e is Event => e !== undefined);

        // Merge: curated first, then auto (avoiding duplicates)
        const curatedIds = new Set(curatedEvents.map((e) => e.id));
        const autoEventsFiltered = events.filter((e) => !curatedIds.has(e.id));
        events = [...curatedEvents, ...autoEventsFiltered].slice(0, limit);
      }
    }

    // Nightlife carousel: compute category breakdown from FULL filtered pool
    // (not the sliced events array) so counts reflect all available nightlife events
    const isNightlifeCarousel = !!(section.auto_filter as Record<string, unknown>)?.nightlife_mode;
    if (isNightlifeCarousel && events.length > 0) {
      // Use the full pool captured before slicing, or fall back to events
      const poolForCounts = fullFilteredPool && fullFilteredPool.length > 0 ? fullFilteredPool : events;
      // Group events into nightlife activity types for the carousel
      const activityCounts = new Map<string, { count: number; label: string }>();

      for (const event of poolForCounts) {
        const actKey = classifyNightlifeActivity(event);
        const existing = activityCounts.get(actKey) || { count: 0, label: NIGHTLIFE_ACTIVITY_LABELS[actKey] || actKey };
        existing.count++;
        activityCounts.set(actKey, existing);
      }

      // Sort by count descending, filter out "other" unless it's the only one
      const categories = Array.from(activityCounts.entries())
        .map(([id, { count, label }]) => ({ id, label, count }))
        .filter(c => c.id !== "other" || activityCounts.size === 1)
        .sort((a, b) => b.count - a.count);

      // Stamp each event with its activity_type for client-side filtering
      const stampedEvents = events.map(e => ({
        ...e,
        activity_type: classifyNightlifeActivity(e),
      }));

      return {
        id: section.id,
        title: section.title,
        slug: section.slug,
        description: section.description,
        section_type: section.section_type,
        block_type: "nightlife_carousel",
        layout: section.layout,
        items_per_row: section.items_per_row,
        style: section.style,
        block_content: { nightlife_categories: categories, total_events: poolForCounts.length },
        auto_filter: section.auto_filter,
        events: stampedEvents,
      };
    }

    // Only convert to collapsible if section has many events (8+)
    // Sections with fewer events render as event_list for direct visibility
    const collapsibleBlockTypes = ["event_cards", "event_carousel"];
    let finalBlockType = section.block_type;
    if (collapsibleBlockTypes.includes(section.block_type)) {
      // Keep volunteer/community sections expanded and rich instead of a single compact jump card.
      if (isCommunityActionSection(section)) {
        finalBlockType = "event_cards";
      } else {
        finalBlockType = events.length >= 8 ? "collapsible_events" : "event_list";
      }
    }

    return {
      id: section.id,
      title: section.title,
      slug: section.slug,
      description: section.description,
      section_type: section.section_type,
      block_type: finalBlockType,
      layout: section.layout,
      items_per_row: section.items_per_row,
      style: section.style,
      block_content: section.block_content,
      auto_filter: section.auto_filter,
      events,
    };
  })
  // Filter out event sections with fewer than 2 events (not worth a section header)
  .filter(section => {
    const nonEventTypes = ["category_grid", "announcement", "external_link", "countdown", "venue_list", "nightlife_carousel"];
    if (nonEventTypes.includes(section.block_type)) return true;
    return section.events.length >= 2;
  });

  // Step 7: Build holiday sections using the same pattern
  const holidayFeedSections = holidaySections.map((section) => {
    // Holiday sections get events by tag
    const tag = section.auto_filter?.tags?.[0];
    const maxItems = section.max_items || 20;
    const events = tag ? (holidayEventsByTag.get(tag) || []).slice(0, maxItems) : [];

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
      auto_filter: section.auto_filter,
      events,
    };
  });

  // Sort holiday sections by display_order and combine with regular sections
  const sortedHolidaySections = holidayFeedSections
    .filter(s => s.events.length > 0)
    .sort((a, b) => {
      const orderA = holidaySections.find(h => h.id === a.id)?.display_order ?? 0;
      const orderB = holidaySections.find(h => h.id === b.id)?.display_order ?? 0;
      return orderA - orderB;
    });

  const finalSections = [
    ...sortedHolidaySections,
    ...feedSections
  ];

  const allEventIds = Array.from(
    new Set(
      finalSections.flatMap((section) => section.events.map((event: Event) => event.id))
    )
  );
  const socialCounts = await fetchSocialProofCounts(allEventIds);

  const sectionsWithCounts = finalSections.map((section) => ({
    ...section,
    events: section.events.map((event: Event) => {
      const eventCounts = socialCounts.get(event.id);
      return {
        ...event,
        going_count: eventCounts?.going || 0,
        interested_count: eventCounts?.interested || 0,
        recommendation_count: eventCounts?.recommendations || 0,
      };
    }),
  }));

  const responsePayload = {
    portal: {
      slug: portal.slug,
      name: portal.name,
    },
    manifest: {
      version: manifest.version,
      vertical: manifest.vertical,
      portal_type: manifest.portalType,
      scope: {
        portal_exclusive: manifest.scope.portalExclusive,
        enforce_city_filter: manifest.scope.enforceCityFilter,
        has_federated_sources: manifest.scope.allowFederatedSources,
      },
      metadata: {
        event_field_order: manifest.metadata.eventFieldOrder,
        participant_model: manifest.metadata.participantModel,
      },
    },
    feedSettings: {
      feed_type: feedSettings.feed_type || "sections",
      items_per_section: feedSettings.items_per_section || 5,
      default_layout: feedSettings.default_layout || "list",
    },
    sections: sectionsWithCounts,
  };

  setCachedFeedPayload(cacheKey, responsePayload);

  return NextResponse.json(responsePayload, {
    headers: {
      "Cache-Control": FEED_CACHE_CONTROL,
    },
  });
}
