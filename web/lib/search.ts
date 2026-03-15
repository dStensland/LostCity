import { supabase, type Event } from "./supabase";
import {
  CATEGORIES,
  DATE_FILTERS,
  PRICE_FILTERS,
  TAG_GROUPS,
  ALL_TAGS,
} from "./search-constants";
import {
  addDays,
  nextSaturday,
  nextSunday,
  isSaturday,
  isSunday,
} from "date-fns";
import { getLocalDateString, getLocalTimeString } from "@/lib/formats";
import { getMoodById, type MoodId } from "./moods";
import { decodeCursor, generateNextCursor, type CursorData } from "./cursor";
import { createLogger } from "./logger";
import type { Frequency, DayOfWeek } from "./recurrence";
import { applyFederatedPortalScopeToQuery, applyPortalScopeToQuery } from "./portal-scope";
import { applyFeedGate } from "./feed-gate";
import { isSceneEvent } from "./scene-event-routing";

const logger = createLogger("search");

export { CATEGORIES, DATE_FILTERS, PRICE_FILTERS, TAG_GROUPS, ALL_TAGS };

// Shared select string for event list queries.
// Both getFilteredEventsWithSearch and getFilteredEventsWithCursor use this
// to ensure a consistent response shape and avoid fetching unused columns.
const EVENT_LIST_SELECT = `
  id, title, start_date, start_time, end_time, end_date,
  is_all_day, is_free, is_live, is_tentpole, is_recurring,
  category_id, tags, genres,
  price_min, price_max,
  image_url, blurhash,
  source_url, ticket_url,
  featured_blurb, series_id, venue_id, source_id,
  recurrence_rule, is_regular_ready,
  venue:venues(id, name, slug, address, neighborhood, city, state, lat, lng, typical_price_min, typical_price_max, venue_type, location_designator, blurhash),
  category_data:categories(typical_price_min, typical_price_max),
  series:series(id, slug, title, series_type, image_url, frequency, day_of_week, festival:festivals(id, slug, name, image_url, festival_type, location, neighborhood))
`;


export interface SearchFilters {
  search?: string;
  categories?: string[];
  tags?: string[];
  genres?: string[];
  is_free?: boolean;
  price_max?: number;
  date_filter?: "now" | "today" | "tomorrow" | "weekend" | "week" | "month";
  date_range_start?: string; // Portal date range filter
  date_range_end?: string;   // Portal date range filter
  venue_id?: number;
  venue_ids?: number[];      // Portal venue filter
  include_rollups?: boolean;
  vibes?: string[];
  neighborhoods?: string[];
  city?: string;             // Portal city filter
  exclude_categories?: string[]; // Portal exclude filter
  geo_center?: [number, number]; // Portal geo filter [lat, lng]
  geo_radius_km?: number;    // Portal geo radius in km
  geo_bounds?: { sw_lat: number; sw_lng: number; ne_lat: number; ne_lng: number }; // Map viewport bounds filter
  mood?: MoodId;             // Mood-based filtering (expands to vibes/categories)
  portal_id?: string;        // Portal ID filter - all events belong to a portal
  portal_exclusive?: boolean; // If true, only show events tied to the portal_id
  exclude_classes?: boolean; // If true, exclude class events from results
  // Source filters
  source_ids?: number[];     // Explicit list of source IDs to filter by
  // Content filters (set automatically from user preferences / portal settings)
  exclude_adult?: boolean;   // If true, exclude adult entertainment venues/events (internal use)
  // Portal city — scopes venue sub-queries (vibes, neighborhoods, search) to this city.
  // Unlike `city` (which adds .in("venue_id", [...]) to the main query and can exceed
  // PostgREST URL limits for large cities), this only constrains batchFetchVenueIds.
  portal_city?: string;
}

// Rollup types for collapsed event groups
export interface EventGroup {
  type: "venue" | "source";
  id: string;
  title: string;
  subtitle: string;
  previewEvents: EventWithLocation[];
  totalCount: number;
  expandUrl: string;
}

export type EventOrGroup = EventWithLocation | EventGroup;

export function isEventGroup(item: EventOrGroup): item is EventGroup {
  return "type" in item && (item.type === "venue" || item.type === "source");
}

// Recommendation reason type for personalization
export type RecommendationReason = {
  type: "friends_going" | "followed_venue" | "followed_organization" | "neighborhood" | "price" | "category" | "trending";
  label: string;
  detail?: string;
};

