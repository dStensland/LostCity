import { supabase, type Event } from "./supabase";
import { createServiceClient } from "./supabase/service";
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
import { getPortalSourceAccess, type PortalSourceAccess } from "./federation";

// Cache for portal source access (refreshed on each request but cached within a request)
const sourceAccessCache: Map<string, { data: PortalSourceAccess; timestamp: number }> = new Map();
const CACHE_TTL_MS = 60000; // 1 minute cache

/**
 * Get accessible source IDs for a portal using the federation system.
 * Uses a short-lived cache to avoid repeated database queries within a request.
 */
async function getAccessibleSourceIds(portalId: string): Promise<{
  sourceIds: number[];
  categoryConstraints: Map<number, string[] | null>;
}> {
  const now = Date.now();
  const cached = sourceAccessCache.get(portalId);

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return {
      sourceIds: cached.data.sourceIds,
      categoryConstraints: cached.data.categoryConstraints,
    };
  }

  try {
    const access = await getPortalSourceAccess(portalId);
    sourceAccessCache.set(portalId, { data: access, timestamp: now });
    return {
      sourceIds: access.sourceIds,
      categoryConstraints: access.categoryConstraints,
    };
  } catch (error) {
    console.error("Error fetching portal source access:", error);
    // Return empty on error - this will effectively hide all events
    return { sourceIds: [], categoryConstraints: new Map() };
  }
}

export interface SearchFilters {
  search?: string;
  categories?: string[];
  subcategories?: string[];
  tags?: string[];
  is_free?: boolean;
  price_max?: number;
  date_filter?: "now" | "today" | "tomorrow" | "weekend" | "week";
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
  mood?: MoodId;             // Mood-based filtering (expands to vibes/categories)
  portal_id?: string;        // Portal-restricted events filter
  portal_exclusive?: boolean; // If true, only show events for this portal (not public events)
  // Federation filters
  source_ids?: number[];     // Explicit list of source IDs to filter by
  use_federation?: boolean;  // If true, fetch source access from federation system
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
  type: "friends_going" | "followed_venue" | "followed_producer" | "neighborhood" | "price" | "category" | "trending";
  label: string;
  detail?: string;
};

export type EventWithLocation = Event & {
  venue: Event["venue"] & {
    lat: number | null;
    lng: number | null;
    typical_price_min: number | null;
    typical_price_max: number | null;
    spot_type?: string | null;
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
    .replace(/\./g, "\\.");  // Escape periods
}

function getDateRange(filter: "now" | "today" | "tomorrow" | "weekend" | "week"): {
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

    default:
      return {
        start: format(today, "yyyy-MM-dd"),
        end: format(addDays(today, 365), "yyyy-MM-dd"),
      };
  }
}

