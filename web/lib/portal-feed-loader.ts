/**
 * Core feed-loading logic for the portal feed API route.
 *
 * This module owns the `loadPortalFeed()` function, which was previously the
 * `loadFeed()` inner function in `app/api/portals/[slug]/feed/route.ts`. The
 * route handler is now a thin wrapper responsible only for:
 *   - Rate limiting
 *   - Cache lookup / in-flight coalescing
 *   - Calling this function and returning the HTTP response
 */

import { createClient, createPortalScopedClient } from "@/lib/supabase/server";
import { addDays } from "date-fns";
import { getLocalDateString } from "@/lib/formats";
import {
  buildPortalNightlifeCarouselData,
  mergePortalMixedSectionEvents,
  selectPortalAutoSectionEvents,
} from "@/lib/portal-auto-section";
import {
  attachPortalSocialCounts,
  buildPortalHolidayFeedSections,
  finalizePortalFeedSections,
} from "@/lib/portal-feed-finalize";
import {
  getPortalSourceAccess,
  isEventCategoryAllowedForSourceAccess,
} from "@/lib/federation";
import { isValidUUID } from "@/lib/api-utils";
import { fetchSocialProofCounts } from "@/lib/social-proof";
import {
  applyManifestFederatedScopeToQuery,
  parsePortalContentFilters,
  applyPortalCategoryFilters,
  filterByPortalContentScope,
} from "@/lib/portal-scope";
import {
  buildPortalManifest,
  shouldApplyCityFilter,
} from "@/lib/portal-manifest";
import { shouldSuppressChainShowtime } from "@/lib/cinema-filter";
import {
  suppressEventImageIfVenueFlagged,
  suppressEventImagesIfVenueFlagged,
} from "@/lib/image-quality-suppression";
import { getSharedCacheJson, setSharedCacheJson } from "@/lib/shared-cache";
import { filterOutInactiveVenueEvents } from "@/lib/event-feed-health";
import { applyFeedGate } from "@/lib/feed-gate";
import {
  buildPortalFeedAutoSectionPlan,
  shouldSectionUseAutoEventPool,
} from "@/lib/portal-feed-plan";
import { buildPortalHolidaySections } from "@/lib/portal-holiday-sections";
import {
  getPortalFeedDateRange,
  isPortalCommunityActionSection,
  isPortalSectionVisible,
} from "@/lib/portal-feed-section-rules";
import {
  getPortalSectionEventLimit,
  isPortalNoEventContentBlockType,
  resolvePortalSectionBlockType,
  shouldKeepPortalSection,
} from "@/lib/portal-section-presentation";
import { createServerTimingRecorder } from "@/lib/server-timing";
import { fetchHolidayEvents } from "@/lib/portal-feed-holiday";
import { sortEventsByPortalCityPreference } from "@/lib/portal-locality";

// ---------------------------------------------------------------------------
// Cache constants (shared with route.ts via re-export)
// ---------------------------------------------------------------------------

export const SECTION_CACHE_TTL_MS = 5 * 60 * 1000;
export const SECTION_CACHE_NAMESPACE = "api:portal-feed:sections";
export const SECTION_EVENTS_CACHE_TTL_MS = 5 * 60 * 1000;
export const SECTION_EVENTS_CACHE_NAMESPACE = "api:portal-feed:section-events";
export const AUTO_POOL_CACHE_TTL_MS = 5 * 60 * 1000;
export const AUTO_POOL_CACHE_NAMESPACE = "api:portal-feed:auto-pool";
export const SOURCE_SLUG_CACHE_TTL_MS = 30 * 60 * 1000;
export const SOURCE_SLUG_CACHE_NAMESPACE = "api:portal-feed:source-slugs";
export const FEED_CACHE_MAX_ENTRIES = 200;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SectionItem = {
  id: string;
  entity_type: string;
  entity_id: number;
  display_order: number;
};

type AutoFilter = {
  categories?: string[];
  subcategories?: string[];
  neighborhoods?: string[];
  tags?: string[];
  source_slugs?: string[];
  is_free?: boolean;
  price_max?: number;
  date_filter?:
    | "today"
    | "tomorrow"
    | "this_weekend"
    | "next_7_days"
    | "next_30_days";
  sort_by?: "date" | "popularity" | "trending" | "random";
  source_ids?: number[];
  venue_ids?: number[];
  exclude_ids?: number[];
  exclude_categories?: string[];
  event_ids?: number[];
  nightlife_mode?: boolean;
};

export type Section = {
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

export type FeedEvent = {
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
  image_url: string | null;
  description: string | null;
  featured_blurb: string | null;
  going_count?: number;
  interested_count?: number;
  recommendation_count?: number;
  tags?: string[] | null;
  source_id?: number | null;
  festival_id?: string | null;
  is_tentpole?: boolean;
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
    place_type: string | null;
    location_designator:
      | "standard"
      | "private_after_signup"
      | "virtual"
      | "recovery_meeting"
      | null;
    city: string | null;
    active?: boolean | null;
  } | null;
};

export type LoadPortalFeedParams = {
  canonicalSlug: string;
  requestSlug: string;
  sectionIds: string[] | undefined;
  defaultLimit: number;
  timing: ReturnType<typeof createServerTimingRecorder>;
  bypassFeaturedSections?: boolean;
};