export type EventWithLocation = Event & {
  venue: Event["venue"] & {
    lat: number | null;
    lng: number | null;
    typical_price_min: number | null;
    typical_price_max: number | null;
    venue_type?: string | null;
    location_designator?:
      | "standard"
      | "private_after_signup"
      | "virtual"
      | "recovery_meeting"
      | null;
    vibes?: string[] | null;
    description?: string | null;
  } | null;
  category_data: {
    typical_price_min: number | null;
    typical_price_max: number | null;
  } | null;
  // Festival / tentpole flags (direct on events table)
  festival_id?: string | null;
  is_tentpole?: boolean;
  // Series information (for series rollups)
  series_id?: string | null;
  series?: {
    id: string;
    slug: string;
    title: string;
    series_type: string;
    image_url: string | null;
    frequency: Frequency;
    day_of_week: DayOfWeek;
    festival?: {
      id: string;
      slug: string;
      name: string;
      image_url: string | null;
      festival_type?: string | null;
      location?: string | null;
      neighborhood?: string | null;
    } | null;
  } | null;
  // Social proof counts (optional, added when requested)
  going_count?: number;
  interested_count?: number;
  recommendation_count?: number;
  // Status indicators
  attendee_count?: number;
  is_live?: boolean;
  is_featured?: boolean;
  is_trending?: boolean;
  // Personalization
  score?: number;
  reasons?: RecommendationReason[];
  friends_going?: { user_id: string; username: string; display_name: string | null }[];
};


