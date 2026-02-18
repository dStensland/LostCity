import { supabase, type Event } from "./supabase";
import { createServiceClient } from "./supabase/service";
import {
  CATEGORIES,
  SUBCATEGORIES,
  DATE_FILTERS,
  PRICE_FILTERS,
  TAG_GROUPS,
  ALL_TAGS,
} from "./search-constants";
import {
  startOfDay,
  addDays,
  nextSaturday,
  nextSunday,
  isSaturday,
  isSunday,
  format,
} from "date-fns";
import { getMoodById, type MoodId } from "./moods";
import { decodeCursor, generateNextCursor, type CursorData } from "./cursor";
import { createLogger } from "./logger";
import type { Frequency, DayOfWeek } from "./recurrence";
import { applyPortalScopeToQuery } from "./portal-scope";

const logger = createLogger("search");

export { CATEGORIES, DATE_FILTERS, PRICE_FILTERS, TAG_GROUPS, ALL_TAGS };


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

export type Category = {
  id: string;
  name: string;
  display_order: number;
  icon: string | null;
  color: string | null;
};

export type Subcategory = {
  id: string;
  category_id: string;
  name: string;
  display_order: number;
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
  const today = startOfDay(now);

  switch (filter) {
    case "now":
    case "today":
      return {
        start: format(today, "yyyy-MM-dd"),
        end: format(today, "yyyy-MM-dd"),
      };

    case "tomorrow": {
      const tomorrow = addDays(today, 1);
      return {
        start: format(tomorrow, "yyyy-MM-dd"),
        end: format(tomorrow, "yyyy-MM-dd"),
      };
    }

    case "weekend": {
      let satDate: Date;
      let sunDate: Date;

      if (isSaturday(now)) {
        satDate = today;
        sunDate = addDays(today, 1);
      } else if (isSunday(now)) {
        satDate = today;
        sunDate = today;
      } else {
        satDate = nextSaturday(today);
        sunDate = nextSunday(today);
      }

      return {
        start: format(satDate, "yyyy-MM-dd"),
        end: format(sunDate, "yyyy-MM-dd"),
      };
    }

    case "week":
      return {
        start: format(today, "yyyy-MM-dd"),
        end: format(addDays(today, 7), "yyyy-MM-dd"),
      };

    case "month":
      return {
        start: format(today, "yyyy-MM-dd"),
        end: format(addDays(today, 30), "yyyy-MM-dd"),
      };

    default:
      return {
        start: format(today, "yyyy-MM-dd"),
        end: format(addDays(today, 365), "yyyy-MM-dd"),
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
}): Promise<{
  searchVenueIds: number[];
  moodVenueIds: number[];
  vibesVenueIds: number[];
  neighborhoodVenueIds: number[];
  cityVenueIds: number[];
}> {
  // If no filters, return empty arrays
  if (!filters.searchTerm && !filters.moodVibes && !filters.vibes && !filters.neighborhoods && !filters.city) {
    return {
      searchVenueIds: [],
      moodVenueIds: [],
      vibesVenueIds: [],
      neighborhoodVenueIds: [],
      cityVenueIds: [],
    };
  }

  // Build parallel targeted queries - only fetch IDs that match specific filters
  const queries: Promise<number[]>[] = [];
  const queryTypes: ('search' | 'moodVibes' | 'vibes' | 'neighborhoods' | 'city')[] = [];

  // Search term - use ilike for name matching
  if (filters.searchTerm) {
    const escapedTerm = escapePostgrestValue(filters.searchTerm);
    queries.push(
      (async () => {
        const { data } = await supabase
          .from("venues")
          .select("id")
          .ilike("name", `%${escapedTerm}%`);
        return (data || []).map((v: { id: number }) => v.id);
      })()
    );
    queryTypes.push('search');
  }

  // Mood vibes - use overlaps for array matching
  if (filters.moodVibes && filters.moodVibes.length > 0) {
    const moodVibes = filters.moodVibes; // Local reference for type safety
    queries.push(
      (async () => {
        const { data } = await supabase
          .from("venues")
          .select("id")
          .overlaps("vibes", moodVibes);
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
        const { data } = await supabase
          .from("venues")
          .select("id")
          .overlaps("vibes", vibes);
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
        const { data } = await supabase
          .from("venues")
          .select("id")
          .in("neighborhood", neighborhoods);
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
    moodVenueIds: number[];
    vibesVenueIds: number[];
    neighborhoodVenueIds: number[];
    cityVenueIds: number[];
  }
): Promise<{ query: any; shouldReturnEmpty: boolean }> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const { mood, searchVenueIds, moodVenueIds, vibesVenueIds, neighborhoodVenueIds, cityVenueIds } = options;

  // Apply search filter (includes venue name search)
  if (filters.search && filters.search.trim()) {
    const escapedSearch = escapePostgrestValue(filters.search.trim());
    const searchTerm = `%${escapedSearch}%`;

    if (searchVenueIds.length > 0) {
      query = query.or(
        `title.ilike.${searchTerm},description.ilike.${searchTerm},venue_id.in.(${searchVenueIds.join(",")})`
      );
    } else {
      query = query.or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`);
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

    const { data: nearbyVenues } = await supabase
      .from("venues")
      .select("id")
      .gte("lat", lat - latDelta)
      .lte("lat", lat + latDelta)
      .gte("lng", lng - lngDelta)
      .lte("lng", lng + lngDelta);

    const venueIds = (nearbyVenues as { id: number }[] | null)?.map((v) => v.id) || [];
    if (venueIds.length > 0) {
      query = query.in("venue_id", venueIds);
    } else {
      // No venues in range, return empty results
      return { query, shouldReturnEmpty: true };
    }
  }

  // Apply map viewport bounds filter (for map view performance)
  if (filters.geo_bounds) {
    const { sw_lat, sw_lng, ne_lat, ne_lng } = filters.geo_bounds;

    const { data: boundsVenues } = await supabase
      .from("venues")
      .select("id")
      .gte("lat", sw_lat)
      .lte("lat", ne_lat)
      .gte("lng", sw_lng)
      .lte("lng", ne_lng);

    const venueIds = (boundsVenues as { id: number }[] | null)?.map((v) => v.id) || [];
    if (venueIds.length > 0) {
      query = query.in("venue_id", venueIds);
    } else {
      // No venues in viewport, return empty results
      return { query, shouldReturnEmpty: true };
    }
  }

  return { query, shouldReturnEmpty: false };
}

export async function getFilteredEventsWithSearch(
  filters: SearchFilters,
  page = 1,
  pageSize = 20
): Promise<{ events: EventWithLocation[]; total: number }> {
  const now = new Date();
  // Use date-fns format to get local date (not UTC from toISOString)
  const today = format(startOfDay(now), "yyyy-MM-dd");
  const currentTime = now.toTimeString().split(" ")[0]; // HH:MM:SS format
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("events")
    .select(
      `
      *,
      venue:venues(id, name, slug, address, neighborhood, city, state, lat, lng, typical_price_min, typical_price_max, venue_type, location_designator, blurhash),
      category_data:categories(typical_price_min, typical_price_max),
      series:series(id, slug, title, series_type, image_url, frequency, day_of_week, festival:festivals(id, slug, name, image_url, festival_type, location, neighborhood))
    `,
      { count: "estimated" }
    )
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

  // Apply portal restriction filter.
  // If no portal_id is provided, keep query unscoped for admin/global callers.
  query = applyPortalScopeToQuery(query, {
    portalId: filters.portal_id,
    portalExclusive: filters.portal_exclusive,
    publicOnlyWhenNoPortal: false,
  });

  // Apply explicit source filtering if provided
  if (filters.source_ids && filters.source_ids.length > 0) {
    query = query.in("source_id", filters.source_ids);
  }

  // Get mood data for potential vibes lookup
  const mood = filters.mood ? getMoodById(filters.mood) : null;

  // Batch all venue queries in parallel (eliminates N+1 sequential queries)
  const {
    searchVenueIds,
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
  });

  // Apply all search filters using the centralized helper
  const { query: filteredQuery, shouldReturnEmpty } = await applySearchFilters(query, filters, {
    mood,
    searchVenueIds,
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
    .order("start_time", { ascending: true })
    .range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    logger.error("Failed to fetch filtered events", error, { filters, page, pageSize });
    return { events: [], total: 0 };
  }

  let events = data as EventWithLocation[];

  // Compute is_live for each event based on current time
  events = events.map((event) => {
    const isLive = computeIsLive(event, now, today);
    return isLive ? { ...event, is_live: true } : event;
  });

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
  // Use date-fns format to get local date (not UTC from toISOString)
  const today = format(startOfDay(now), "yyyy-MM-dd");
  const currentTime = now.toTimeString().split(" ")[0]; // HH:MM:SS format

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
    .select(
      `
      *,
      venue:venues(id, name, slug, address, neighborhood, city, state, lat, lng, typical_price_min, typical_price_max, venue_type, location_designator, blurhash),
      category_data:categories(typical_price_min, typical_price_max),
      series:series(id, slug, title, series_type, image_url, frequency, day_of_week, festival:festivals(id, slug, name, image_url, festival_type, location, neighborhood))
    `
    )
    .or(`start_date.gte.${today},end_date.gte.${today}`)
    // Hide past events for today
    .or(`start_date.gt.${today},end_date.gt.${today},end_time.gte.${currentTime},and(end_time.is.null,start_time.gte.${currentTime}),is_all_day.eq.true`)
    // Hide TBA events (no start_time, not all-day)
    .or("start_time.not.is.null,is_all_day.eq.true")
    .is("canonical_event_id", null); // Only show canonical events, not duplicates

  query = applyPortalScopeToQuery(query, {
    portalId: filters.portal_id,
    portalExclusive: filters.portal_exclusive,
    publicOnlyWhenNoPortal: false,
  });

  // Apply explicit source filtering if provided
  if (filters.source_ids && filters.source_ids.length > 0) {
    query = query.in("source_id", filters.source_ids);
  }

  // Get mood data for potential vibes lookup
  const mood = filters.mood ? getMoodById(filters.mood) : null;

  // Batch all venue queries in parallel
  const {
    searchVenueIds,
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
  });

  // Apply all search filters using the centralized helper
  const { query: filteredQuery, shouldReturnEmpty } = await applySearchFilters(query, filters, {
    mood,
    searchVenueIds,
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
  query = query
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: true })
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
  events = events.map((event) => {
    const isLive = computeIsLive(event, now, today);
    return isLive ? { ...event, is_live: true } : event;
  });

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
  // Use date-fns format to get local date (not UTC from toISOString)
  const today = format(startOfDay(new Date()), "yyyy-MM-dd");

  // Get mood data for potential vibes lookup (needed for consistency with other functions)
  const mood = filters.mood ? getMoodById(filters.mood) : null;

  // PERFORMANCE OPTIMIZATION: Batch all venue ID lookups in parallel
  // instead of making sequential queries
  const {
    searchVenueIds,
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
      category,
      category_id,
      is_free,
      is_live,
      venue:venues!inner(id, name, slug, address, neighborhood, city, state, lat, lng, venue_type)
    `
    )
    .or(`start_date.gte.${today},end_date.gte.${today}`)
    // Hide TBA events (no start_time, not all-day)
    .or("start_time.not.is.null,is_all_day.eq.true")
    .not("venues.lat", "is", null)
    .not("venues.lng", "is", null)
    .is("canonical_event_id", null); // Only show canonical events, not duplicates

  query = applyPortalScopeToQuery(query, {
    portalId: filters.portal_id,
    portalExclusive: filters.portal_exclusive,
    publicOnlyWhenNoPortal: false,
  });

  // Apply explicit source filtering if provided
  if (filters.source_ids && filters.source_ids.length > 0) {
    query = query.in("source_id", filters.source_ids);
  }

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

  query = query.order("start_date", { ascending: true }).limit(limit);

  const { data, error } = await query;

  if (error) {
    logger.error("Failed to fetch events for map", error, { filters, limit });
    return [];
  }

  // Compute is_live for each event based on current time
  const now = new Date();
  // Use date-fns format to get local date (not UTC from toISOString)
  const currentDate = format(startOfDay(now), "yyyy-MM-dd");

  const events = (data as EventWithLocation[]).map((event) => {
    const isLive = computeIsLive(event, now, currentDate);
    return isLive ? { ...event, is_live: true } : event;
  });

  return events;
}

// Fetch categories from database
export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    logger.error("Failed to fetch categories", error);
    return [];
  }

  return data as Category[];
}

// Fetch subcategories from database
export async function getSubcategories(categoryId?: string): Promise<Subcategory[]> {
  let query = supabase
    .from("subcategories")
    .select("*")
    .order("display_order", { ascending: true });

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  const { data, error } = await query;

  if (error) {
    logger.error("Failed to fetch subcategories", error, { categoryId });
    return [];
  }

  return data as Subcategory[];
}

export interface VenueWithCount {
  id: number;
  name: string;
  neighborhood: string | null;
  event_count: number;
}

// Get venues that have upcoming events
export async function getVenuesWithEvents(): Promise<VenueWithCount[]> {
  // Use date-fns format to get local date (not UTC from toISOString)
  const today = format(startOfDay(new Date()), "yyyy-MM-dd");

  const { data: events, error } = await supabase
    .from("events")
    .select("venue_id, venue:venues(id, name, neighborhood, location_designator)")
    .or(`start_date.gte.${today},end_date.gte.${today}`)
    // Hide TBA events (no start_time, not all-day)
    .or("start_time.not.is.null,is_all_day.eq.true")
    .not("venue_id", "is", null)
    .limit(500);

  if (error || !events) {
    logger.error("Failed to fetch venues with events", error);
    return [];
  }

  const venueMap = new Map<number, VenueWithCount>();

  type EventWithVenue = {
    venue_id: number | null;
    venue: { id: number; name: string; neighborhood: string | null } | null;
  };

  for (const event of events as EventWithVenue[]) {
    const venue = event.venue;
    if (!venue) continue;

    const existing = venueMap.get(venue.id);
    if (existing) {
      existing.event_count++;
    } else {
      venueMap.set(venue.id, {
        id: venue.id,
        name: venue.name,
        neighborhood: venue.neighborhood,
        event_count: 1,
      });
    }
  }

  return Array.from(venueMap.values()).sort((a, b) => {
    if (b.event_count !== a.event_count) return b.event_count - a.event_count;
    return a.name.localeCompare(b.name);
  });
}

// Get search suggestions for autocomplete
export type SearchSuggestion = {
  text: string;
  type: "venue" | "event" | "neighborhood" | "organizer";
};

export async function getSearchSuggestions(prefix: string, options?: { portalId?: string; portalCities?: string[] }): Promise<SearchSuggestion[]> {
  if (prefix.length < 2) return [];

  const searchTerm = `${escapePostgrestValue(prefix)}%`;
  // Use date-fns format to get local date (not UTC from toISOString)
  const today = format(startOfDay(new Date()), "yyyy-MM-dd");

  // Build venue query with optional city filter
  let venueQuery = supabase.from("venues").select("name").ilike("name", searchTerm);
  if (options?.portalCities?.length) {
    venueQuery = venueQuery.in("city", options.portalCities);
  }

  // Build event query with optional portal filter
  let eventQuery = supabase
    .from("events")
    .select("title")
    .ilike("title", searchTerm)
    .or(`start_date.gte.${today},end_date.gte.${today}`);
  eventQuery = applyPortalScopeToQuery(eventQuery, {
    portalId: options?.portalId,
    portalExclusive: false,
    publicOnlyWhenNoPortal: false,
  });

  // Build neighborhood query with optional city filter
  let neighborhoodQuery = supabase
    .from("venues")
    .select("neighborhood")
    .ilike("neighborhood", searchTerm)
    .not("neighborhood", "is", null);
  if (options?.portalCities?.length) {
    neighborhoodQuery = neighborhoodQuery.in("city", options.portalCities);
  }

  const [venueResult, eventResult, neighborhoodResult, producerResult] = await Promise.all([
    venueQuery.limit(3),
    eventQuery.limit(3),
    neighborhoodQuery.limit(3),
    supabase
      .from("organizations")
      .select("name")
      .ilike("name", searchTerm)
      .eq("hidden", false)
      .limit(2),
  ]);

  const suggestions: SearchSuggestion[] = [];

  // Add venues
  const venues = (venueResult.data as { name: string }[] | null) || [];
  for (const v of venues) {
    if (!suggestions.some((s) => s.text === v.name)) {
      suggestions.push({ text: v.name, type: "venue" });
    }
  }

  // Add organizers (producers)
  const producers = (producerResult.data as { name: string }[] | null) || [];
  for (const p of producers) {
    if (!suggestions.some((s) => s.text === p.name)) {
      suggestions.push({ text: p.name, type: "organizer" });
    }
  }

  // Add unique neighborhoods
  const neighborhoods = (neighborhoodResult.data as { neighborhood: string | null }[] | null) || [];
  const uniqueNeighborhoods = [...new Set(neighborhoods.map((n) => n.neighborhood).filter(Boolean))];
  for (const n of uniqueNeighborhoods) {
    if (n && !suggestions.some((s) => s.text === n)) {
      suggestions.push({ text: n, type: "neighborhood" });
    }
  }

  // Add events
  const events = (eventResult.data as { title: string }[] | null) || [];
  for (const e of events) {
    if (!suggestions.some((s) => s.text === e.title)) {
      suggestions.push({ text: e.title, type: "event" });
    }
  }

  return suggestions.slice(0, 6);
}

// ============================================================================
// ROLLUP SUPPORT - Collapse repeated events from same venue/source
// ============================================================================

interface RollupStats {
  venueRollups: {
    venueId: number;
    venueName: string;
    venueSlug: string;
    count: number;
  }[];
}

// Get rollup statistics for a date range
async function getRollupStats(
  dateStart: string,
  dateEnd: string,
  categoryId?: string,
  portalId?: string,
  portalExclusive?: boolean
): Promise<RollupStats> {
  // Get events with source rollup behavior
  let query = supabase
    .from("events")
    .select(
      `
      venue_id,
      source_id,
      venues(id, name, slug),
      sources(id, name, rollup_behavior)
    `
    )
    .gte("start_date", dateStart)
    .lte("start_date", dateEnd)
    .is("canonical_event_id", null); // Only show canonical events, not duplicates

  query = applyPortalScopeToQuery(query, {
    portalId,
    portalExclusive,
    publicOnlyWhenNoPortal: false,
  });

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return { venueRollups: [] };
  }

  // Count events by venue for 'venue' rollup behavior
  const venueCounts = new Map<
    number,
    { venueId: number; venueName: string; venueSlug: string; count: number }
  >();

  type EventWithJoins = {
    venue_id: number | null;
    source_id: number | null;
    venues: { id: number; name: string; slug: string } | null;
    sources: { id: number; name: string; rollup_behavior: string } | null;
  };

  for (const event of data as EventWithJoins[]) {
    const venue = event.venues;
    const source = event.sources;
    const rollupBehavior = source?.rollup_behavior || "normal";

    if (rollupBehavior === "venue" && venue) {
      const existing = venueCounts.get(venue.id);
      if (existing) {
        existing.count++;
      } else {
        venueCounts.set(venue.id, {
          venueId: venue.id,
          venueName: venue.name,
          venueSlug: venue.slug,
          count: 1,
        });
      }
    }
  }

  // Filter to only those exceeding thresholds
  const venueRollups = Array.from(venueCounts.values()).filter((v) => v.count > 3);

  return { venueRollups };
}

// Get events with rollup support
export async function getFilteredEventsWithRollups(
  filters: SearchFilters,
  page = 1,
  pageSize = 20
): Promise<{ items: EventOrGroup[]; total: number }> {
  // Use date-fns format to get local date (not UTC from toISOString)
  const today = format(startOfDay(new Date()), "yyyy-MM-dd");

  // Get date range for rollup calculation
  const dateRange = filters.date_filter
    ? getDateRange(filters.date_filter)
    : { start: today, end: format(addDays(new Date(), 365), "yyyy-MM-dd") };

  // Get rollup stats
  const rollupStats = await getRollupStats(
    dateRange.start,
    dateRange.end,
    filters.categories?.[0],
    filters.portal_id,
    filters.portal_exclusive
  );

  const venueIdsToExclude = rollupStats.venueRollups.map((v) => v.venueId);

  // Get regular events (excluding those that will be rolled up)
  const { events, total } = await getFilteredEventsWithSearch(
    {
      ...filters,
      // We'll handle exclusion in a separate step since Supabase can't easily do NOT IN
    },
    page,
    pageSize
  );

  // Filter out events that should be rolled up
  const filteredEvents = events.filter((event) => {
    // Check if venue should be rolled up
    if (event.venue && venueIdsToExclude.includes(event.venue.id)) {
      return false;
    }
    // Check source_id - need to get it from the event
    // For now, we don't have source_id in the event select, so skip source exclusion
    return true;
  });

  // Build rollup groups
  const groups: EventGroup[] = [];

  for (const vr of rollupStats.venueRollups) {
    // Get preview events for this venue
    const { data: previewData } = await supabase
      .from("events")
      .select(
        `
        *,
        venue:venues(id, name, slug, address, neighborhood, city, state, lat, lng, typical_price_min, typical_price_max, venue_type, location_designator)
      `
      )
      .eq("venue_id", vr.venueId)
      .gte("start_date", dateRange.start)
      .lte("start_date", dateRange.end)
      .order("start_date")
      .order("start_time")
      .limit(3);

    groups.push({
      type: "venue",
      id: `venue-${vr.venueId}`,
      title: vr.venueName,
      subtitle: `${vr.count} events`,
      previewEvents: (previewData || []) as EventWithLocation[],
      totalCount: vr.count,
      expandUrl: `/spots/${vr.venueSlug}`,
    });
  }

  // Combine and sort by date
  const items: EventOrGroup[] = [...filteredEvents, ...groups];

  // Sort: events by date, groups by their first preview event date
  items.sort((a, b) => {
    const dateA = isEventGroup(a)
      ? a.previewEvents[0]?.start_date || "9999-99-99"
      : a.start_date;
    const dateB = isEventGroup(b)
      ? b.previewEvents[0]?.start_date || "9999-99-99"
      : b.start_date;
    return dateA.localeCompare(dateB);
  });

  return {
    items,
    total: total - venueIdsToExclude.length * 3 + groups.length, // Approximate
  };
}

// Fetch social proof counts for a list of events
export async function fetchSocialProofCounts(
  eventIds: number[]
): Promise<Map<number, { going: number; interested: number; recommendations: number }>> {
  if (eventIds.length === 0) {
    return new Map();
  }

  const counts = new Map<number, { going: number; interested: number; recommendations: number }>();

  // Use service client to bypass RLS for aggregation queries
  // This is server-side only and safe for reading public social data
  let serviceClient;
  try {
    serviceClient = createServiceClient();
  } catch {
    // Service key not available (e.g., during build), return empty counts
    // Initialize all events with 0 counts
    eventIds.forEach((id) => {
      counts.set(id, { going: 0, interested: 0, recommendations: 0 });
    });
    return counts;
  }

  // PERFORMANCE OPTIMIZATION: Use database function to aggregate counts in a single query
  // This replaces fetching all individual RSVP/recommendation rows and counting in JS
  const { data, error } = await (
    serviceClient.rpc as unknown as (
      name: string,
      params?: Record<string, unknown>
    ) => Promise<{ data: unknown; error: unknown }>
  )("get_social_proof_counts", {
    event_ids: eventIds,
  });

  if (error) {
    logger.error("Failed to fetch social proof counts", error);
    // Return empty counts on error
    eventIds.forEach((id) => {
      counts.set(id, { going: 0, interested: 0, recommendations: 0 });
    });
    return counts;
  }

  // Map the aggregated results
  type SocialProofRow = {
    event_id: number;
    going_count: number;
    interested_count: number;
    recommendation_count: number;
  };

  for (const row of (data || []) as SocialProofRow[]) {
    counts.set(row.event_id, {
      going: Number(row.going_count),
      interested: Number(row.interested_count),
      recommendations: Number(row.recommendation_count),
    });
  }

  return counts;
}

// Enrich events with social proof counts
export async function enrichEventsWithSocialProof(
  events: EventWithLocation[]
): Promise<EventWithLocation[]> {
  const eventIds = events.map((e) => e.id);
  const counts = await fetchSocialProofCounts(eventIds);

  return events.map((event) => {
    const eventCounts = counts.get(event.id);
    return {
      ...event,
      going_count: eventCounts?.going || 0,
      interested_count: eventCounts?.interested || 0,
      recommendation_count: eventCounts?.recommendations || 0,
    };
  });
}

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
  subcategories: Record<string, { value: string; label: string; count: number }[]>;
  tags: { value: string; label: string; count: number }[];
  lastUpdated: string | null;
}

