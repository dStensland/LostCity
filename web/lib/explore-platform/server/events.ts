import "server-only";

import {
  PRICE_FILTERS,
  getFilteredEventsWithCursor,
  type SearchFilters,
} from "@/lib/event-search";
import { enrichEventsWithSocialProof } from "@/lib/social-proof";
import { deduplicateCinemaEvents } from "@/lib/cinema-filter";
import type { MoodId } from "@/lib/moods";
import { escapeSQLPattern } from "@/lib/api-utils";
import { createClient } from "@/lib/supabase/server";
import { getLocalDateString } from "@/lib/formats";
import type { Festival } from "@/lib/festivals";
import { logger } from "@/lib/logger";
import { resolvePortalQueryContext } from "@/lib/portal-query-context";
import { filterByPortalCity } from "@/lib/portal-scope";
import { getPortalSourceAccess } from "@/lib/federation";
import { getOrSetSharedCacheJson } from "@/lib/shared-cache";
import type { ExploreLaneServerLoaderArgs } from "@/lib/explore-platform/types";
import type {
  EventsLaneInitialData,
  TimelineResponse,
} from "@/lib/explore-platform/lane-data";

const TIMELINE_CACHE_NAMESPACE = "api:timeline";
const TIMELINE_CACHE_TTL_MS = 60 * 1000;

function safeParseInt(
  value: string | null,
  defaultValue: number,
  min = 1,
  max = 1000,
): number {
  if (!value) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return defaultValue;
  return Math.min(Math.max(parsed, min), max);
}

function buildTimelineCacheKey(
  portalId: string | undefined,
  filters: SearchFilters,
): string {
  const parts = [
    portalId || "none",
    filters.search || "",
    filters.categories?.join(",") || "",
    filters.genres?.join(",") || "",
    filters.tags?.join(",") || "",
    filters.vibes?.join(",") || "",
    filters.neighborhoods?.join(",") || "",
    filters.is_free ? "free" : "",
    filters.price_max?.toString() || "",
    filters.date_filter || "",
    filters.venue_id?.toString() || "",
    filters.mood || "",
    filters.portal_exclusive ? "excl" : "",
    filters.festival_slug || "",
  ];
  return parts.join("|");
}

async function fetchTimelinePage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  filters: SearchFilters,
  portalCity: string | undefined,
  cursor: string | null,
  pageSize: number,
): Promise<TimelineResponse> {
  const hasEventOnlyFilters = !!(
    filters.tags?.length ||
    filters.vibes?.length ||
    filters.venue_id
  );
  const today = getLocalDateString(new Date());

  const [eventsResult, festivalsResult] = await Promise.all([
    getFilteredEventsWithCursor(filters, cursor, pageSize),
    hasEventOnlyFilters
      ? Promise.resolve({ data: [], error: null })
      : (async () => {
          let festivalQuery = supabase
            .from("festivals")
            .select(
              "id, name, slug, website, location, neighborhood, categories, free, announced_start, announced_end, ticket_url, description, image_url, typical_month, typical_duration_days, festival_type, portal_id",
            )
            .not("announced_start", "is", null)
            .not(
              "festival_type",
              "in",
              "(conference,trade_show,professional_development,convention)",
            );

          festivalQuery = festivalQuery.or(
            `announced_end.gte.${today},announced_end.is.null`,
          );

          if (filters.portal_id) {
            festivalQuery = festivalQuery.eq("portal_id", filters.portal_id);
          }

          if (filters.search) {
            const escapedSearch = escapeSQLPattern(filters.search);
            festivalQuery = festivalQuery.ilike("name", `%${escapedSearch}%`);
          }

          if (filters.categories && filters.categories.length > 0) {
            festivalQuery = festivalQuery.overlaps(
              "categories",
              filters.categories,
            );
          }

          if (filters.is_free) {
            festivalQuery = festivalQuery.eq("free", true);
          }

          if (filters.neighborhoods && filters.neighborhoods.length > 0) {
            festivalQuery = festivalQuery.in(
              "neighborhood",
              filters.neighborhoods,
            );
          }

          if (filters.date_filter === "today") {
            festivalQuery = festivalQuery
              .lte("announced_start", today)
              .gte("announced_end", today);
          }

          return festivalQuery
            .order("announced_start", { ascending: true })
            .limit(50);
        })(),
  ]);

  const { events: rawEvents, nextCursor, hasMore } = eventsResult;
  const cityFilteredEvents = filterByPortalCity(rawEvents, portalCity, {
    allowMissingCity: true,
  });
  const enrichedEvents = await enrichEventsWithSocialProof(cityFilteredEvents);
  const events = deduplicateCinemaEvents(enrichedEvents) as typeof enrichedEvents;

  let festivals: Festival[] = [];
  let festivalError: { message: string } | null = null;

  if (!hasEventOnlyFilters) {
    const { data: festivalsData, error } = festivalsResult;

    if (festivalsData && hasMore && events.length > 0) {
      const lastEventDate = events[events.length - 1].start_date;
      festivals = (festivalsData as Festival[]).filter((festival) => {
        return (
          (festival.announced_start &&
            festival.announced_start >= today &&
            festival.announced_start <= lastEventDate) ||
          (festival.announced_start &&
            festival.announced_start <= today &&
            festival.announced_end &&
            festival.announced_end >= today)
        );
      });
    } else {
      festivals = (festivalsData || []) as Festival[];
    }

    if (festivals.length > 0 && events.length > 0) {
      const normalize = (value: string) =>
        value.toLowerCase().replace(/[^a-z0-9]/g, "");
      const eventTitleNorms = new Set(events.map((event) => normalize(event.title)));
      festivals = festivals.filter((festival) => {
        const normalizedName = normalize(festival.name);
        return (
          !eventTitleNorms.has(normalizedName) &&
          ![...eventTitleNorms].some(
            (eventName) =>
              eventName.includes(normalizedName) ||
              normalizedName.includes(eventName),
          )
        );
      });
    }

    festivalError = error;
  }

  if (festivalError) {
    logger.error("Error fetching festivals for timeline", {
      error: festivalError.message,
    });
    return {
      events,
      festivals: [],
      cursor: nextCursor,
      hasMore,
    };
  }

  return {
    events,
    festivals,
    cursor: nextCursor,
    hasMore,
  };
}