// Escape special characters for PostgREST filter strings
// Prevents injection in .or() and .filter() query parameters
function escapePostgrestValue(value: string): string {
  // Escape characters that have special meaning in PostgREST filters
  // Parentheses, commas, periods, and quotes can break the query syntax
  return value
    .replace(/\\/g, "\\\\")  // Escape backslashes first
    .replace(/"/g, '\\"')    // Escape double quotes
    .replace(/'/g, "''")     // Escape single quotes (SQL style)
    .replace(/\(/g, "\\(")   // Escape opening parenthesis
    .replace(/\)/g, "\\)")   // Escape closing parenthesis
    .replace(/,/g, "\\,")    // Escape commas
    .replace(/\./g, "\\.")   // Escape periods
    .replace(/%/g, "\\%")    // Escape LIKE wildcard %
    .replace(/_/g, "\\_");   // Escape LIKE single-char wildcard _
}

function getDateRange(filter: "now" | "today" | "tomorrow" | "weekend" | "week" | "month"): {
  start: string;
  end: string;
} {
  const now = new Date();
  const todayStr = getLocalDateString(now);

  switch (filter) {
    case "now":
    case "today":
      return {
        start: todayStr,
        end: todayStr,
      };

    case "tomorrow": {
      const tomorrow = addDays(now, 1);
      return {
        start: getLocalDateString(tomorrow),
        end: getLocalDateString(tomorrow),
      };
    }

    case "weekend": {
      let satDate: Date;
      let sunDate: Date;

      if (isSaturday(now)) {
        satDate = now;
        sunDate = addDays(now, 1);
      } else if (isSunday(now)) {
        satDate = now;
        sunDate = now;
      } else {
        satDate = nextSaturday(now);
        sunDate = nextSunday(now);
      }

      return {
        start: getLocalDateString(satDate),
        end: getLocalDateString(sunDate),
      };
    }

    case "week":
      return {
        start: todayStr,
        end: getLocalDateString(addDays(now, 7)),
      };

    case "month":
      return {
        start: todayStr,
        end: getLocalDateString(addDays(now, 30)),
      };

    default:
      return {
        start: todayStr,
        end: getLocalDateString(addDays(now, 365)),
      };
  }
}

// Batch fetch venue IDs for multiple filter types using targeted parallel queries
// PERFORMANCE OPTIMIZATION: Replaced full table scan with targeted queries that use indexes
async function batchFetchVenueIds(filters: {
  searchTerm?: string;
  moodVibes?: string[];
  vibes?: string[];
  neighborhoods?: string[];
  city?: string;
  portalCity?: string; // Scope ALL venue queries to this city (portal integrity)
}): Promise<{
  searchVenueIds: number[];
  searchEventIds: number[];
  moodVenueIds: number[];
  vibesVenueIds: number[];
  neighborhoodVenueIds: number[];
  cityVenueIds: number[];
}> {
  // If no filters, return empty arrays
  if (!filters.searchTerm && !filters.moodVibes && !filters.vibes && !filters.neighborhoods && !filters.city) {
    return {
      searchVenueIds: [],
      searchEventIds: [],
      moodVenueIds: [],
      vibesVenueIds: [],
      neighborhoodVenueIds: [],
      cityVenueIds: [],
    };
  }

  // Build parallel targeted queries - only fetch IDs that match specific filters
  const queries: Promise<number[]>[] = [];
  const queryTypes: ('search' | 'searchEvents' | 'moodVibes' | 'vibes' | 'neighborhoods' | 'city')[] = [];

  // Search term - use ilike for venue name matching
  if (filters.searchTerm) {
    const escapedTerm = escapePostgrestValue(filters.searchTerm);
    queries.push(
      (async () => {
        let q = supabase
          .from("venues")
          .select("id")
          .ilike("name", `%${escapedTerm}%`);
        if (filters.portalCity) q = q.eq("city", filters.portalCity);
        const { data } = await q;
        return (data || []).map((v: { id: number }) => v.id);
      })()
    );
    queryTypes.push('search');

    // Pre-fetch event IDs matching title/description to avoid ilike in the
    // main query chain (which causes PostgreSQL planner timeouts when combined
    // with multiple .or() filters and joins).
    queries.push(
      (async () => {
        const { data } = await supabase
          .from("events")
          .select("id")
          .or(`title.ilike.%${escapedTerm}%,description.ilike.%${escapedTerm}%`)
          .gte("start_date", getLocalDateString())
          .limit(500);
        return (data || []).map((e: { id: number }) => e.id);
      })()
    );
    queryTypes.push('searchEvents');
  }

  // Mood vibes - use overlaps for array matching
  if (filters.moodVibes && filters.moodVibes.length > 0) {
    const moodVibes = filters.moodVibes; // Local reference for type safety
    queries.push(
      (async () => {
        let q = supabase
          .from("venues")
          .select("id")
          .overlaps("vibes", moodVibes);
        if (filters.portalCity) q = q.eq("city", filters.portalCity);
        const { data } = await q;
        return (data || []).map((v: { id: number }) => v.id);
      })()
    );
    queryTypes.push('moodVibes');
  }

  // Regular vibes - use overlaps for array matching
  if (filters.vibes && filters.vibes.length > 0) {
    const vibes = filters.vibes; // Local reference for type safety
    queries.push(
      (async () => {
        let q = supabase
          .from("venues")
          .select("id")
          .overlaps("vibes", vibes);
        if (filters.portalCity) q = q.eq("city", filters.portalCity);
        const { data } = await q;
        return (data || []).map((v: { id: number }) => v.id);
      })()
    );
    queryTypes.push('vibes');
  }

  // Neighborhoods - use in for exact matching
  if (filters.neighborhoods && filters.neighborhoods.length > 0) {
    const neighborhoods = filters.neighborhoods; // Local reference for type safety
    queries.push(
      (async () => {
        let q = supabase
          .from("venues")
          .select("id")
          .in("neighborhood", neighborhoods);
        if (filters.portalCity) q = q.eq("city", filters.portalCity);
        const { data } = await q;
        return (data || []).map((v: { id: number }) => v.id);
      })()
    );
    queryTypes.push('neighborhoods');
  }

  // City - use eq for exact matching
  if (filters.city) {
    const city = filters.city; // Local reference for type safety
    queries.push(
      (async () => {
        const { data } = await supabase
          .from("venues")
          .select("id")
          .eq("city", city);
        return (data || []).map((v: { id: number }) => v.id);
      })()
    );
    queryTypes.push('city');
  }

  // Execute all queries in parallel
  const results = await Promise.all(queries);

  // Map results back to their respective arrays
  const resultMap: Record<string, number[]> = {
    search: [],
    searchEvents: [],
    moodVibes: [],
    vibes: [],
    neighborhoods: [],
    city: [],
  };

  queryTypes.forEach((type, index) => {
    resultMap[type] = results[index];
  });

  return {
    searchVenueIds: resultMap.search,
    searchEventIds: resultMap.searchEvents,
    moodVenueIds: resultMap.moodVibes,
    vibesVenueIds: resultMap.vibes,
    neighborhoodVenueIds: resultMap.neighborhoods,
    cityVenueIds: resultMap.city,
  };
}

// Score an event for relevance ranking
function scoreEvent(event: EventWithLocation, searchTerm: string): number {
  const term = searchTerm.toLowerCase();
  let score = 0;

  const title = event.title.toLowerCase();
  if (title.includes(term)) {
    score += 10;
    if (title.startsWith(term)) score += 5;
  }

  if (event.venue?.name?.toLowerCase().includes(term)) score += 8;
  if (event.description?.toLowerCase().includes(term)) score += 2;

  return score;
}

/**
 * Compute whether an event is currently live based on current time.
 * Uses a 180-minute (3 hour) default duration if end_time is not specified.
 *
 * @param event - Event with start_date, start_time, end_time, is_all_day, and is_live fields
 * @param now - Current date/time
 * @param today - Today's date in yyyy-MM-dd format
 * @returns true if the event is currently live
 */
function computeIsLive(
  event: {
    start_date: string;
    start_time: string | null;
    end_time: string | null;
    is_all_day?: boolean | null;
    is_live?: boolean;
  },
  now: Date,
  today: string
): boolean {
  // Skip if already marked live by database
  if (event.is_live) return true;

  // Only today's events can be live
  if (event.start_date !== today) return false;

  // All-day events are live all day
  if (event.is_all_day) return true;

  // Need start_time to determine if live
  if (!event.start_time) return false;

  // Parse start time (HH:MM:SS format)
  const [startH, startM] = event.start_time.split(":").map(Number);
  const startMinutes = startH * 60 + startM;

  // Parse end time or default to 3 hours after start
  let endMinutes: number;
  if (event.end_time) {
    const [endH, endM] = event.end_time.split(":").map(Number);
    endMinutes = endH * 60 + endM;
    // Handle events that go past midnight
    if (endMinutes < startMinutes) endMinutes += 24 * 60;
  } else {
    endMinutes = startMinutes + 180; // Default 3 hours
  }

  // Check if current time is within event window
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}


/**
 * Apply all search filters to a Supabase query.
 * This function centralizes the filter application logic that was previously duplicated
 * across multiple query functions.
 *
 * IMPORTANT: The Supabase query builder is immutable, so you must reassign the result:
 * `query = applySearchFilters(query, filters)`
 *
 * @param query - The Supabase query builder object
 * @param filters - The search filters to apply
 * @param options - Additional options (mood data, venue IDs, etc.)
 * @returns The modified query with all filters applied
 */
async function applySearchFilters(
  query: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  filters: SearchFilters,
  options: {
    mood: ReturnType<typeof getMoodById> | null;
    searchVenueIds: number[];
    searchEventIds: number[];
    moodVenueIds: number[];
    vibesVenueIds: number[];
    neighborhoodVenueIds: number[];
    cityVenueIds: number[];
  }
): Promise<{ query: any; shouldReturnEmpty: boolean }> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { mood, searchVenueIds, searchEventIds, moodVenueIds, vibesVenueIds, neighborhoodVenueIds, cityVenueIds } = options;

  // Apply search filter using pre-fetched IDs.
  // We pre-fetch event IDs matching title/description and venue IDs matching
  // venue name in batchFetchVenueIds. Using id.in() here instead of ilike
  // avoids PostgreSQL planner timeouts when combined with the other .or()
  // filters and table joins in the main query.
  if (filters.search && filters.search.trim()) {
    // Combine pre-fetched event IDs (title/description matches) with
    // venue ID matches into a single .or() condition
    const allMatchingIds = new Set([...searchEventIds]);
    const conditions: string[] = [];

    if (allMatchingIds.size > 0) {
      conditions.push(`id.in.(${[...allMatchingIds].join(",")})`);
    }
    if (searchVenueIds.length > 0) {
      conditions.push(`venue_id.in.(${searchVenueIds.join(",")})`);
    }

    if (conditions.length > 0) {
      query = query.or(conditions.join(","));
    } else {
      // No matches from pre-fetch — return empty
      return { query, shouldReturnEmpty: true };
    }
  }

  // Apply mood filter (expands to vibes and categories)
  if (mood) {
    const conditions: string[] = [];

    if (mood.categories.length > 0) {
      conditions.push(`category_id.in.(${mood.categories.join(",")})`);
    }

    if (moodVenueIds.length > 0) {
      conditions.push(`venue_id.in.(${moodVenueIds.join(",")})`);
    }

    if (conditions.length > 0) {
      query = query.or(conditions.join(","));
    } else {
      return { query, shouldReturnEmpty: true };
    }
  }

  // Apply category filter (using category_id)
  if (filters.categories && filters.categories.length > 0) {
    query = query.in("category_id", filters.categories);
  }

  // Apply tag filter (events with ANY of the selected tags)
  if (filters.tags && filters.tags.length > 0) {
    query = query.overlaps("tags", filters.tags);
  }

  // Apply genres filter (events with ANY of the selected genres)
  if (filters.genres && filters.genres.length > 0) {
    query = query.overlaps("genres", filters.genres);
  }

  // Apply vibes filter (venue attribute) - uses pre-fetched IDs
  if (filters.vibes && filters.vibes.length > 0) {
    if (vibesVenueIds.length > 0) {
      query = query.in("venue_id", vibesVenueIds);
    } else {
      return { query, shouldReturnEmpty: true };
    }
  }

  // Apply neighborhoods filter - uses pre-fetched IDs
  if (filters.neighborhoods && filters.neighborhoods.length > 0) {
    if (neighborhoodVenueIds.length > 0) {
      query = query.in("venue_id", neighborhoodVenueIds);
    } else {
      return { query, shouldReturnEmpty: true };
    }
  }

  // Apply city filter - uses pre-fetched IDs
  if (filters.city && cityVenueIds.length > 0) {
    query = query.in("venue_id", cityVenueIds);
  }

  // Apply price filters
  if (filters.is_free) {
    query = query.eq("is_free", true);
  } else if (filters.price_max) {
    // Include free events and events with price_min under the threshold
    query = query.or(`is_free.eq.true,price_min.lte.${filters.price_max}`);
  }

  // Apply date filter (include ongoing multi-day events that overlap the range)
  if (filters.date_filter) {
    const { start, end } = getDateRange(filters.date_filter);
    query = query.or(
      `and(start_date.gte.${start},start_date.lte.${end}),and(end_date.gte.${start},start_date.lte.${end})`
    );

    // For "now" filter, also require is_live to be true
    if (filters.date_filter === "now") {
      query = query.eq("is_live", true);
    }
  }

  // Apply venue filter
  if (filters.venue_id) {
    query = query.eq("venue_id", filters.venue_id);
  }

  // Exclude classes (events marked as classes)
  if (filters.exclude_classes) {
    query = query.or("is_class.eq.false,is_class.is.null");
  }

  // Always exclude sensitive events (support groups, etc.) from public search
  query = query.or("is_sensitive.eq.false,is_sensitive.is.null");

  // Apply multiple venues filter (portal filter)
  if (filters.venue_ids && filters.venue_ids.length > 0) {
    query = query.in("venue_id", filters.venue_ids);
  }

  // Apply exclude categories filter (portal filter)
  if (filters.exclude_categories && filters.exclude_categories.length > 0) {
    for (const cat of filters.exclude_categories) {
      query = query.neq("category_id", cat);
    }
  }

  // Apply adult content filter - exclude adult entertainment venues/events
  if (filters.exclude_adult) {
    query = query.or("is_adult.eq.false,is_adult.is.null");
  }

  // Apply date range filter (portal filter) - overrides date_filter if set
  // Include ongoing multi-day events that overlap the range
  if (filters.date_range_start && filters.date_range_end) {
    query = query.or(
      `and(start_date.gte.${filters.date_range_start},start_date.lte.${filters.date_range_end}),and(end_date.gte.${filters.date_range_start},start_date.lte.${filters.date_range_end})`
    );
  } else if (filters.date_range_start) {
    query = query.or(`start_date.gte.${filters.date_range_start},end_date.gte.${filters.date_range_start}`);
  } else if (filters.date_range_end) {
    query = query.lte("start_date", filters.date_range_end);
  }

  // Apply geo filter (portal filter) - find venues within radius of center point
  if (filters.geo_center && filters.geo_radius_km) {
    const [lat, lng] = filters.geo_center;
    const radiusKm = filters.geo_radius_km;

    // Use Haversine formula approximation for filtering
    // 1 degree of latitude ≈ 111 km
    // 1 degree of longitude ≈ 111 * cos(lat) km
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));

    const { data: nearbyVenues, error: geoError } = await supabase
      .from("venues")
      .select("id")
      .gte("lat", lat - latDelta)
      .lte("lat", lat + latDelta)
      .gte("lng", lng - lngDelta)
      .lte("lng", lng + lngDelta);

    if (geoError) {
      logger.error("geo_center venue query failed, skipping geo filter", geoError);
    } else {
      const venueIds = (nearbyVenues as { id: number }[] | null)?.map((v) => v.id) || [];
      if (venueIds.length > 0) {
        query = query.in("venue_id", venueIds);
      } else {
        return { query, shouldReturnEmpty: true };
      }
    }
  }

  // Note: geo_bounds viewport filtering is handled client-side by useMapEvents.
  // Server-side pre-fetch of venue IDs within bounds was removed because metro-area
  // queries return thousands of venue IDs, exceeding PostgREST's URL length limit
  // when passed to .in("venue_id", [...]). We still exclude venue-less events since
  // they can't be plotted on a map.
  if (filters.geo_bounds) {
    query = query.not("venue_id", "is", null);
  }

  return { query, shouldReturnEmpty: false };
}

