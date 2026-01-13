import { supabase, type Event } from "./supabase";
import {
  startOfDay,
  endOfDay,
  nextSaturday,
  nextSunday,
  addDays,
  isSaturday,
  isSunday,
  format,
} from "date-fns";

export interface SearchFilters {
  search?: string;
  categories?: string[];
  is_free?: boolean;
  date_filter?: "today" | "weekend" | "week";
  venue_id?: number;
}

export type EventWithLocation = Event & {
  venue: Event["venue"] & {
    lat: number | null;
    lng: number | null;
  } | null;
};

function getDateRange(filter: "today" | "weekend" | "week"): {
  start: string;
  end: string;
} {
  const now = new Date();
  const today = startOfDay(now);

  switch (filter) {
    case "today":
      return {
        start: format(today, "yyyy-MM-dd"),
        end: format(today, "yyyy-MM-dd"),
      };

    case "weekend": {
      // If today is Saturday or Sunday, use this weekend
      // Otherwise, get next Saturday-Sunday
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

export async function getFilteredEventsWithSearch(
  filters: SearchFilters,
  page = 1,
  pageSize = 20
): Promise<{ events: EventWithLocation[]; total: number }> {
  const today = new Date().toISOString().split("T")[0];
  const offset = (page - 1) * pageSize;

  // Build the query
  let query = supabase
    .from("events")
    .select(
      `
      *,
      venue:venues(id, name, slug, address, neighborhood, city, state, lat, lng)
    `,
      { count: "exact" }
    )
    .gte("start_date", today);

  // Apply search filter (title or description contains search term)
  if (filters.search && filters.search.trim()) {
    const searchTerm = `%${filters.search.trim()}%`;
    query = query.or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`);
  }

  // Apply category filter
  if (filters.categories && filters.categories.length > 0) {
    query = query.in("category", filters.categories);
  }

  // Apply free filter
  if (filters.is_free) {
    query = query.eq("is_free", true);
  }

  // Apply date filter
  if (filters.date_filter) {
    const { start, end } = getDateRange(filters.date_filter);
    query = query.gte("start_date", start).lte("start_date", end);
  }

  // Apply venue filter
  if (filters.venue_id) {
    query = query.eq("venue_id", filters.venue_id);
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

  return { events: data as EventWithLocation[], total: count ?? 0 };
}

// Get all events for map view (no pagination, but with location data)
export async function getEventsForMap(
  filters: SearchFilters,
  limit = 500
): Promise<EventWithLocation[]> {
  const today = new Date().toISOString().split("T")[0];

  let query = supabase
    .from("events")
    .select(
      `
      id,
      title,
      start_date,
      start_time,
      category,
      is_free,
      venue:venues!inner(id, name, slug, address, neighborhood, city, state, lat, lng)
    `
    )
    .gte("start_date", today)
    .not("venues.lat", "is", null)
    .not("venues.lng", "is", null);

  // Apply same filters as main query
  if (filters.search && filters.search.trim()) {
    const searchTerm = `%${filters.search.trim()}%`;
    query = query.or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`);
  }

  if (filters.categories && filters.categories.length > 0) {
    query = query.in("category", filters.categories);
  }

  if (filters.is_free) {
    query = query.eq("is_free", true);
  }

  if (filters.date_filter) {
    const { start, end } = getDateRange(filters.date_filter);
    query = query.gte("start_date", start).lte("start_date", end);
  }

  if (filters.venue_id) {
    query = query.eq("venue_id", filters.venue_id);
  }

  query = query
    .order("start_date", { ascending: true })
    .limit(limit);

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching events for map:", error);
    return [];
  }

  return data as EventWithLocation[];
}

// Available categories for filter UI
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
] as const;

export const DATE_FILTERS = [
  { value: "today", label: "Today" },
  { value: "weekend", label: "This Weekend" },
  { value: "week", label: "This Week" },
] as const;

export interface VenueWithCount {
  id: number;
  name: string;
  neighborhood: string | null;
  event_count: number;
}

// Get venues that have upcoming events (for filter dropdown)
export async function getVenuesWithEvents(): Promise<VenueWithCount[]> {
  const today = new Date().toISOString().split("T")[0];

  // Get all upcoming events with venue info
  const { data: events, error } = await supabase
    .from("events")
    .select("venue_id, venue:venues(id, name, neighborhood)")
    .gte("start_date", today)
    .not("venue_id", "is", null);

  if (error || !events) {
    console.error("Error fetching venues with events:", error);
    return [];
  }

  // Count events per venue
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

  // Sort by event count (descending), then by name
  return Array.from(venueMap.values()).sort((a, b) => {
    if (b.event_count !== a.event_count) return b.event_count - a.event_count;
    return a.name.localeCompare(b.name);
  });
}