// Batch fetch venue IDs for multiple filter types in parallel
// This eliminates N+1 queries when multiple filters are applied
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
  const queries: Promise<{ type: string; ids: number[] }>[] = [];

  // Queue all needed venue queries (wrapped in Promise.resolve for proper typing)
  if (filters.searchTerm) {
    queries.push(
      Promise.resolve(
        supabase
          .from("venues")
          .select("id")
          .ilike("name", `%${filters.searchTerm}%`)
      ).then(({ data }) => ({
        type: "search",
        ids: (data as { id: number }[] | null)?.map((v) => v.id) || [],
      }))
    );
  }

  if (filters.moodVibes && filters.moodVibes.length > 0) {
    queries.push(
      Promise.resolve(
        supabase
          .from("venues")
          .select("id")
          .overlaps("vibes", filters.moodVibes)
      ).then(({ data }) => ({
        type: "mood",
        ids: (data as { id: number }[] | null)?.map((v) => v.id) || [],
      }))
    );
  }

  if (filters.vibes && filters.vibes.length > 0) {
    queries.push(
      Promise.resolve(
        supabase
          .from("venues")
          .select("id")
          .overlaps("vibes", filters.vibes)
      ).then(({ data }) => ({
        type: "vibes",
        ids: (data as { id: number }[] | null)?.map((v) => v.id) || [],
      }))
    );
  }

  if (filters.neighborhoods && filters.neighborhoods.length > 0) {
    queries.push(
      Promise.resolve(
        supabase
          .from("venues")
          .select("id")
          .in("neighborhood", filters.neighborhoods)
      ).then(({ data }) => ({
        type: "neighborhoods",
        ids: (data as { id: number }[] | null)?.map((v) => v.id) || [],
      }))
    );
  }

  if (filters.city) {
    queries.push(
      Promise.resolve(
        supabase
          .from("venues")
          .select("id")
          .ilike("city", filters.city)
      ).then(({ data }) => ({
        type: "city",
        ids: (data as { id: number }[] | null)?.map((v) => v.id) || [],
      }))
    );
  }

  // Execute all queries in parallel
  const results = await Promise.all(queries);

  // Map results back to types
  const resultMap: Record<string, number[]> = {};
  for (const result of results) {
    resultMap[result.type] = result.ids;
  }

  return {
    searchVenueIds: resultMap["search"] || [],
    moodVenueIds: resultMap["mood"] || [],
    vibesVenueIds: resultMap["vibes"] || [],
    neighborhoodVenueIds: resultMap["neighborhoods"] || [],
    cityVenueIds: resultMap["city"] || [],
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

export async function getFilteredEventsWithSearch(
  filters: SearchFilters,
  page = 1,
  pageSize = 20
): Promise<{ events: EventWithLocation[]; total: number }> {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const currentTime = now.toTimeString().split(" ")[0]; // HH:MM:SS format
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("events")
    .select(
      `
      *,
      venue:venues(id, name, slug, address, neighborhood, city, state, lat, lng, typical_price_min, typical_price_max, spot_type),
      category_data:categories(typical_price_min, typical_price_max),
      series:series(id, slug, title, series_type, image_url)
    `,
      { count: "exact" }
    )
    .gte("start_date", today)
    // Hide past events for today:
    // - Show if future date
    // - Show if end_time exists and hasn't passed yet
    // - Show if end_time is null but start_time hasn't passed yet
    // - Show all-day events
    .or(`start_date.gt.${today},end_time.gte.${currentTime},and(end_time.is.null,start_time.gte.${currentTime}),is_all_day.eq.true`)
    .is("canonical_event_id", null); // Only show canonical events, not duplicates

  // Apply portal restriction filter
  // If portal_exclusive is true, only show events for this portal (business portals)
  // If portal_id is set but not exclusive, show events for that portal OR public events
  // If portal_id is not set, only show public events (hide portal-restricted events)
  if (filters.portal_id) {
    if (filters.portal_exclusive) {
      // Business portals: only show their own events
      query = query.eq("portal_id", filters.portal_id);
    } else {
      // City portals: show portal events + public events
      query = query.or(`portal_id.eq.${filters.portal_id},portal_id.is.null`);
    }
  } else {
    query = query.is("portal_id", null);
  }

  // Apply federation source filtering
  // If use_federation is true and portal_id is set, filter by accessible sources
  // If source_ids is explicitly provided, use that instead
  if (filters.source_ids && filters.source_ids.length > 0) {
    query = query.in("source_id", filters.source_ids);
  } else if (filters.use_federation && filters.portal_id) {
    const { sourceIds } = await getAccessibleSourceIds(filters.portal_id);
    if (sourceIds.length > 0) {
      query = query.in("source_id", sourceIds);
    } else {
      // No accessible sources - return empty results
      return { events: [], total: 0 };
    }
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
      return { events: [], total: 0 };
    }
  }

  // Apply category filter (using category_id)
  if (filters.categories && filters.categories.length > 0) {
    query = query.in("category_id", filters.categories);
  }

  // Apply subcategory filter
  if (filters.subcategories && filters.subcategories.length > 0) {
    query = query.in("subcategory_id", filters.subcategories);
  }

  // Apply tag filter (events with ANY of the selected tags)
  if (filters.tags && filters.tags.length > 0) {
    query = query.overlaps("tags", filters.tags);
  }

  // Apply vibes filter (venue attribute) - uses pre-fetched IDs
  if (filters.vibes && filters.vibes.length > 0) {
    if (vibesVenueIds.length > 0) {
      query = query.in("venue_id", vibesVenueIds);
    } else {
      return { events: [], total: 0 };
    }
  }

  // Apply neighborhoods filter - uses pre-fetched IDs
  if (filters.neighborhoods && filters.neighborhoods.length > 0) {
    if (neighborhoodVenueIds.length > 0) {
      query = query.in("venue_id", neighborhoodVenueIds);
    } else {
      return { events: [], total: 0 };
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

  // Apply date filter
  if (filters.date_filter) {
    const { start, end } = getDateRange(filters.date_filter);
    query = query.gte("start_date", start).lte("start_date", end);

    // For "now" filter, also require is_live to be true
    if (filters.date_filter === "now") {
      query = query.eq("is_live", true);
    }
  }

  // Apply venue filter
  if (filters.venue_id) {
    query = query.eq("venue_id", filters.venue_id);
  }

  // Apply multiple venues filter (portal filter)
  if (filters.venue_ids && filters.venue_ids.length > 0) {
    query = query.in("venue_id", filters.venue_ids);
  }

  // Apply exclude categories filter (portal filter)
  if (filters.exclude_categories && filters.exclude_categories.length > 0) {
    // Supabase doesn't have a direct "not in" for text, so we use not.in
    for (const cat of filters.exclude_categories) {
      query = query.neq("category_id", cat);
    }
  }

  // Apply date range filter (portal filter) - overrides date_filter if set
  if (filters.date_range_start) {
    query = query.gte("start_date", filters.date_range_start);
  }
  if (filters.date_range_end) {
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
      return { events: [], total: 0 };
    }
  }

  // Order and paginate
  query = query
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true })
    .range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching filtered events:", error);
    return { events: [], total: 0 };
  }

  let events = data as EventWithLocation[];

  // Compute is_live for each event based on current time
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  events = events.map((event) => {
    // Skip if already marked live by database
    if (event.is_live) return event;

    // Only today's events can be live
    if (event.start_date !== today) return event;

    // All-day events are live all day
    if (event.is_all_day) {
      return { ...event, is_live: true };
    }

    // Need start_time to determine if live
    if (!event.start_time) return event;

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
    const isLive = currentMinutes >= startMinutes && currentMinutes <= endMinutes;

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
  const today = now.toISOString().split("T")[0];
  const currentTime = now.toTimeString().split(" ")[0]; // HH:MM:SS format

  // Decode cursor if provided
  let cursorData: CursorData | null = null;
  if (cursor) {
    cursorData = decodeCursor(cursor);
    if (!cursorData) {
      // Invalid cursor - start from beginning
      console.warn("Invalid cursor provided, starting from beginning");
    }
  }

  let query = supabase
    .from("events")
    .select(
      `
      *,
      venue:venues(id, name, slug, address, neighborhood, city, state, lat, lng, typical_price_min, typical_price_max, spot_type),
      category_data:categories(typical_price_min, typical_price_max),
      series:series(id, slug, title, series_type, image_url)
    `
    )
    .gte("start_date", today)
    // Hide past events for today
    .or(`start_date.gt.${today},end_time.gte.${currentTime},and(end_time.is.null,start_time.gte.${currentTime}),is_all_day.eq.true`)
    .is("canonical_event_id", null); // Only show canonical events, not duplicates

  // Apply portal restriction filter
  if (filters.portal_id) {
    if (filters.portal_exclusive) {
      query = query.eq("portal_id", filters.portal_id);
    } else {
      query = query.or(`portal_id.eq.${filters.portal_id},portal_id.is.null`);
    }
  } else {
    query = query.is("portal_id", null);
  }

  // Apply federation source filtering
  if (filters.source_ids && filters.source_ids.length > 0) {
    query = query.in("source_id", filters.source_ids);
  } else if (filters.use_federation && filters.portal_id) {
    const { sourceIds } = await getAccessibleSourceIds(filters.portal_id);
    if (sourceIds.length > 0) {
      query = query.in("source_id", sourceIds);
    } else {
      return { events: [], nextCursor: null, hasMore: false };
    }
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

  // Apply search filter
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

  // Apply mood filter
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
      return { events: [], nextCursor: null, hasMore: false };
    }
  }

  // Apply category filter
  if (filters.categories && filters.categories.length > 0) {
    query = query.in("category_id", filters.categories);
  }

  // Apply subcategory filter
  if (filters.subcategories && filters.subcategories.length > 0) {
    query = query.in("subcategory_id", filters.subcategories);
  }

  // Apply tag filter
  if (filters.tags && filters.tags.length > 0) {
    query = query.overlaps("tags", filters.tags);
  }

  // Apply vibes filter
  if (filters.vibes && filters.vibes.length > 0) {
    if (vibesVenueIds.length > 0) {
      query = query.in("venue_id", vibesVenueIds);
    } else {
      return { events: [], nextCursor: null, hasMore: false };
    }
  }

  // Apply neighborhoods filter
  if (filters.neighborhoods && filters.neighborhoods.length > 0) {
    if (neighborhoodVenueIds.length > 0) {
      query = query.in("venue_id", neighborhoodVenueIds);
    } else {
      return { events: [], nextCursor: null, hasMore: false };
    }
  }

  // Apply city filter
  if (filters.city && cityVenueIds.length > 0) {
    query = query.in("venue_id", cityVenueIds);
  }

  // Apply price filters
  if (filters.is_free) {
    query = query.eq("is_free", true);
  } else if (filters.price_max) {
    query = query.or(`is_free.eq.true,price_min.lte.${filters.price_max}`);
  }

  // Apply date filter
  if (filters.date_filter) {
    const { start, end } = getDateRange(filters.date_filter);
    query = query.gte("start_date", start).lte("start_date", end);

    if (filters.date_filter === "now") {
      query = query.eq("is_live", true);
    }
  }

  // Apply venue filter
  if (filters.venue_id) {
    query = query.eq("venue_id", filters.venue_id);
  }

  // Apply multiple venues filter (portal filter)
  if (filters.venue_ids && filters.venue_ids.length > 0) {
    query = query.in("venue_id", filters.venue_ids);
  }

  // Apply exclude categories filter
  if (filters.exclude_categories && filters.exclude_categories.length > 0) {
    for (const cat of filters.exclude_categories) {
      query = query.neq("category_id", cat);
    }
  }

  // Apply date range filter
  if (filters.date_range_start) {
    query = query.gte("start_date", filters.date_range_start);
  }
  if (filters.date_range_end) {
    query = query.lte("start_date", filters.date_range_end);
  }

  // Apply geo filter
  if (filters.geo_center && filters.geo_radius_km) {
    const [lat, lng] = filters.geo_center;
    const radiusKm = filters.geo_radius_km;
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
      return { events: [], nextCursor: null, hasMore: false };
    }
  }

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
    console.error("Error fetching filtered events with cursor:", error);
    return { events: [], nextCursor: null, hasMore: false };
  }

  let events = data as EventWithLocation[];

  // Check if there are more results
  const hasMore = events.length > pageSize;
  if (hasMore) {
    events = events.slice(0, pageSize); // Remove the extra item
  }

  // Compute is_live for each event
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  events = events.map((event) => {
    if (event.is_live) return event;
    if (event.start_date !== today) return event;
    if (event.is_all_day) return { ...event, is_live: true };
    if (!event.start_time) return event;

    const [startH, startM] = event.start_time.split(":").map(Number);
    const startMinutes = startH * 60 + startM;

    let endMinutes: number;
    if (event.end_time) {
      const [endH, endM] = event.end_time.split(":").map(Number);
      endMinutes = endH * 60 + endM;
      if (endMinutes < startMinutes) endMinutes += 24 * 60;
    } else {
      endMinutes = startMinutes + 180;
    }

    const isLive = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
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
  const today = new Date().toISOString().split("T")[0];

  // PERFORMANCE OPTIMIZATION: Batch all venue ID lookups in parallel
  // instead of making 3 sequential queries
  const {
    searchVenueIds,
    vibesVenueIds,
    neighborhoodVenueIds,
  } = await batchFetchVenueIds({
    searchTerm: filters.search?.trim() || undefined,
    vibes: filters.vibes,
    neighborhoods: filters.neighborhoods,
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
      category,
      category_id,
      is_free,
      is_live,
      venue:venues!inner(id, name, slug, address, neighborhood, city, state, lat, lng, spot_type)
    `
    )
    .gte("start_date", today)
    .not("venues.lat", "is", null)
    .not("venues.lng", "is", null)
    .is("canonical_event_id", null); // Only show canonical events, not duplicates

  // Apply portal restriction filter
  if (filters.portal_id) {
    if (filters.portal_exclusive) {
      query = query.eq("portal_id", filters.portal_id);
    } else {
      query = query.or(`portal_id.eq.${filters.portal_id},portal_id.is.null`);
    }
  } else {
    query = query.is("portal_id", null);
  }

  // Apply federation source filtering
  if (filters.source_ids && filters.source_ids.length > 0) {
    query = query.in("source_id", filters.source_ids);
  } else if (filters.use_federation && filters.portal_id) {
    const { sourceIds } = await getAccessibleSourceIds(filters.portal_id);
    if (sourceIds.length > 0) {
      query = query.in("source_id", sourceIds);
    } else {
      return [];
    }
  }

  // Apply search filter (includes venue name search) - using batched venue IDs
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

  if (filters.categories && filters.categories.length > 0) {
    query = query.in("category_id", filters.categories);
  }

  if (filters.subcategories && filters.subcategories.length > 0) {
    query = query.in("subcategory_id", filters.subcategories);
  }

  if (filters.tags && filters.tags.length > 0) {
    query = query.overlaps("tags", filters.tags);
  }

  // Apply vibes filter - using batched venue IDs
  if (filters.vibes && filters.vibes.length > 0 && vibesVenueIds.length > 0) {
    query = query.in("venue_id", vibesVenueIds);
  }

  // Apply neighborhoods filter - using batched venue IDs
  if (filters.neighborhoods && filters.neighborhoods.length > 0 && neighborhoodVenueIds.length > 0) {
    query = query.in("venue_id", neighborhoodVenueIds);
  }

  if (filters.is_free) {
    query = query.eq("is_free", true);
  } else if (filters.price_max) {
    query = query.or(`is_free.eq.true,price_min.lte.${filters.price_max}`);
  }

  if (filters.date_filter) {
    const { start, end } = getDateRange(filters.date_filter);
    query = query.gte("start_date", start).lte("start_date", end);

    // For "now" filter, also require is_live to be true
    if (filters.date_filter === "now") {
      query = query.eq("is_live", true);
    }
  }

  if (filters.venue_id) {
    query = query.eq("venue_id", filters.venue_id);
  }

  query = query.order("start_date", { ascending: true }).limit(limit);

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching events for map:", error);
    return [];
  }

  // Compute is_live for each event based on current time
  const now = new Date();
  const currentDate = now.toISOString().split("T")[0];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const events = (data as EventWithLocation[]).map((event) => {
    if (event.is_live) return event;
    if (event.start_date !== currentDate) return event;
    if (event.is_all_day) return { ...event, is_live: true };
    if (!event.start_time) return event;

    const [startH, startM] = event.start_time.split(":").map(Number);
    const startMinutes = startH * 60 + startM;

    let endMinutes: number;
    if (event.end_time) {
      const [endH, endM] = event.end_time.split(":").map(Number);
      endMinutes = endH * 60 + endM;
      if (endMinutes < startMinutes) endMinutes += 24 * 60;
    } else {
      endMinutes = startMinutes + 180;
    }

    const isLive = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
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
    console.error("Error fetching categories:", error);
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
    console.error("Error fetching subcategories:", error);
    return [];
  }

  return data as Subcategory[];
}

// Static categories for initial render (matches database)
export const CATEGORIES = [
  { value: "music", label: "Music" },
  { value: "film", label: "Film" },
  { value: "comedy", label: "Comedy" },
  { value: "theater", label: "Theater" },
  { value: "art", label: "Art" },
  { value: "sports", label: "Sports" },
  { value: "food_drink", label: "Food & Drink" },
  { value: "nightlife", label: "Nightlife" },
  { value: "community", label: "Community" },
  { value: "fitness", label: "Fitness" },
  { value: "family", label: "Family" },
  { value: "learning", label: "Learning" },
  { value: "dance", label: "Dance" },
  { value: "tours", label: "Tours" },
  { value: "meetup", label: "Meetup" },
  { value: "words", label: "Words" },
  { value: "religious", label: "Religious" },
  { value: "markets", label: "Markets" },
  { value: "wellness", label: "Wellness" },
  { value: "gaming", label: "Gaming" },
  { value: "outdoors", label: "Outdoors" },
  { value: "other", label: "Other" },
] as const;

// Subcategories grouped by category for UI dropdowns
export const SUBCATEGORIES: Record<string, { value: string; label: string }[]> = {
  music: [
    { value: "music.live", label: "Live Music" },
    { value: "music.live.rock", label: "Rock / Indie" },
    { value: "music.live.hiphop", label: "Hip-Hop / R&B" },
    { value: "music.live.electronic", label: "Electronic / DJ" },
    { value: "music.live.jazz", label: "Jazz / Blues" },
    { value: "music.live.country", label: "Country / Folk" },
    { value: "music.live.metal", label: "Metal / Punk" },
    { value: "music.classical", label: "Classical" },
    { value: "music.openmic", label: "Open Mic" },
  ],
  film: [
    { value: "film.new", label: "New Release" },
    { value: "film.repertory", label: "Repertory" },
    { value: "film.documentary", label: "Documentary" },
    { value: "film.festival", label: "Film Festival" },
  ],
  comedy: [
    { value: "comedy.standup", label: "Stand-Up" },
    { value: "comedy.improv", label: "Improv" },
    { value: "comedy.openmic", label: "Open Mic" },
  ],
  theater: [
    { value: "theater.play", label: "Play" },
    { value: "theater.musical", label: "Musical" },
    { value: "theater.dance", label: "Dance / Ballet" },
    { value: "theater.opera", label: "Opera" },
  ],
  community: [
    { value: "community.volunteer", label: "Volunteer" },
    { value: "community.meetup", label: "Meetup" },
    { value: "community.networking", label: "Networking" },
    { value: "community.lgbtq", label: "LGBTQ+" },
  ],
  nightlife: [
    { value: "nightlife.dj", label: "DJ Night" },
    { value: "nightlife.drag", label: "Drag / Cabaret" },
    { value: "nightlife.trivia", label: "Trivia" },
  ],
  meetup: [
    { value: "meetup.tech", label: "Tech & Science" },
    { value: "meetup.professional", label: "Professional" },
    { value: "meetup.social", label: "Social" },
    { value: "meetup.hobbies", label: "Hobbies" },
    { value: "meetup.outdoors", label: "Outdoors" },
    { value: "meetup.learning", label: "Learning" },
    { value: "meetup.health", label: "Health & Wellness" },
    { value: "meetup.creative", label: "Arts & Creative" },
    { value: "meetup.sports", label: "Sports & Fitness" },
    { value: "meetup.food", label: "Food & Drink" },
    { value: "meetup.parents", label: "Parents & Family" },
    { value: "meetup.lgbtq", label: "LGBTQ+" },
  ],
  words: [
    { value: "words.reading", label: "Reading / Signing" },
    { value: "words.bookclub", label: "Book Club" },
    { value: "words.poetry", label: "Poetry" },
    { value: "words.storytelling", label: "Storytelling" },
    { value: "words.workshop", label: "Writing Workshop" },
    { value: "words.lecture", label: "Author Talk" },
  ],
};

export const DATE_FILTERS = [
  { value: "now", label: "Live" },
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "weekend", label: "The weekend" },
  { value: "week", label: "This Week" },
] as const;

export const PRICE_FILTERS = [
  { value: "free", label: "Free", max: null },
  { value: "under25", label: "Under $25", max: 25 },
  { value: "under50", label: "Under $50", max: 50 },
  { value: "under100", label: "Under $100", max: 100 },
] as const;

// Event tags for filtering
export const TAG_GROUPS = {
  Vibe: [
    { value: "date-night", label: "Date Night" },
    { value: "chill", label: "Chill" },
    { value: "high-energy", label: "High Energy" },
    { value: "intimate", label: "Intimate" },
  ],
  Access: [
    { value: "free", label: "Free" },
    { value: "all-ages", label: "All Ages" },
    { value: "21+", label: "21+" },
    { value: "family-friendly", label: "Family" },
    { value: "accessible", label: "Accessible" },
    { value: "outdoor", label: "Outdoor" },
  ],
  Special: [
    { value: "local-artist", label: "Local Artist" },
    { value: "touring", label: "Touring" },
    { value: "album-release", label: "Album Release" },
    { value: "one-night-only", label: "One Night Only" },
    { value: "opening-night", label: "Opening Night" },
    { value: "holiday", label: "Holiday" },
  ],
} as const;

// Flat array of all tags
export const ALL_TAGS = [
  ...TAG_GROUPS.Vibe,
  ...TAG_GROUPS.Access,
  ...TAG_GROUPS.Special,
] as const;

export interface VenueWithCount {
  id: number;
  name: string;
  neighborhood: string | null;
  event_count: number;
}

// Get venues that have upcoming events
export async function getVenuesWithEvents(): Promise<VenueWithCount[]> {
  const today = new Date().toISOString().split("T")[0];

  const { data: events, error } = await supabase
    .from("events")
    .select("venue_id, venue:venues(id, name, neighborhood)")
    .gte("start_date", today)
    .not("venue_id", "is", null);

  if (error || !events) {
    console.error("Error fetching venues with events:", error);
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

export async function getSearchSuggestions(prefix: string): Promise<SearchSuggestion[]> {
  if (prefix.length < 2) return [];

  const searchTerm = `${prefix}%`;
  const today = new Date().toISOString().split("T")[0];

  const [venueResult, eventResult, neighborhoodResult, producerResult] = await Promise.all([
    supabase.from("venues").select("name").ilike("name", searchTerm).limit(3),
    supabase
      .from("events")
      .select("title")
      .ilike("title", searchTerm)
      .gte("start_date", today)
      .limit(3),
    supabase
      .from("venues")
      .select("neighborhood")
      .ilike("neighborhood", searchTerm)
      .not("neighborhood", "is", null)
      .limit(3),
    supabase
      .from("event_producers")
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
  sourceRollups: {
    sourceId: number;
    sourceName: string;
    count: number;
  }[];
}

// Get rollup statistics for a date range
async function getRollupStats(
  dateStart: string,
  dateEnd: string,
  categoryId?: string,
  portalId?: string
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

  // Apply portal restriction filter
  if (portalId) {
    query = query.or(`portal_id.eq.${portalId},portal_id.is.null`);
  } else {
    query = query.is("portal_id", null);
  }

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return { venueRollups: [], sourceRollups: [] };
  }

  // Count events by venue for 'venue' rollup behavior
  const venueCounts = new Map<
    number,
    { venueId: number; venueName: string; venueSlug: string; count: number }
  >();

  // Count events by source for 'collapse' rollup behavior
  const sourceCounts = new Map<
    number,
    { sourceId: number; sourceName: string; count: number }
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

    if (rollupBehavior === "collapse" && source) {
      const existing = sourceCounts.get(source.id);
      if (existing) {
        existing.count++;
      } else {
        sourceCounts.set(source.id, {
          sourceId: source.id,
          sourceName: source.name,
          count: 1,
        });
      }
    }
  }

  // Filter to only those exceeding thresholds
  const venueRollups = Array.from(venueCounts.values()).filter((v) => v.count > 3);
  const sourceRollups = Array.from(sourceCounts.values()).filter((s) => s.count > 5);

  return { venueRollups, sourceRollups };
}

// Get events with rollup support
export async function getFilteredEventsWithRollups(
  filters: SearchFilters,
  page = 1,
  pageSize = 20
): Promise<{ items: EventOrGroup[]; total: number }> {
  const today = new Date().toISOString().split("T")[0];

  // Get date range for rollup calculation
  const dateRange = filters.date_filter
    ? getDateRange(filters.date_filter)
    : { start: today, end: format(addDays(new Date(), 365), "yyyy-MM-dd") };

  // Get rollup stats
  const rollupStats = await getRollupStats(
    dateRange.start,
    dateRange.end,
    filters.categories?.[0],
    filters.portal_id
  );

  const venueIdsToExclude = rollupStats.venueRollups.map((v) => v.venueId);
  // Note: sourceIdsToExclude would be used for source-based rollups if implemented
  void rollupStats.sourceRollups; // Acknowledge unused for now

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
        venue:venues(id, name, slug, address, neighborhood, city, state, lat, lng, typical_price_min, typical_price_max, spot_type)
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

  for (const sr of rollupStats.sourceRollups) {
    // Get preview events for this source
    const { data: previewData } = await supabase
      .from("events")
      .select(
        `
        *,
        venue:venues(id, name, slug, address, neighborhood, city, state, lat, lng, typical_price_min, typical_price_max, spot_type)
      `
      )
      .eq("source_id", sr.sourceId)
      .gte("start_date", dateRange.start)
      .lte("start_date", dateRange.end)
      .order("start_date")
      .order("start_time")
      .limit(3);

    groups.push({
      type: "source",
      id: `source-${sr.sourceId}`,
      title: sr.sourceName,
      subtitle: `${sr.count} opportunities`,
      previewEvents: (previewData || []) as EventWithLocation[],
      totalCount: sr.count,
      expandUrl: `/events?source=${sr.sourceId}`,
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

  // Initialize all events with 0 counts
  eventIds.forEach((id) => {
    counts.set(id, { going: 0, interested: 0, recommendations: 0 });
  });

  // Use service client to bypass RLS for aggregation queries
  // This is server-side only and safe for reading public social data
  let serviceClient;
  try {
    serviceClient = createServiceClient();
  } catch {
    // Service key not available (e.g., during build), return empty counts
    return counts;
  }

  // Fetch RSVP counts grouped by event and status
  // Only count public RSVPs for social proof
  const { data: rsvpData } = await serviceClient
    .from("event_rsvps")
    .select("event_id, status")
    .in("event_id", eventIds)
    .in("status", ["going", "interested"])
    .eq("visibility", "public");

  if (rsvpData) {
    for (const rsvp of rsvpData as { event_id: number; status: string }[]) {
      const current = counts.get(rsvp.event_id);
      if (current) {
        if (rsvp.status === "going") {
          current.going++;
        } else if (rsvp.status === "interested") {
          current.interested++;
        }
      }
    }
  }

  // Fetch recommendation counts (only public ones)
  const { data: recData } = await serviceClient
    .from("recommendations")
    .select("event_id")
    .in("event_id", eventIds)
    .eq("visibility", "public")
    .not("event_id", "is", null);

  if (recData) {
    for (const rec of recData as { event_id: number | null }[]) {
      if (rec.event_id) {
        const current = counts.get(rec.event_id);
        if (current) {
          current.recommendations++;
        }
      }
    }
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
    console.error("Error fetching available filters:", error);
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

// Get popular events this week based on RSVPs and recommendations
export async function getPopularEvents(limit = 6): Promise<EventWithLocation[]> {
  const today = new Date().toISOString().split("T")[0];
  const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  // Get upcoming events this week (use imported supabase client)
  const { data: events } = await supabase
    .from("events")
    .select(`
      *,
      venue:venues(*),
      source:sources(name, url)
    `)
    .gte("start_date", today)
    .lte("start_date", weekFromNow)
    .eq("is_active", true)
    .order("start_date", { ascending: true })
    .limit(100);

  if (!events || events.length === 0) {
    return [];
  }

  // Get social proof counts for all these events
  const enrichedEvents = await enrichEventsWithSocialProof(events as EventWithLocation[]);

  // Calculate popularity score and sort
  const scoredEvents = enrichedEvents.map((event) => {
    const goingCount = event.going_count || 0;
    const interestedCount = event.interested_count || 0;
    const recCount = event.recommendation_count || 0;
    // Weight: going=3, interested=2, recommendations=2
    const score = goingCount * 3 + interestedCount * 2 + recCount * 2;
    return { event, score };
  });

  // Sort by score descending, filter to only events with engagement
  const popularEvents = scoredEvents
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((e) => e.event);

  return popularEvents;
}

/**
 * Get trending events - events with recent engagement velocity
 * Different from popular: focuses on *recent* activity, not total counts
 * Factors: RSVPs in last 48h, recommendations in last 48h, proximity to event
 */
export async function getTrendingEvents(limit = 6): Promise<EventWithLocation[]> {
  const serviceClient = createServiceClient();
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const hours48Ago = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  // Get upcoming events this week
  const { data: events } = await serviceClient
    .from("events")
    .select(`
      *,
      venue:venues(*),
      source:sources(name, url)
    `)
    .gte("start_date", today)
    .lte("start_date", weekFromNow)
    .eq("is_active", true)
    .order("start_date", { ascending: true })
    .limit(200);

  if (!events || events.length === 0) {
    return [];
  }

  // Cast to expected type
  const typedEvents = events as unknown as EventWithLocation[];
  const eventIds = typedEvents.map((e) => e.id);

  // Get recent RSVPs (last 48 hours) - this shows momentum
  const { data: recentRsvpsData } = await serviceClient
    .from("event_rsvps")
    .select("event_id, status, created_at")
    .in("event_id", eventIds)
    .eq("visibility", "public")
    .gte("created_at", hours48Ago);

  // Get recent recommendations (last 48 hours)
  const { data: recentRecsData } = await serviceClient
    .from("recommendations")
    .select("event_id, created_at")
    .in("event_id", eventIds)
    .eq("visibility", "public")
    .gte("created_at", hours48Ago);

  // Cast to expected types
  const recentRsvps = (recentRsvpsData || []) as { event_id: number; status: string; created_at: string }[];
  const recentRecs = (recentRecsData || []) as { event_id: number; created_at: string }[];

  // Count recent activity per event
  const recentActivity = new Map<number, { rsvps: number; recs: number; goingRecent: number }>();

  for (const rsvp of recentRsvps) {
    const current = recentActivity.get(rsvp.event_id) || { rsvps: 0, recs: 0, goingRecent: 0 };
    current.rsvps++;
    if (rsvp.status === "going") current.goingRecent++;
    recentActivity.set(rsvp.event_id, current);
  }

  for (const rec of recentRecs) {
    if (rec.event_id) {
      const current = recentActivity.get(rec.event_id) || { rsvps: 0, recs: 0, goingRecent: 0 };
      current.recs++;
      recentActivity.set(rec.event_id, current);
    }
  }

  // Also get total social proof for context
  const enrichedEvents = await enrichEventsWithSocialProof(typedEvents);

  // Calculate trending score
  // Trending = recent velocity + bonus for events happening soon
  const scoredEvents = enrichedEvents.map((event) => {
    const recent = recentActivity.get(event.id) || { rsvps: 0, recs: 0, goingRecent: 0 };
    const totalGoing = event.going_count || 0;

    // Recent activity score (weighted heavily)
    const recentScore = recent.goingRecent * 5 + recent.rsvps * 3 + recent.recs * 4;

    // Proximity bonus: events happening sooner get a boost
    const eventDate = new Date(event.start_date);
    const daysUntil = Math.max(0, (eventDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    const proximityMultiplier = daysUntil <= 1 ? 1.5 : daysUntil <= 3 ? 1.2 : 1.0;

    // Require some baseline engagement to be "trending"
    const hasBaseline = totalGoing >= 3 || recentScore >= 5;

    const trendingScore = hasBaseline ? recentScore * proximityMultiplier : 0;

    return { event: { ...event, is_trending: trendingScore > 0 }, score: trendingScore };
  });

  // Sort by trending score, filter to only events with recent activity
  const trendingEvents = scoredEvents
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((e) => e.event);

  return trendingEvents;
}
