import { createClient } from "@/lib/supabase/server";
import { getLocalDateString } from "@/lib/formats";

// Type for raw event data from Supabase query
type RawSeriesEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  source_url: string | null;
  ticket_url: string | null;
  venues: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
  } | null;
};

// Re-export client-safe utilities for backward compatibility
export { getSeriesTypeLabel, getSeriesTypeColor, formatGenre } from "@/lib/series-utils";

export interface Series {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  series_type: "film" | "recurring_show" | "class_series" | "festival_program" | "tour" | "other";
  image_url: string | null;
  trailer_url: string | null;
  // Film-specific
  director: string | null;
  runtime_minutes: number | null;
  year: number | null;
  rating: string | null;
  imdb_id: string | null;
  tmdb_id: string | null;
  // Recurring show fields
  frequency: string | null;
  day_of_week: string | null;
  // Organization
  category: string | null;
  tags: string[] | null;
  genres: string[] | null;
  producer_id: string | null;
  is_active: boolean;
  created_at: string;
  // Computed
  event_count?: number;
  upcoming_events?: SeriesEvent[];
}

export interface SeriesEvent {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
  } | null;
  source_url: string;
  ticket_url: string | null;
}

export async function getSeriesBySlug(slug: string): Promise<Series | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("series")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Series;
}

export async function getSeriesEvents(
  seriesId: string,
  futureOnly = true
): Promise<SeriesEvent[]> {
  const supabase = await createClient();

  let query = supabase
    .from("events")
    .select(`
      id,
      title,
      start_date,
      start_time,
      end_time,
      source_url,
      ticket_url,
      venues (
        id,
        name,
        slug,
        neighborhood
      )
    `)
    .eq("series_id", seriesId)
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (futureOnly) {
    const today = getLocalDateString();
    query = query.gte("start_date", today);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return (data as RawSeriesEvent[]).map((event) => ({
    id: event.id,
    title: event.title,
    start_date: event.start_date,
    start_time: event.start_time,
    end_time: event.end_time,
    venue: event.venues,
    source_url: event.source_url || "",
    ticket_url: event.ticket_url,
  }));
}

export async function getSeriesWithEventCounts(
  seriesType?: string,
  category?: string,
  limit = 50
): Promise<Series[]> {
  const supabase = await createClient();

  let query = supabase
    .from("series")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (seriesType) {
    query = query.eq("series_type", seriesType);
  }

  if (category) {
    query = query.eq("category", category);
  }

  const { data: seriesData, error } = await query;

  if (error || !seriesData || seriesData.length === 0) {
    return [];
  }

  // Get event counts for each series
  const today = getLocalDateString();
  const seriesIds = (seriesData as Series[]).map((s) => s.id);

  const { data: countData } = await supabase
    .from("events")
    .select("series_id")
    .in("series_id", seriesIds)
    .gte("start_date", today);

  // Count events per series
  const counts: Record<string, number> = {};
  if (countData) {
    for (const event of countData) {
      const seriesId = (event as { series_id: string | null }).series_id;
      if (seriesId) {
        counts[seriesId] = (counts[seriesId] || 0) + 1;
      }
    }
  }

  return (seriesData as Series[]).map((series) => ({
    ...series,
    event_count: counts[series.id] || 0,
  }));
}

export async function searchSeries(query: string, limit = 10): Promise<Series[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("series")
    .select("*")
    .eq("is_active", true)
    .ilike("title", `%${query}%`)
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data as Series[];
}


// Type for venue-first grouping on series page
export interface VenueShowtimes {
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
  };
  events: {
    id: number;
    date: string;
    time: string | null;
    ticketUrl: string | null;
  }[];
}

/**
 * Group series events by venue, then by date within each venue
 * Used for the series page venue-first layout
 */
export function groupSeriesEventsByVenue(events: SeriesEvent[]): VenueShowtimes[] {
  // Group by venue
  const venueMap = new Map<number, {
    venue: VenueShowtimes["venue"];
    events: VenueShowtimes["events"];
  }>();

  for (const event of events) {
    if (!event.venue) continue;

    const venueId = event.venue.id;
    const existing = venueMap.get(venueId);

    const eventData = {
      id: event.id,
      date: event.start_date,
      time: event.start_time,
      ticketUrl: event.ticket_url,
    };

    if (existing) {
      existing.events.push(eventData);
    } else {
      venueMap.set(venueId, {
        venue: {
          id: event.venue.id,
          name: event.venue.name,
          slug: event.venue.slug,
          neighborhood: event.venue.neighborhood,
        },
        events: [eventData],
      });
    }
  }

  // Convert to array and sort
  const result: VenueShowtimes[] = [];
  for (const { venue, events: venueEvents } of venueMap.values()) {
    // Sort events by date, then by time
    venueEvents.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return (a.time || "").localeCompare(b.time || "");
    });

    result.push({ venue, events: venueEvents });
  }

  // Sort venues by total event count (descending), then by name
  result.sort((a, b) => {
    const countDiff = b.events.length - a.events.length;
    if (countDiff !== 0) return countDiff;
    return a.venue.name.localeCompare(b.venue.name);
  });

  return result;
}