export type LoadPortalFeedResult = {
  payload: unknown;
  serverTiming: string;
  status?: number;
};

// ---------------------------------------------------------------------------
// Cache key builders (used by the route handler too)
// ---------------------------------------------------------------------------

export function buildPortalSectionsCacheKey(
  portalId: string,
  sectionIds: string[] | null | undefined,
): string {
  return `${portalId}|${(sectionIds || []).slice().sort().join(",") || "all"}`;
}

function buildAutoPoolCacheKey(input: {
  portalId: string;
  today: string;
  maxEndDate: string;
  perBucketLimit: number;
  constrainedSupplementalLimit: number;
  hasNightlifeSection: boolean;
  onlyNightlifeSections: boolean;
  constrainedSourceIds: number[];
  constrainedSourceSlugs: string[];
  constrainedVenueIds: number[];
  portalCities: string[];
  contentFilters: {
    categories?: string[];
    exclude_categories?: string[];
    neighborhoods?: string[];
    geo_center?: [number, number];
    venue_ids?: number[];
    tags?: string[];
    price_max?: number;
    geo_radius_km?: number;
  };
}): string {
  return JSON.stringify({
    portalId: input.portalId,
    today: input.today,
    maxEndDate: input.maxEndDate,
    perBucketLimit: input.perBucketLimit,
    constrainedSupplementalLimit: input.constrainedSupplementalLimit,
    hasNightlifeSection: input.hasNightlifeSection,
    onlyNightlifeSections: input.onlyNightlifeSections,
    constrainedSourceIds: [...input.constrainedSourceIds].sort((a, b) => a - b),
    constrainedSourceSlugs: [...input.constrainedSourceSlugs].sort(),
    constrainedVenueIds: [...input.constrainedVenueIds].sort((a, b) => a - b),
    portalCities: [...input.portalCities].sort(),
    contentFilters: {
      categories: [...(input.contentFilters.categories || [])].sort(),
      exclude_categories: [
        ...(input.contentFilters.exclude_categories || []),
      ].sort(),
      neighborhoods: [...(input.contentFilters.neighborhoods || [])].sort(),
      geo_center: input.contentFilters.geo_center || null,
      venue_ids: [...(input.contentFilters.venue_ids || [])].sort(
        (a, b) => a - b,
      ),
      tags: [...(input.contentFilters.tags || [])].sort(),
      price_max: input.contentFilters.price_max || null,
      geo_radius_km: input.contentFilters.geo_radius_km || null,
    },
  });
}

function buildSourceSlugCacheKey(input: {
  portalId: string;
  sourceSlugs: string[];
  accessibleSourceIds: number[];
}): string {
  return JSON.stringify({
    portalId: input.portalId,
    sourceSlugs: [...input.sourceSlugs].sort(),
    accessibleSourceIds: [...input.accessibleSourceIds].sort(
      (a, b) => a - b,
    ),
  });
}

function buildSectionEventsCacheKey(input: {
  portalId: string;
  today: string;
  eventIds: number[];
  pinnedEventIds: number[];
}): string {
  return JSON.stringify({
    portalId: input.portalId,
    today: input.today,
    eventIds: [...input.eventIds].sort((a, b) => a - b),
    pinnedEventIds: [...input.pinnedEventIds].sort((a, b) => a - b),
  });
}

const PORTAL_FEED_SOCIAL_COUNTS_TIMEOUT_MS = 120;

// ---------------------------------------------------------------------------
// Main loader
// ---------------------------------------------------------------------------

/**
 * Loads all data for a portal feed and returns the serialisable payload.
 *
 * This is a pure data function — it performs no HTTP logic. The caller
 * (the route handler) is responsible for caching, in-flight coalescing,
 * and constructing the HTTP response.
 */