export async function getFilteredEventsWithSearch(
  filters: SearchFilters,
  page = 1,
  pageSize = 20
): Promise<{ events: EventWithLocation[]; total: number }> {
  const now = new Date();
  const today = getLocalDateString(now);
  const currentTime = getLocalTimeString(now); // HH:MM:SS in ET
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("events")
    .select(EVENT_LIST_SELECT, { count: "estimated" })
    .or(`start_date.gte.${today},end_date.gte.${today}`)
    // Hide past events for today:
    // - Show if future date (start_date > today)
    // - Show if ongoing multi-day event (end_date > today)
    // - Show if end_time exists and hasn't passed yet
    // - Show if end_time is null but start_time hasn't passed yet
    // - Show all-day events
    .or(`start_date.gt.${today},end_date.gt.${today},end_time.gte.${currentTime},and(end_time.is.null,start_time.gte.${currentTime}),is_all_day.eq.true`)
    // Hide TBA events (no start_time, not all-day) — they don't present well
    .or("start_time.not.is.null,is_all_day.eq.true")
    .is("canonical_event_id", null); // Only show canonical events, not duplicates

  query = applyFeedGate(query);

  // Apply portal + federated source restriction filter.
  // If no portal_id is provided, keep query unscoped for admin/global callers.
  query = applyFederatedPortalScopeToQuery(query, {
    portalId: filters.portal_id,
    portalExclusive: filters.portal_exclusive,
    publicOnlyWhenNoPortal: false,
    sourceIds: filters.source_ids || [],
    sourceColumn: "source_id",
  });

  // Get mood data for potential vibes lookup
  const mood = filters.mood ? getMoodById(filters.mood) : null;

  // Batch all venue queries in parallel (eliminates N+1 sequential queries)
  const {
    searchVenueIds,
    searchEventIds,
    moodVenueIds,
    vibesVenueIds,
    neighborhoodVenueIds,
    cityVenueIds,
  } = await batchFetchVenueIds({
    searchTerm: filters.search?.trim() || undefined,
    moodVibes: mood?.vibes,
    vibes: filters.vibes,
    neighborhoods: filters.neighborhoods,
    city: filters.city,
    portalCity: filters.portal_city || filters.city, // Scope all venue queries to portal city
  });

  // Apply all search filters using the centralized helper
  const { query: filteredQuery, shouldReturnEmpty } = await applySearchFilters(query, filters, {
    mood,
    searchVenueIds,
    searchEventIds,
    moodVenueIds,
    vibesVenueIds,
    neighborhoodVenueIds,
    cityVenueIds,
  });

  // Early return if filters result in no matches
  if (shouldReturnEmpty) {
    return { events: [], total: 0 };
  }

  query = filteredQuery;

  // Order and paginate
  query = query
    .order("start_date", { ascending: true })
    .order("data_quality", { ascending: false, nullsFirst: false })
    .order("start_time", { ascending: true })
    .range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    logger.error("Failed to fetch filtered events", error, { filters, page, pageSize });
    return { events: [], total: 0 };
  }

  let events = data as EventWithLocation[];

  // Compute is_live for each event based on current time
  // Also alias category_id → category for downstream component compatibility
  events = events.map((event) => {
    const isLive = computeIsLive(event, now, today);
    return { ...event, ...(isLive ? { is_live: true } : {}), category: (event as any).category_id ?? (event as any).category ?? null };
  });
  events = events.filter((event) => !isSceneEvent(event));

  // Sort by relevance when search is active
  if (filters.search?.trim()) {
    const term = filters.search.trim();
    events = events.sort((a, b) => {
      const scoreDiff = scoreEvent(b, term) - scoreEvent(a, term);
      if (scoreDiff !== 0) return scoreDiff;
      return a.start_date.localeCompare(b.start_date);
    });
  }

  return { events, total: count ?? 0 };
}

