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
  tags?: string[];
  is_free?: boolean;
  price_max?: number;
  date_filter?: "today" | "weekend" | "week";
  venue_id?: number;
  include_rollups?: boolean;
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

  // Apply search filter (includes venue name search)
  if (filters.search && filters.search.trim()) {
    const searchTerm = `%${filters.search.trim()}%`;

    // Find matching venue IDs first (Supabase .or() doesn't work across relations)
    const { data: matchingVenues } = await supabase
      .from("venues")
      .select("id")
      .ilike("name", searchTerm);

    const venueIds = (matchingVenues as { id: number }[] | null)?.map((v) => v.id) || [];

    if (venueIds.length > 0) {
      query = query.or(
        `title.ilike.${searchTerm},description.ilike.${searchTerm},venue_id.in.(${venueIds.join(",")})`
      );
    } else {
      query = query.or(`title.ilike.${searchTerm},description.ilike.${searchTerm}`);
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

  let events = data as EventWithLocation[];

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

  // Apply search filter (includes venue name search)
  if (filters.search && filters.search.trim()) {
    const searchTerm = `%${filters.search.trim()}%`;

    const { data: matchingVenues } = await supabase
      .from("venues")
      .select("id")
      .ilike("name", searchTerm);

    const venueIds = (matchingVenues as { id: number }[] | null)?.map((v) => v.id) || [];

    if (venueIds.length > 0) {
      query = query.or(
        `title.ilike.${searchTerm},description.ilike.${searchTerm},venue_id.in.(${venueIds.join(",")})`
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
  { value: "meetup", label: "Meetup" },
  { value: "words", label: "Words" },
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
export async function getSearchSuggestions(prefix: string): Promise<string[]> {
  if (prefix.length < 2) return [];

  const searchTerm = `${prefix}%`;
  const today = new Date().toISOString().split("T")[0];

  const [venueResult, eventResult] = await Promise.all([
    supabase.from("venues").select("name").ilike("name", searchTerm).limit(3),
    supabase
      .from("events")
      .select("title")
      .ilike("title", searchTerm)
      .gte("start_date", today)
      .limit(3),
  ]);

  const suggestions = [
    ...((venueResult.data as { name: string }[] | null)?.map((v) => v.name) || []),
    ...((eventResult.data as { title: string }[] | null)?.map((e) => e.title) || []),
  ];

  // Dedupe and limit
  return [...new Set(suggestions)].slice(0, 5);
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
  categoryId?: string
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
    .lte("start_date", dateEnd);

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
    filters.categories?.[0]
  );

  const venueIdsToExclude = rollupStats.venueRollups.map((v) => v.venueId);
  const sourceIdsToExclude = rollupStats.sourceRollups.map((s) => s.sourceId);

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
        venue:venues(id, name, slug, address, neighborhood, city, state, lat, lng, typical_price_min, typical_price_max)
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
        venue:venues(id, name, slug, address, neighborhood, city, state, lat, lng, typical_price_min, typical_price_max)
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