export async function loadPortalFeed(
  params: LoadPortalFeedParams,
): Promise<LoadPortalFeedResult> {
  const {
    canonicalSlug,
    requestSlug,
    sectionIds,
    defaultLimit,
    timing,
    bypassFeaturedSections = false,
  } =
    params;

  const supabase = await createClient();

  // ---------------------------------------------------------------------------
  // 1. Resolve portal
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

  const portalData = portalResult.data as {
    id: string;
    slug: string;
    name: string;
    portal_type: string;
    parent_portal_id?: string | null;
    settings: Record<string, unknown>;
    filters?: Record<string, unknown> | string | null;
  } | null;

  if (portalResult.error || !portalData) {
    return {
      payload: { error: "Portal not found" },
      serverTiming: timing.toHeader(),
      status: 404,
    };
  }

  // Parse portal filters to extract city constraint for geo-filtering
  let portalFilters: { city?: string; cities?: string[] } = {};
  if (portalData.filters) {
    if (typeof portalData.filters === "string") {
      try {
        portalFilters = JSON.parse(portalData.filters);
      } catch {
        /* ignore */
      }
    } else {
      portalFilters = portalData.filters as {
        city?: string;
        cities?: string[];
      };
    }
  }

  const portalContentFilters = parsePortalContentFilters(
    portalData.filters as Record<string, unknown> | string | null,
  );
  const portalCities = Array.from(
    new Set(
      [
        ...(portalFilters.cities || []),
        ...(portalFilters.city ? [portalFilters.city] : []),
      ]
        .map((c) => c?.trim().toLowerCase())
        .filter(Boolean) as string[],
    ),
  );

  const portal = {
    id: portalData.id,
    slug: requestSlug,
    name: portalData.name,
    portal_type: portalData.portal_type,
    parent_portal_id: portalData.parent_portal_id ?? null,
    settings: portalData.settings,
  };

  if (!isValidUUID(portal.id)) {
    return {
      payload: { error: "Invalid portal" },
      serverTiming: timing.toHeader(),
      status: 400,
    };
  }

  const portalClient = await createPortalScopedClient(portal.id);
  const feedSettings = (portal.settings?.feed || {}) as {
    feed_type?: string;
    featured_section_ids?: string[];
    items_per_section?: number;
    default_layout?: string;
  };

  // Fetch federation access in parallel with section lookup
  const federationAccessPromise = getPortalSourceAccess(portal.id);

  // ---------------------------------------------------------------------------
  // 2. Load portal sections (with caching)
  // ---------------------------------------------------------------------------
  let sectionsToFetch = sectionIds;
  if (
    !sectionsToFetch &&
    !bypassFeaturedSections &&
    feedSettings.featured_section_ids?.length
  ) {
    sectionsToFetch = feedSettings.featured_section_ids;
  }

  const filterPortalSections = (input: Section[]) =>
    input.filter((section) => {
      if (!isPortalSectionVisible(section)) return false;

      const hospitalOnlySections = [
        "outdoor-wellness",
        "food-access-support",
        "public-health-resources",
      ];
      if (
        hospitalOnlySections.includes(section.slug) &&
        portal.portal_type !== "hospital"
      ) {
        return false;
      }

      return true;
    });

  const loadSectionsData = async (
    requestedSectionIds: string[] | undefined,
  ): Promise<Section[] | null> => {
    const sectionsCacheKey = buildPortalSectionsCacheKey(
      portal.id,
      requestedSectionIds,
    );
    let cachedSections = await getSharedCacheJson<Section[]>(
      SECTION_CACHE_NAMESPACE,
      sectionsCacheKey,
    );

    if (!cachedSections) {
      let sectionsQuery = supabase
        .from("portal_sections")
        .select(
          `
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
        `,
        )
        .eq("portal_id", portal.id)
        .eq("is_visible", true)
        .order("display_order", { ascending: true });

      if (requestedSectionIds?.length) {
        sectionsQuery = sectionsQuery.in("id", requestedSectionIds);
      }

      const { data, error: sectionsError } = await sectionsQuery;

      if (sectionsError) {
        return null;
      }

      cachedSections = (data || []) as Section[];
      await setSharedCacheJson(
        SECTION_CACHE_NAMESPACE,
        sectionsCacheKey,
        cachedSections,
        SECTION_CACHE_TTL_MS,
        { maxEntries: FEED_CACHE_MAX_ENTRIES },
      );
    }

    return cachedSections;
  };

  const initialSectionsData = await loadSectionsData(sectionsToFetch);
  if (!initialSectionsData) {
    return {
      payload: {
        error: "Failed to load portal feed sections",
      },
      serverTiming: timing.toHeader(),
      status: 500,
    };
  }

  let allSections = initialSectionsData;
  let sections = filterPortalSections(allSections);

  // If stale featured_section_ids resolve to no visible consumer sections,
  // fall back to all visible sections rather than returning an empty feed.
  if (
    sections.length === 0 &&
    !sectionIds?.length &&
    feedSettings.featured_section_ids?.length
  ) {
    const fallbackSectionsData = await loadSectionsData(undefined);
    if (!fallbackSectionsData) {
      return {
        payload: {
          error: "Failed to load portal feed sections",
        },
        serverTiming: timing.toHeader(),
        status: 500,
      };
    }

    allSections = fallbackSectionsData;
    sections = filterPortalSections(allSections);
  }

  // ---------------------------------------------------------------------------
  // 3. Load curated + pinned events (with caching)
  // ---------------------------------------------------------------------------
  const eventIds = new Set<number>();
  const pinnedEventIds = new Set<number>();
  for (const section of sections) {
    if (
      section.section_type === "curated" ||
      section.section_type === "mixed"
    ) {
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
        category:category_id,
        genres,
        image_url,
        description,
        featured_blurb,
        tags,
        festival_id,
        is_tentpole,
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
        venue:places(id, name, neighborhood, slug, place_type, location_designator, city, lat, lng, image_url, is_active)
      `;

  const sectionEventsCacheKey = buildSectionEventsCacheKey({
    portalId: portal.id,
    today,
    eventIds: Array.from(eventIds),
    pinnedEventIds: Array.from(pinnedEventIds),
  });

  const [cachedSectionEvents, federationAccess] = await timing.measure(
    "seed_queries",
    () =>
      Promise.all([
        getSharedCacheJson<{
          curatedEvents: FeedEvent[];
          pinnedEvents: FeedEvent[];
        }>(SECTION_EVENTS_CACHE_NAMESPACE, sectionEventsCacheKey),
        federationAccessPromise,
      ]),
  );

  let curatedEvents = cachedSectionEvents?.curatedEvents || [];
  let pinnedEvents = cachedSectionEvents?.pinnedEvents || [];

  if (!cachedSectionEvents) {
    const curatedEventsPromise =
      eventIds.size > 0
        ? applyFeedGate(
            portalClient
              .from("events")
              .select(curatedEventSelect)
              .in("id", Array.from(eventIds))
              .or(`start_date.gte.${today},end_date.gte.${today}`)
              .is("canonical_event_id", null)
              .or("is_class.eq.false,is_class.is.null")
              .or("is_sensitive.eq.false,is_sensitive.is.null"),
          )
        : Promise.resolve({ data: [] as FeedEvent[] });

    const pinnedEventsPromise =
      pinnedEventIds.size > 0
        ? applyFeedGate(
            portalClient
              .from("events")
              .select(curatedEventSelect)
              .in("id", Array.from(pinnedEventIds))
              .is("canonical_event_id", null)
              .or("is_class.eq.false,is_class.is.null")
              .or("is_sensitive.eq.false,is_sensitive.is.null"),
          )
        : Promise.resolve({ data: [] as FeedEvent[] });

    const [{ data: fetchedCuratedEvents }, { data: fetchedPinnedEvents }] =
      await Promise.all([curatedEventsPromise, pinnedEventsPromise]);

    curatedEvents = (fetchedCuratedEvents || []) as FeedEvent[];
    pinnedEvents = (fetchedPinnedEvents || []) as FeedEvent[];

    await setSharedCacheJson(
      SECTION_EVENTS_CACHE_NAMESPACE,
      sectionEventsCacheKey,
      { curatedEvents, pinnedEvents },
      SECTION_EVENTS_CACHE_TTL_MS,
      { maxEntries: FEED_CACHE_MAX_ENTRIES },
    );
  }

  // ---------------------------------------------------------------------------
  // Build manifest + portal event scope helper
  // ---------------------------------------------------------------------------
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
  const applyPortalEventScope = (query: ReturnType<typeof supabase.from>) =>
    applyPortalCategoryFilters(
      applyManifestFederatedScopeToQuery(query, manifest, {
        sourceIds: hasSubscribedSources ? federationAccess.sourceIds : [],
        publicOnlyWhenNoPortal: true,
      }),
      portalContentFilters,
    );

  // Merge curated + pinned event rows into a single lookup map
  const eventMap = new Map<number, FeedEvent>();
  for (const event of filterOutInactiveVenueEvents(
    suppressEventImagesIfVenueFlagged((curatedEvents || []) as FeedEvent[]),
  )) {
    eventMap.set(event.id, event);
  }
  for (const event of filterOutInactiveVenueEvents(
    suppressEventImagesIfVenueFlagged((pinnedEvents || []) as FeedEvent[]),
  )) {
    eventMap.set(event.id, event);
  }

  // ---------------------------------------------------------------------------
  // 4. Build auto event pool
  // ---------------------------------------------------------------------------
  const sectionsNeedingAutoEvents = sections.filter((section) =>
    shouldSectionUseAutoEventPool({
      blockType: section.block_type,
      sectionType: section.section_type,
      maxItems: section.max_items,
      autoFilter: section.auto_filter
        ? {
            eventIds: section.auto_filter.event_ids,
            sourceSlugs: section.auto_filter.source_slugs,
            sourceIds: section.auto_filter.source_ids,
            venueIds: section.auto_filter.venue_ids,
            dateFilter: section.auto_filter.date_filter,
            nightlifeMode: section.auto_filter.nightlife_mode,
          }
        : null,
    }),
  );

  const autoEventPool = new Map<number, FeedEvent>();

  await timing.measure("auto_pool", async () => {
    if (sectionsNeedingAutoEvents.length === 0) return;

    const autoSectionPlan = buildPortalFeedAutoSectionPlan({
      sections: sectionsNeedingAutoEvents.map((section) => ({
        blockType: section.block_type,
        sectionType: section.section_type,
        maxItems: section.max_items,
        autoFilter: section.auto_filter
          ? {
              eventIds: section.auto_filter.event_ids,
              sourceSlugs: section.auto_filter.source_slugs,
              sourceIds: section.auto_filter.source_ids,
              venueIds: section.auto_filter.venue_ids,
              dateFilter: section.auto_filter.date_filter,
              nightlifeMode: section.auto_filter.nightlife_mode,
            }
          : null,
      })),
      defaultLimit,
      itemsPerSection: feedSettings.items_per_section,
      defaultMaxEndDate: getLocalDateString(addDays(new Date(), 14)),
      resolveDateRangeEnd: (filter) => getPortalFeedDateRange(filter).end,
    });

    const requestedSourceSlugs = autoSectionPlan.requestedSourceSlugs;
    const accessibleSourceIdSet = new Set(federationAccess.sourceIds || []);
    const constrainedSourceIds = autoSectionPlan.constrainedSourceIds;
    const constrainedVenueIds = autoSectionPlan.constrainedVenueIds;
    const maxEndDate = autoSectionPlan.maxEndDate;
    const perBucketLimit = autoSectionPlan.perBucketLimit;
    const onlyNightlifeSections =
      sectionsNeedingAutoEvents.length > 0 &&
      sectionsNeedingAutoEvents.every((section) =>
        Boolean(section.auto_filter?.nightlife_mode),
      );

    const autoPoolCacheKey = buildAutoPoolCacheKey({
      portalId: portal.id,
      today,
      maxEndDate,
      perBucketLimit,
      constrainedSupplementalLimit: autoSectionPlan.constrainedSupplementalLimit,
      hasNightlifeSection: autoSectionPlan.hasNightlifeSection,
      onlyNightlifeSections,
      constrainedSourceIds,
      constrainedSourceSlugs: requestedSourceSlugs,
      constrainedVenueIds,
      portalCities,
      contentFilters: portalContentFilters,
    });

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
        category:category_id,
        genres,
        image_url,
        description,
        featured_blurb,
        tags,
        festival_id,
        is_tentpole,
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
        venue:places(id, name, neighborhood, slug, place_type, location_designator, city, lat, lng, image_url, is_active)
    `;

    const addToPool = (events: FeedEvent[]) => {
      for (const rawEvent of filterOutInactiveVenueEvents(events)) {
        const event = suppressEventImageIfVenueFlagged(rawEvent);
        if (
          !isEventCategoryAllowedForSourceAccess(
            federationAccess,
            event.source_id,
            event.category,
          )
        ) {
          continue;
        }
        if (
          enforcePortalCityFilter &&
          portalCities.length > 0 &&
          event.venue?.city
        ) {
          const venueCity = event.venue.city.trim().toLowerCase();
          if (
            venueCity &&
            !portalCities.some((pc) => {
              if (venueCity === pc) return true;
              const regex = new RegExp(
                `\\b${pc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
              );
              return regex.test(venueCity);
            })
          ) {
            continue;
          }
        }
        autoEventPool.set(event.id, event);
      }
    };

    const sourceSlugCacheKey = buildSourceSlugCacheKey({
      portalId: portal.id,
      sourceSlugs: requestedSourceSlugs,
      accessibleSourceIds: federationAccess.sourceIds || [],
    });

    const [cachedAutoPoolEvents, cachedSourceSlugMap] = await Promise.all([
      timing.measure("auto_pool_cache_lookup", () =>
        getSharedCacheJson<FeedEvent[]>(
          AUTO_POOL_CACHE_NAMESPACE,
          autoPoolCacheKey,
        ),
      ),
      requestedSourceSlugs.length > 0
        ? timing.measure("auto_pool_source_lookup_cache", () =>
            getSharedCacheJson<Record<string, number>>(
              SOURCE_SLUG_CACHE_NAMESPACE,
              sourceSlugCacheKey,
            ),
          )
        : Promise.resolve(null),
    ]);

    let sourceIdBySlug = new Map<string, number>(
      Object.entries(cachedSourceSlugMap || {}).map(([slug, id]) => [
        slug,
        id,
      ]),
    );

    if (requestedSourceSlugs.length > 0 && sourceIdBySlug.size === 0) {
      const { data: sourceRows, error: sourceLookupError } =
        await timing.measure("auto_pool_source_lookup_query", () =>
          supabase
            .from("sources")
            .select("id, slug")
            .in("slug", requestedSourceSlugs),
        );

      if (sourceLookupError) {
        console.error(
          "Failed resolving auto-filter source slugs:",
          sourceLookupError,
        );
      } else {
        sourceIdBySlug = new Map<string, number>();
        for (const row of (sourceRows || []) as Array<{
          id: number;
          slug: string;
        }>) {
          if (
            accessibleSourceIdSet.size > 0 &&
            !accessibleSourceIdSet.has(row.id)
          ) {
            continue;
          }
          sourceIdBySlug.set(row.slug, row.id);
        }

        await setSharedCacheJson(
          SOURCE_SLUG_CACHE_NAMESPACE,
          sourceSlugCacheKey,
          Object.fromEntries(sourceIdBySlug),
          SOURCE_SLUG_CACHE_TTL_MS,
          { maxEntries: FEED_CACHE_MAX_ENTRIES },
        );
      }
    }

    if (sourceIdBySlug.size > 0) {
      timing.start("auto_pool_source_apply");
      for (const section of sectionsNeedingAutoEvents) {
        const sourceSlugs = (section.auto_filter?.source_slugs || []).filter(
          (slug): slug is string =>
            typeof slug === "string" && slug.length > 0,
        );
        if (sourceSlugs.length === 0 || !section.auto_filter) continue;

        const existingSourceIds = Array.isArray(
          section.auto_filter.source_ids,
        )
          ? section.auto_filter.source_ids.filter(
              (id): id is number => typeof id === "number",
            )
          : [];
        const resolvedSourceIds = sourceSlugs
          .map((slug) => sourceIdBySlug.get(slug))
          .filter((id): id is number => typeof id === "number");

        section.auto_filter.source_ids = Array.from(
          new Set([...existingSourceIds, ...resolvedSourceIds]),
        );
      }
      timing.end("auto_pool_source_apply");
    }

    if (cachedAutoPoolEvents) {
      addToPool(cachedAutoPoolEvents);
    } else {
      // Date bucket boundaries
      const dayOfWeek = new Date().getDay();
      const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
      const endOfWeekDate = new Date();
      endOfWeekDate.setDate(endOfWeekDate.getDate() + daysUntilSunday);
      const endOfWeekStr = getLocalDateString(endOfWeekDate);
      const tomorrowDate = new Date();
      tomorrowDate.setDate(tomorrowDate.getDate() + 1);
      const tomorrowStr = getLocalDateString(tomorrowDate);

      const buildBucketQuery = (
        startDate: string,
        endDate: string,
        limit: number,
      ) => {
        let q = portalClient
          .from("events")
          .select(eventSelect)
          .gte("start_date", startDate)
          .lte("start_date", endDate)
          .is("canonical_event_id", null)
          .or("is_class.eq.false,is_class.is.null")
          .or("is_sensitive.eq.false,is_sensitive.is.null");
        q = applyFeedGate(q);
        q = applyPortalEventScope(q);
        return q
          .order("start_date", { ascending: true })
          .order("data_quality", { ascending: false, nullsFirst: false })
          .order("start_time", { ascending: true })
          .limit(limit);
      };

      if (!onlyNightlifeSections) {
        const [todayResult, weekResult, laterResult] = await timing.measure(
          "auto_pool_buckets",
          () =>
            Promise.all([
              buildBucketQuery(today, today, perBucketLimit),
              daysUntilSunday > 0
                ? buildBucketQuery(
                    tomorrowStr,
                    endOfWeekStr,
                    perBucketLimit,
                  )
                : Promise.resolve({ data: [] as FeedEvent[] }),
              buildBucketQuery(
                getLocalDateString(
                  new Date(endOfWeekDate.getTime() + 86400000),
                ),
                maxEndDate,
                perBucketLimit,
              ),
            ]),
        );

        addToPool(
          filterByPortalContentScope(
            (todayResult.data || []) as FeedEvent[],
            portalContentFilters,
          ),
        );
        addToPool(
          filterByPortalContentScope(
            ((weekResult as { data: FeedEvent[] | null }).data ||
              []) as FeedEvent[],
            portalContentFilters,
          ),
        );
        addToPool(
          filterByPortalContentScope(
            (laterResult.data || []) as FeedEvent[],
            portalContentFilters,
          ),
        );
      }

      if (constrainedSourceIds.length > 0 || constrainedVenueIds.length > 0) {
        let constrainedQuery = portalClient
          .from("events")
          .select(
            `
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
          category:category_id,
          genres,
            image_url,
          description,
          featured_blurb,
          tags,
          festival_id,
          is_tentpole,
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
          venue:places(id, name, neighborhood, slug, place_type, location_designator, city, image_url, is_active)
        `,
          )
          .or(`start_date.gte.${today},end_date.gte.${today}`)
          .lte("start_date", maxEndDate)
          .is("canonical_event_id", null)
          .or("is_class.eq.false,is_class.is.null")
          .or("is_sensitive.eq.false,is_sensitive.is.null");

        if (
          constrainedSourceIds.length > 0 &&
          constrainedVenueIds.length > 0
        ) {
          constrainedQuery = constrainedQuery.or(
            `source_id.in.(${constrainedSourceIds.join(",")}),place_id.in.(${constrainedVenueIds.join(",")})`,
          );
        } else if (constrainedSourceIds.length > 0) {
          constrainedQuery = constrainedQuery.in(
            "source_id",
            constrainedSourceIds,
          );
        } else if (constrainedVenueIds.length > 0) {
          constrainedQuery = constrainedQuery.in(
            "place_id",
            constrainedVenueIds,
          );
        }

        constrainedQuery = applyFeedGate(constrainedQuery);
        constrainedQuery = applyPortalEventScope(constrainedQuery);

        const { data: constrainedEvents } = await timing.measure(
          "auto_pool_constrained",
          () =>
            constrainedQuery
              .order("start_date", { ascending: true })
              .order("data_quality", { ascending: false, nullsFirst: false })
              .order("start_time", { ascending: true })
              .limit(autoSectionPlan.constrainedSupplementalLimit),
        );

        addToPool((constrainedEvents || []) as FeedEvent[]);
      }

      if (autoSectionPlan.hasNightlifeSection) {
        const nightlifeVenueFilter = [
          "bar",
          "nightclub",
          "rooftop",
          "karaoke",
          "brewery",
          "cocktail_bar",
        ];

        const supplementEndDate = getLocalDateString(
          new Date(new Date().getTime() + 86400000),
        );

        let nightlifeCoreQuery = portalClient
          .from("events")
          .select(eventSelect)
          .or(`start_date.gte.${today},end_date.gte.${today}`)
          .lte("start_date", supplementEndDate)
          .is("canonical_event_id", null)
          .or("is_class.eq.false,is_class.is.null")
          .or("is_sensitive.eq.false,is_sensitive.is.null")
          .in("category_id", ["games", "dance"])
          .gte("start_time", "17:00:00");
        nightlifeCoreQuery = applyFeedGate(nightlifeCoreQuery);
        nightlifeCoreQuery = applyPortalEventScope(nightlifeCoreQuery);

        let entertainmentQuery = portalClient
          .from("events")
          .select(eventSelect)
          .or(`start_date.gte.${today},end_date.gte.${today}`)
          .lte("start_date", supplementEndDate)
          .is("canonical_event_id", null)
          .or("is_class.eq.false,is_class.is.null")
          .or("is_sensitive.eq.false,is_sensitive.is.null")
          .in("category_id", ["music", "comedy", "dance"])
          .gte("start_time", "17:00:00");
        entertainmentQuery = applyFeedGate(entertainmentQuery);
        entertainmentQuery = applyPortalEventScope(entertainmentQuery);

        let venueBasedQuery = portalClient
          .from("events")
          .select(
            eventSelect.replace(
              "venue:places(",
              "venue:places!inner(",
            ),
          )
          .or(`start_date.gte.${today},end_date.gte.${today}`)
          .lte("start_date", supplementEndDate)
          .is("canonical_event_id", null)
          .or("is_class.eq.false,is_class.is.null")
          .or("is_sensitive.eq.false,is_sensitive.is.null")
          .in("places.place_type", nightlifeVenueFilter)
          .gte("start_time", "17:00:00");
        venueBasedQuery = applyFeedGate(venueBasedQuery);
        venueBasedQuery = applyPortalEventScope(venueBasedQuery);

        const [coreResult, entertainmentResult, venueResult] =
          await timing.measure("auto_pool_nightlife", () =>
            Promise.all([
              nightlifeCoreQuery
                .order("start_date", { ascending: true })
                .order("data_quality", { ascending: false, nullsFirst: false })
                .order("start_time", { ascending: true })
                .limit(60),
              entertainmentQuery
                .order("start_date", { ascending: true })
                .order("data_quality", { ascending: false, nullsFirst: false })
                .order("start_time", { ascending: true })
                .limit(120),
              venueBasedQuery
                .order("start_date", { ascending: true })
                .order("data_quality", { ascending: false, nullsFirst: false })
                .order("start_time", { ascending: true })
                .limit(60),
            ]),
          );

        addToPool((coreResult.data || []) as FeedEvent[]);
        addToPool((entertainmentResult.data || []) as FeedEvent[]);
        addToPool((venueResult.data || []) as FeedEvent[]);
      }

      await timing.measure("auto_pool_finalize", async () => {
        for (const [eventId, event] of autoEventPool) {
          if (shouldSuppressChainShowtime(event.tags, event.venue)) {
            autoEventPool.delete(eventId);
          }
        }
      });

      await timing.measure("auto_pool_cache_store", () =>
        setSharedCacheJson(
          AUTO_POOL_CACHE_NAMESPACE,
          autoPoolCacheKey,
          Array.from(autoEventPool.values()),
          AUTO_POOL_CACHE_TTL_MS,
          { maxEntries: FEED_CACHE_MAX_ENTRIES },
        ),
      );
    }
  });

  // ---------------------------------------------------------------------------
  // 4b. Popularity sort — batch-fetch RSVP counts if needed
  // ---------------------------------------------------------------------------
  const needsPopularitySort = sectionsNeedingAutoEvents.some(
    (s) => s.auto_filter?.sort_by === "popularity",
  );
  const rsvpCounts: Record<number, number> = {};

  if (needsPopularitySort && autoEventPool.size > 0) {
    await timing.measure("popularity_counts", async () => {
      // Strategy A: compat view kept as-is.
      // Filters only status='going' (the only value that maps from the new
      // plan_invitees.rsvp_status schema). No FK hints. Read-only.
      const { data: rsvpData } = await supabase
        .from("event_rsvps")
        .select("event_id")
        .in("event_id", Array.from(autoEventPool.keys()))
        .eq("status", "going");

      for (const rsvp of (rsvpData || []) as { event_id: number }[]) {
        rsvpCounts[rsvp.event_id] = (rsvpCounts[rsvp.event_id] || 0) + 1;
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 5. Holiday sections
  // ---------------------------------------------------------------------------
  const holidaySections = buildPortalHolidaySections(new Date());

  const { holidayEventsByTag, allHolidayEvents } =
    await timing.measure("holidays", () =>
      fetchHolidayEvents({
        portalClient,
        holidaySections,
        portalCities,
        applyPortalEventScope,
        today,
        portalId: portal.id,
        timing,
      }),
    );

  for (const [id, event] of allHolidayEvents) {
    eventMap.set(id, event as FeedEvent);
  }

  // ---------------------------------------------------------------------------
  // 6. Assemble sections from pre-fetched pools
  // ---------------------------------------------------------------------------
  const autoEventPoolValues = sortEventsByPortalCityPreference(
    Array.from(autoEventPool.values()),
    portalCities,
  );
  const feedSections = await timing.measure("sections", async () =>
    sections
      .map((section) => {
        let events: FeedEvent[] = [];
        let fullFilteredPool: FeedEvent[] | null = null;

        const isNightlifeSection = !!(
          section.auto_filter as Record<string, unknown>
        )?.nightlife_mode;
        const isCommunitySection = isPortalCommunityActionSection(section);
        const baseLimit =
          section.max_items || feedSettings.items_per_section || defaultLimit;
        const limit = getPortalSectionEventLimit({
          baseLimit,
          isNightlifeSection,
          isCommunitySection,
        });

        if (isPortalNoEventContentBlockType(section.block_type)) {
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
            events: [] as FeedEvent[],
          };
        }

        if (section.auto_filter?.event_ids?.length) {
          events = section.auto_filter.event_ids
            .map((id) => eventMap.get(id))
            .filter((e): e is FeedEvent => e !== undefined);
        } else if (section.section_type === "curated") {
          const items = (section.portal_section_items || [])
            .filter((item) => item.entity_type === "event")
            .sort((a, b) => a.display_order - b.display_order);

          events = items
            .map((item) => eventMap.get(item.entity_id))
            .filter((e): e is FeedEvent => e !== undefined)
            .slice(0, limit);
        } else if (
          (section.section_type === "auto" ||
            section.section_type === "mixed") &&
          section.auto_filter
        ) {
          const autoSectionResult = selectPortalAutoSectionEvents({
            pool: autoEventPoolValues,
            filter: section.auto_filter,
            limit,
            currentDate: new Date(),
            rsvpCounts,
            resolveDateRange: (dateFilter) =>
              getPortalFeedDateRange(dateFilter),
          });
          events = autoSectionResult.events;
          fullFilteredPool = autoSectionResult.fullFilteredPool;

          if (section.section_type === "mixed") {
            const curatedItems = (section.portal_section_items || [])
              .filter((item) => item.entity_type === "event")
              .sort((a, b) => a.display_order - b.display_order);

            const curatedEventsForSection = curatedItems
              .map((item) => eventMap.get(item.entity_id))
              .filter((e): e is FeedEvent => e !== undefined);

            events = mergePortalMixedSectionEvents(
              curatedEventsForSection,
              events,
              limit,
            );
          }
        }

        const isNightlifeCarousel = !!(
          section.auto_filter as Record<string, unknown>
        )?.nightlife_mode;
        if (isNightlifeCarousel && events.length > 0) {
          const poolForCounts =
            fullFilteredPool && fullFilteredPool.length > 0
              ? fullFilteredPool
              : events;
          const nightlifePoolData =
            buildPortalNightlifeCarouselData(poolForCounts);
          const nightlifeEventData = buildPortalNightlifeCarouselData(events);

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
            block_content: {
              nightlife_categories: nightlifePoolData.categories,
              total_events: poolForCounts.length,
            },
            auto_filter: section.auto_filter,
            events: nightlifeEventData.stampedEvents,
          };
        }

        const finalBlockType = resolvePortalSectionBlockType({
          requestedBlockType: section.block_type,
          eventCount: events.length,
          isCommunitySection,
        });

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
      .filter((section) =>
        shouldKeepPortalSection({
          blockType: section.block_type,
          eventCount: section.events.length,
        }),
      ),
  );

  // ---------------------------------------------------------------------------
  // 7. Merge holiday sections + finalize
  // ---------------------------------------------------------------------------
  const holidayFeedSections = buildPortalHolidayFeedSections(
    holidaySections,
    holidayEventsByTag,
  );
  const filteredFinalSections = finalizePortalFeedSections(
    feedSections,
    holidayFeedSections,
    new Map(
      holidaySections.map((section) => [section.id, section.display_order]),
    ),
  );

  if (
    filteredFinalSections.length === 0 &&
    !sectionIds?.length &&
    !bypassFeaturedSections &&
    feedSettings.featured_section_ids?.length
  ) {
    return loadPortalFeed({
      canonicalSlug,
      requestSlug,
      sectionIds,
      defaultLimit,
      timing,
      bypassFeaturedSections: true,
    });
  }

  // ---------------------------------------------------------------------------
  // 8. Social proof counts (with timeout)
  // ---------------------------------------------------------------------------
  const allEventIds = Array.from(
    new Set(
      filteredFinalSections.flatMap((section) =>
        section.events.map((event: FeedEvent) => event.id),
      ),
    ),
  );

  let socialCountsDeferred = false;
  const socialCounts = await timing.measure("social_counts", async () => {
    if (allEventIds.length === 0) {
      return new Map<
        number,
        { going: number; interested: number; recommendations: number }
      >();
    }

    const socialCountsPromise = fetchSocialProofCounts(allEventIds).catch(
      () =>
        new Map<
          number,
          { going: number; interested: number; recommendations: number }
        >(),
    );

    const result = await Promise.race([
      socialCountsPromise.then((counts) => ({
        counts,
        timedOut: false as const,
      })),
      new Promise<{
        counts: Map<
          number,
          { going: number; interested: number; recommendations: number }
        >;
        timedOut: true;
      }>((resolve) => {
        setTimeout(() => {
          socialCountsDeferred = true;
          resolve({
            counts: new Map(),
            timedOut: true,
          });
        }, PORTAL_FEED_SOCIAL_COUNTS_TIMEOUT_MS);
      }),
    ]);

    return result.counts;
  });

  if (socialCountsDeferred) {
    timing.addMetric(
      "social_counts_deferred",
      0,
      `${PORTAL_FEED_SOCIAL_COUNTS_TIMEOUT_MS}ms budget`,
    );
  }

  const sectionsWithCounts = attachPortalSocialCounts(
    filteredFinalSections,
    socialCounts,
  );

  // ---------------------------------------------------------------------------
  // 9. Build response
  // ---------------------------------------------------------------------------
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

  return {
    payload: responsePayload,
    serverTiming: timing.toHeader(),
  };
}