export async function getExploreEventsInitialData({
  portalId,
  portalExclusive,
  params,
}: ExploreLaneServerLoaderArgs): Promise<EventsLaneInitialData | null> {
  const display = params.get("display");
  if (display === "map" || display === "calendar") {
    return null;
  }

  const searchParams = new URLSearchParams(params.toString());
  searchParams.set("portal_id", portalId);
  if (portalExclusive) {
    searchParams.set("portal_exclusive", "true");
  }

  const priceParam = searchParams.get("price");
  const priceFilter = PRICE_FILTERS.find((entry) => entry.value === priceParam);
  const isFree =
    priceParam === "free" || searchParams.get("free") === "1" || undefined;
  const priceMax = priceFilter?.max || undefined;
  const venueParam = searchParams.get("venue");
  const venueId = venueParam
    ? safeParseInt(venueParam, 0, 0, 999999)
    : undefined;

  const supabase = await createClient();
  const portalContext = await resolvePortalQueryContext(supabase, searchParams);
  const sourceAccess = await getPortalSourceAccess(portalId);
  const portalCity = !portalExclusive ? portalContext.filters.city : undefined;

  const filters: SearchFilters = {
    search: searchParams.get("search") || undefined,
    categories:
      searchParams.get("categories")?.split(",").filter(Boolean) || undefined,
    genres: searchParams.get("genres")?.split(",").filter(Boolean) || undefined,
    tags: searchParams.get("tags")?.split(",").filter(Boolean) || undefined,
    vibes: searchParams.get("vibes")?.split(",").filter(Boolean) || undefined,
    neighborhoods:
      searchParams.get("neighborhoods")?.split(",").filter(Boolean) || undefined,
    is_free: isFree,
    price_max: priceMax,
    date_filter:
      (searchParams.get("date") as "today" | "weekend" | "week") || undefined,
    venue_id: venueId || undefined,
    mood: (searchParams.get("mood") as MoodId) || undefined,
    portal_id: portalId,
    portal_exclusive: portalExclusive,
    source_ids: sourceAccess.sourceIds.length ? sourceAccess.sourceIds : undefined,
    exclude_classes: true,
    exclude_categories: portalContext.filters.exclude_categories?.length
      ? portalContext.filters.exclude_categories
      : undefined,
    festival_slug: searchParams.get("series") || undefined,
  };

  const cacheKey = buildTimelineCacheKey(portalId, filters);
  const initialPage = await getOrSetSharedCacheJson<TimelineResponse>(
    TIMELINE_CACHE_NAMESPACE,
    cacheKey,
    TIMELINE_CACHE_TTL_MS,
    async () => fetchTimelinePage(supabase, filters, portalCity, null, 20),
    { maxEntries: 100 },
  );

  return {
    initialPage,
    effectiveDate: filters.date_filter ?? null,
    filterSnapshot: searchParams.toString(),
  };
}