/**
 * Cursor-based pagination for events
 * More stable than offset pagination - works correctly even when data changes
 */
export async function getFilteredEventsWithCursor(
  filters: SearchFilters,
  cursor: string | null,
  pageSize = 20
): Promise<{ events: EventWithLocation[]; nextCursor: string | null; hasMore: boolean }> {
  const now = new Date();
  const today = getLocalDateString(now);
  const currentTime = getLocalTimeString(now); // HH:MM:SS in ET

  // Decode cursor if provided
  let cursorData: CursorData | null = null;
  if (cursor) {
    cursorData = decodeCursor(cursor);
    if (!cursorData) {
      // Invalid cursor - start from beginning
      logger.warn("Invalid cursor provided, starting from beginning", { cursor });
    }
  }

  let query = supabase
    .from("events")
    .select(EVENT_LIST_SELECT)
    .or(`start_date.gte.${today},end_date.gte.${today}`)
    // Hide past events for today
    .or(`start_date.gt.${today},end_date.gt.${today},end_time.gte.${currentTime},and(end_time.is.null,start_time.gte.${currentTime}),is_all_day.eq.true`)
    // Hide TBA events (no start_time, not all-day)
    .or("start_time.not.is.null,is_all_day.eq.true")
    .is("canonical_event_id", null); // Only show canonical events, not duplicates

  query = applyFeedGate(query);

  query = applyFederatedPortalScopeToQuery(query, {
    portalId: filters.portal_id,
    portalExclusive: filters.portal_exclusive,
    publicOnlyWhenNoPortal: false,
    sourceIds: filters.source_ids || [],
    sourceColumn: "source_id",
  });

  // Get mood data for potential vibes lookup
  const mood = filters.mood ? getMoodById(filters.mood) : null;

  // Batch all venue queries in parallel
  const {
    searchVenueIds,
    searchEventIds,
    moodVenueIds,
    vibesVenueIds,
    neighborhoodVenueIds,
    cityVenueIds,
  } = await batchFetchVenueIds({
    searchTerm: filters.search?.trim() || undefined,
    moodVibes: mood?.vibes,
    vibes: filters.vibes,
    neighborhoods: filters.neighborhoods,
    city: filters.city,
    portalCity: filters.portal_city || filters.city, // Scope all venue queries to portal city
  });

  // Apply all search filters using the centralized helper
  const { query: filteredQuery, shouldReturnEmpty } = await applySearchFilters(query, filters, {
    mood,
    searchVenueIds,
    searchEventIds,
    moodVenueIds,
    vibesVenueIds,
    neighborhoodVenueIds,
    cityVenueIds,
  });

  // Early return if filters result in no matches
  if (shouldReturnEmpty) {
    return { events: [], nextCursor: null, hasMore: false };
  }

  query = filteredQuery;

  // CURSOR-BASED PAGINATION (keyset pagination)
  // Order: start_date ASC, start_time ASC (nulls first), id ASC
  if (cursorData) {
    // Get events AFTER the cursor position
    // The query is: (date > d) OR (date = d AND time > t) OR (date = d AND time = t AND id > i)
    query = query.or(
      `start_date.gt.${cursorData.d},` +
      `and(start_date.eq.${cursorData.d},start_time.gt.${cursorData.t}),` +
      `and(start_date.eq.${cursorData.d},start_time.eq.${cursorData.t},id.gt.${cursorData.i})`
    );
  }

  // Order and limit (fetch one extra to check hasMore)
  // data_quality is placed after start_time so the cursor tuple (date, time, id) remains valid
  query = query
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: true })
    .order("data_quality", { ascending: false, nullsFirst: false })
    .order("id", { ascending: true })
    .limit(pageSize + 1);

  const { data, error } = await query;

  if (error) {
    logger.error("Failed to fetch filtered events with cursor", error, { filters, cursor, pageSize });
    return { events: [], nextCursor: null, hasMore: false };
  }

  let events = data as EventWithLocation[];

  // Check if there are more results
  const hasMore = events.length > pageSize;
  if (hasMore) {
    events = events.slice(0, pageSize); // Remove the extra item
  }

  // Compute is_live for each event
  // Also alias category_id → category for downstream component compatibility
  events = events.map((event) => {
    const isLive = computeIsLive(event, now, today);
    return { ...event, ...(isLive ? { is_live: true } : {}), category: (event as any).category_id ?? (event as any).category ?? null };
  });
  events = events.filter((event) => !isSceneEvent(event));

  // Sort by relevance when search is active
  if (filters.search?.trim()) {
    const term = filters.search.trim();
    events = events.sort((a, b) => {
      const scoreDiff = scoreEvent(b, term) - scoreEvent(a, term);
      if (scoreDiff !== 0) return scoreDiff;
      return a.start_date.localeCompare(b.start_date);
    });
  }

  // Generate next cursor from the last event
  const nextCursor = hasMore ? generateNextCursor(events) : null;

  return { events, nextCursor, hasMore };
}

