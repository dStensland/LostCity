import { createClient } from "@/lib/supabase/server";

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
    .single();

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
    const today = new Date().toISOString().split("T")[0];
    query = query.gte("start_date", today);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data.map((event: any) => ({
    id: event.id,
    title: event.title,
    start_date: event.start_date,
    start_time: event.start_time,
    end_time: event.end_time,
    venue: event.venues,
    source_url: event.source_url,
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
  const today = new Date().toISOString().split("T")[0];
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

// Helper to get series type label
export function getSeriesTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    film: "Film",
    recurring_show: "Recurring Show",
    class_series: "Class Series",
    festival_program: "Festival Program",
    tour: "Tour",
    other: "Series",
  };
  return labels[type] || "Series";
}

// Helper to get series type color
export function getSeriesTypeColor(type: string): string {
  const colors: Record<string, string> = {
    film: "#A5B4FC", // indigo
    recurring_show: "#F9A8D4", // pink
    class_series: "#6EE7B7", // green
    festival_program: "#FBBF24", // amber
    tour: "#C4B5FD", // purple
    other: "#94A3B8", // slate
  };
  return colors[type] || "#94A3B8";
}

// Helper to format genre for display
export function formatGenre(genre: string): string {
  // Handle special cases
  const special: Record<string, string> = {
    "sci-fi": "Sci-Fi",
    "r&b": "R&B",
    "hip-hop": "Hip-Hop",
    "edm": "EDM",
    "mma": "MMA",
  };
  if (special[genre]) return special[genre];

  // Capitalize first letter of each word
  return genre
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("-");
}