// Fetch available filters that have active events
export async function getAvailableFilters(): Promise<AvailableFilters> {
  const { data, error } = await supabase
    .from("available_filters")
    .select("*")
    .order("event_count", { ascending: false });

  if (error || !data) {
    logger.error("Failed to fetch available filters", error);
    // Fall back to static filters
    return {
      categories: CATEGORIES.map((c) => ({ ...c, count: 0 })),
      subcategories: Object.fromEntries(
        Object.entries(SUBCATEGORIES).map(([k, v]) => [
          k,
          v.map((s) => ({ ...s, count: 0 })),
        ])
      ),
      tags: ALL_TAGS.map((t) => ({ ...t, count: 0 })),
      lastUpdated: null,
    };
  }

  const filters = data as AvailableFilter[];
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

  const subcategoryFilters = filters.filter((f) => f.filter_type === "subcategory");
  const subcategories: Record<string, { value: string; label: string; count: number }[]> = {};
  for (const sub of subcategoryFilters) {
    const parent = sub.parent_value || "other";
    if (!subcategories[parent]) {
      subcategories[parent] = [];
    }
    subcategories[parent].push({
      value: sub.filter_value,
      label: sub.display_label,
      count: sub.event_count,
    });
  }

  const tags = filters
    .filter((f) => f.filter_type === "tag")
    .map((f) => ({
      value: f.filter_value,
      label: f.display_label,
      count: f.event_count,
    }));

  return {
    categories,
    subcategories,
    tags,
    lastUpdated,
  };
}