// Get all events for map view
export async function getEventsForMap(
  filters: SearchFilters,
  limit = 500
): Promise<EventWithLocation[]> {
  const today = getLocalDateString();

  // Get mood data for potential vibes lookup (needed for consistency with other functions)
  const mood = filters.mood ? getMoodById(filters.mood) : null;

  // PERFORMANCE OPTIMIZATION: Batch all venue ID lookups in parallel
  // instead of making sequential queries
  const {
    searchVenueIds,
    searchEventIds,
    moodVenueIds,
    vibesVenueIds,
    neighborhoodVenueIds,
    cityVenueIds,
  } = await batchFetchVenueIds({
    searchTerm: filters.search?.trim() || undefined,
    moodVibes: mood?.vibes,
    vibes: filters.vibes,
    neighborhoods: filters.neighborhoods,
    city: filters.city,
    portalCity: filters.portal_city || filters.city, // Scope all venue queries to portal city
  });

  // Early return if vibes filter specified but no matching venues found
  if (filters.vibes && filters.vibes.length > 0 && vibesVenueIds.length === 0) {
    return [];
  }

  // Early return if neighborhoods filter specified but no matching venues found
  if (filters.neighborhoods && filters.neighborhoods.length > 0 && neighborhoodVenueIds.length === 0) {
    return [];
  }

  let query = supabase
    .from("events")
    .select(
      `
      id,
      title,
      start_date,
      start_time,
      end_time,
      is_all_day,
      is_tentpole,
      is_recurring,
      category_id,
      tags,
      genres,
      is_free,
      is_live,
      series_id,
      series:series_id(series_type, festival:festivals(id)),
      venue:venues!inner(id, name, slug, address, neighborhood, city, state, lat, lng, venue_type)
    `
    )
    .or(`start_date.gte.${today},end_date.gte.${today}`)
    // Hide TBA events (no start_time, not all-day)
    .or("start_time.not.is.null,is_all_day.eq.true")
    .not("venues.lat", "is", null)
    .not("venues.lng", "is", null)
    .is("canonical_event_id", null); // Only show canonical events, not duplicates

  query = applyFederatedPortalScopeToQuery(query, {
    portalId: filters.portal_id,
    portalExclusive: filters.portal_exclusive,
    publicOnlyWhenNoPortal: false,
    sourceIds: filters.source_ids || [],
    sourceColumn: "source_id",
  });

  // Apply all search filters using the centralized helper
  // Note: For map view, we skip some filters that don't make sense (e.g., venue_ids)
  // so we pass a subset of filters
  const mapFilters: SearchFilters = {
    ...filters,
    // Map view doesn't use these portal-specific filters
    venue_ids: undefined,
    date_range_start: undefined,
    date_range_end: undefined,
    geo_center: undefined,
    geo_radius_km: undefined,
  };

  const { query: filteredQuery, shouldReturnEmpty } = await applySearchFilters(query, mapFilters, {
    mood,
    searchVenueIds,
    searchEventIds,
    moodVenueIds,
    vibesVenueIds,
    neighborhoodVenueIds,
    cityVenueIds,
  });

  // Early return if filters result in no matches
  if (shouldReturnEmpty) {
    return [];
  }

  query = filteredQuery;

  query = query
    .order("start_date", { ascending: true })
    .order("data_quality", { ascending: false, nullsFirst: false })
    .limit(limit);

  const { data, error } = await query;

  if (error) {
    logger.error("Failed to fetch events for map", error, { filters, limit });
    return [];
  }

  // Compute is_live for each event based on current time
  const now = new Date();
  const currentDate = getLocalDateString(now);

  const events = (data as EventWithLocation[]).map((event) => {
    const isLive = computeIsLive(event, now, currentDate);
    return { ...event, ...(isLive ? { is_live: true } : {}), category: (event as any).category_id ?? (event as any).category ?? null };
  });

  return events.filter((event) => !isSceneEvent(event));
}


