import { supabase, Event } from "./supabase";
import type { PortalFilters } from "./portal-context";
import { getLocalDateString } from "@/lib/formats";

export interface PaginatedResult {
  events: Event[];
  total: number;
}

/**
 * Get events filtered by portal configuration.
 * Supports pagination, city filtering (via venue), categories, date ranges, and more.
 */
export async function getFilteredEvents(
  filters: PortalFilters,
  page = 1,
  pageSize = 20
): Promise<PaginatedResult> {
  const today = getLocalDateString();
  const offset = (page - 1) * pageSize;

  // Build the query
  let query = supabase
    .from("events")
    .select(
      `
      *,
      venue:venues!inner(id, name, slug, address, neighborhood, city, state)
    `,
      { count: "exact" }
    )
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true });

  // Apply city filter (via venue join)
  if (filters.city) {
    query = query.ilike("venue.city", filters.city);
  }

  // Apply date range filter
  if (filters.date_range) {
    query = query
      .gte("start_date", filters.date_range[0])
      .lte("start_date", filters.date_range[1]);
  }

  // Apply category filter
  if (filters.categories && filters.categories.length > 0) {
    query = query.in("category", filters.categories);
  }

  // Apply category exclusion
  if (filters.exclude_categories && filters.exclude_categories.length > 0) {
    for (const cat of filters.exclude_categories) {
      query = query.neq("category", cat);
    }
  }

  // Apply venue filter
  if (filters.venue_ids && filters.venue_ids.length > 0) {
    query = query.in("venue_id", filters.venue_ids);
  }

  // Apply price filter
  if (filters.price_max !== undefined) {
    query = query.or(
      `price_min.is.null,price_min.lte.${filters.price_max}`
    );
  }

  // Apply pagination
  query = query.range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching filtered events:", error);
    return { events: [], total: 0 };
  }

  let events = (data as Event[]) || [];

  // Application-level geo filtering if needed
  if (filters.geo_center && filters.geo_radius_km) {
    events = events.filter((event) => {
      const venue = event.venue as { lat?: number; lng?: number } | null;
      if (!venue?.lat || !venue?.lng) return true; // Include if no geo
      const distance = haversineDistance(
        filters.geo_center![0],
        filters.geo_center![1],
        venue.lat,
        venue.lng
      );
      return distance <= filters.geo_radius_km!;
    });
  }

  return { events, total: count ?? 0 };
}

/**
 * Get all events for a portal (no pagination, for smaller result sets)
 */
export async function getAllFilteredEvents(
  filters: PortalFilters,
  limit = 200
): Promise<Event[]> {
  const today = getLocalDateString();

  let query = supabase
    .from("events")
    .select(
      `
      *,
      venue:venues(id, name, slug, address, neighborhood, city, state)
    `
    )
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true })
    .limit(limit);

  // Apply city filter - need to handle the join differently for non-inner join
  // For optional venue, we filter in app
  if (filters.city) {
    // Use inner join version
    query = supabase
      .from("events")
      .select(
        `
        *,
        venue:venues!inner(id, name, slug, address, neighborhood, city, state)
      `
      )
      .ilike("venue.city", filters.city)
      .gte("start_date", today)
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(limit);
  }

  // Apply date range filter
  if (filters.date_range) {
    query = query
      .gte("start_date", filters.date_range[0])
      .lte("start_date", filters.date_range[1]);
  }

  // Apply category filter
  if (filters.categories && filters.categories.length > 0) {
    query = query.in("category", filters.categories);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching events:", error);
    return [];
  }

  return (data as Event[]) || [];
}

// ============================================
// Geo utilities
// ============================================

/**
 * Haversine formula for distance calculation between two points
 * Returns distance in kilometers
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
