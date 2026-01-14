import { supabase, type Event } from "./supabase";
import {
  startOfDay,
  addDays,
  nextSaturday,
  nextSunday,
  isSaturday,
  isSunday,
  format,
} from "date-fns";

export interface SearchFilters {
  search?: string;
  categories?: string[];
  subcategories?: string[];
  is_free?: boolean;
  price_max?: number;
  date_filter?: "today" | "weekend" | "week";
  venue_id?: number;
}

export type EventWithLocation = Event & {
  venue: Event["venue"] & {
    lat: number | null;
    lng: number | null;
    typical_price_min: number | null;
    typical_price_max: number | null;
  } | null;
  category_data: {
    typical_price_min: number | null;
    typical_price_max: number | null;
  } | null;
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

  let query = supabase
    .from("events")
    .select(
      `
      *,
      venue:venues(id, name, slug, address, neighborhood, city, state, lat, lng, typical_price_min, typical_price_max),
      category_data:categories(typical_price_min, typical_price_max)
    `,
      { count: "exact" }
    )
    .gte("start_date", today);

  // Apply search filter
  if (filters.search && filters.search.trim()) {
    const searchTerm = `%${filters.search.trim()}%`;
    query = query.or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`);
  }

  // Apply category filter (using category_id)
  if (filters.categories && filters.categories.length > 0) {
    query = query.in("category_id", filters.categories);
  }

  // Apply subcategory filter
  if (filters.subcategories && filters.subcategories.length > 0) {
    query = query.in("subcategory_id", filters.subcategories);
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

// Get all events for map view
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
      category_id,
      is_free,
      venue:venues!inner(id, name, slug, address, neighborhood, city, state, lat, lng)
    `
    )
    .gte("start_date", today)
    .not("venues.lat", "is", null)
    .not("venues.lng", "is", null);

  if (filters.search && filters.search.trim()) {
    const searchTerm = `%${filters.search.trim()}%`;
    query = query.or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`);
  }

  if (filters.categories && filters.categories.length > 0) {
    query = query.in("category_id", filters.categories);
  }

  if (filters.subcategories && filters.subcategories.length > 0) {
    query = query.in("subcategory_id", filters.subcategories);
  }

  if (filters.is_free) {
    query = query.eq("is_free", true);
  } else if (filters.price_max) {
    query = query.or(`is_free.eq.true,price_min.lte.${filters.price_max}`);
  }

  if (filters.date_filter) {
    const { start, end } = getDateRange(filters.date_filter);
    query = query.gte("start_date", start).lte("start_date", end);
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

  return data as EventWithLocation[];
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
};

export const DATE_FILTERS = [
  { value: "today", label: "Today" },
  { value: "weekend", label: "This Weekend" },
  { value: "week", label: "This Week" },
] as const;

export const PRICE_FILTERS = [
  { value: "free", label: "Free", max: null },
  { value: "under25", label: "Under $25", max: 25 },
  { value: "under50", label: "Under $50", max: 50 },
  { value: "under100", label: "Under $100", max: 100 },
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