// Re-export social proof from canonical module for backward compatibility
export { fetchSocialProofCounts, enrichEventsWithSocialProof } from "./social-proof";

// ============================================================================
// DYNAMIC FILTER AVAILABILITY
// ============================================================================

export interface AvailableFilter {
  filter_type: string;
  filter_value: string;
  display_label: string;
  parent_value: string | null;
  event_count: number;
  display_order: number;
  updated_at?: string;
}

export interface AvailableFilters {
  categories: { value: string; label: string; count: number }[];
  genres: Record<string, { value: string; label: string; count: number; isFormat?: boolean }[]>;
  tags: { value: string; label: string; count: number }[];
  vibes: { value: string; label: string; count: number }[];
  occasions: { value: string; label: string; tab: string; filterOverrides: Record<string, unknown> }[];
  lastUpdated: string | null;
}

// Fetch available filters that have active events
export async function getAvailableFilters(): Promise<AvailableFilters> {
  // Fetch available_filters and occasions from taxonomy_definitions in parallel
  const [filtersResult, occasionsResult] = await Promise.all([
    supabase
      .from("available_filters")
      .select("*")
      .order("event_count", { ascending: false }),
    supabase
      .from("taxonomy_definitions")
      .select("id, label, taxonomy_group, filter_overrides")
      .eq("taxonomy_type", "occasion")
      .eq("is_active", true)
      .order("display_order", { ascending: true }),
  ]);

  if (filtersResult.error || !filtersResult.data) {
    logger.error("Failed to fetch available filters", filtersResult.error);
    // Fall back to static filters
    return {
      categories: CATEGORIES.map((c) => ({ ...c, count: 0 })),
      genres: {},
      tags: ALL_TAGS.map((t) => ({ ...t, count: 0 })),
      vibes: [],
      occasions: [],
      lastUpdated: null,
    };
  }

  const filters = filtersResult.data as AvailableFilter[];
  const lastUpdated = filters[0]?.updated_at || null;

  // Group by type
  const categories = filters
    .filter((f) => f.filter_type === "category")
    .sort((a, b) => a.display_order - b.display_order)
    .map((f) => ({
      value: f.filter_value,
      label: f.display_label,
      count: f.event_count,
    }));

  // Genres grouped by parent_value (category)
  const genreFilters = filters.filter((f) => f.filter_type === "genre");
  const genres: Record<string, { value: string; label: string; count: number; isFormat?: boolean }[]> = {};
  for (const g of genreFilters) {
    const parent = g.parent_value || "other";
    if (!genres[parent]) {
      genres[parent] = [];
    }
    genres[parent].push({
      value: g.filter_value,
      label: g.display_label,
      count: g.event_count,
    });
  }

  const tags = filters
    .filter((f) => f.filter_type === "tag")
    .map((f) => ({
      value: f.filter_value,
      label: f.display_label,
      count: f.event_count,
    }));

  const vibes = filters
    .filter((f) => f.filter_type === "vibe")
    .map((f) => ({
      value: f.filter_value,
      label: f.display_label,
      count: f.event_count,
    }));

  // Occasions from taxonomy_definitions
  const occasions = (occasionsResult.data || []).map((row: { id: string; label: string; taxonomy_group: string; filter_overrides: Record<string, unknown> | null }) => ({
    value: row.id,
    label: row.label,
    tab: row.taxonomy_group,
    filterOverrides: row.filter_overrides || {},
  }));

  return {
    categories,
    genres,
    tags,
    vibes,
    occasions,
    lastUpdated,
  };
}
