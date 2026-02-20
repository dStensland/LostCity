import { createClient } from "@/lib/supabase/server";
import { getLocalDateString } from "@/lib/formats";

// Type for raw event data from Supabase query
type RawFestivalEvent = {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  category: string | null;
  image_url: string | null;
  series_id: string | null;
  venues: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
  } | null;
};

export interface Festival {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  typical_month: number | null;
  typical_duration_days: number | null;
  location: string | null;
  neighborhood: string | null;
  categories: string[] | null;
  free: boolean;
  announced_start: string | null;
  announced_end: string | null;
  ticket_url: string | null;
  description: string | null;
  image_url: string | null;
  producer_id: string | null;
  festival_type?: string | null;
  portal_id?: string | null;
  primary_type?: string | null;
  experience_tags?: string[] | null;
  audience?: string | null;
  size_tier?: string | null;
  indoor_outdoor?: string | null;
  price_tier?: string | null;
}

export interface FestivalProgram {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  image_url: string | null;
  series_type: string;
  event_count?: number;
}

export interface FestivalSession {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  category: string | null;
  image_url: string | null;
  series_id: string | null;
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
    nearest_marta_station?: string | null;
    marta_walk_minutes?: number | null;
    marta_lines?: string[] | null;
    beltline_adjacent?: boolean | null;
    beltline_segment?: string | null;
    parking_type?: string[] | null;
    parking_free?: boolean | null;
    transit_score?: number | null;
  } | null;
}

export async function getFestivalBySlug(slug: string): Promise<Festival | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("festivals")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Festival;
}

export async function getFestivalPrograms(festivalId: string): Promise<FestivalProgram[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("series")
    .select("id, slug, title, description, image_url, series_type")
    .eq("festival_id", festivalId)
    .eq("is_active", true)
    .order("title", { ascending: true });

  if (error || !data) {
    return [];
  }

  // Get event counts for each program
  const today = getLocalDateString();
  const programIds = (data as FestivalProgram[]).map((p) => p.id);

  if (programIds.length === 0) {
    return data as FestivalProgram[];
  }

  const { data: countData } = await supabase
    .from("events")
    .select("series_id")
    .in("series_id", programIds)
    .gte("start_date", today);

  // Count events per program
  const counts: Record<string, number> = {};
  if (countData) {
    for (const event of countData) {
      const seriesId = (event as { series_id: string | null }).series_id;
      if (seriesId) {
        counts[seriesId] = (counts[seriesId] || 0) + 1;
      }
    }
  }

  return (data as FestivalProgram[]).map((program) => ({
    ...program,
    event_count: counts[program.id] || 0,
  }));
}

export async function getFestivalEvents(
  festivalId: string,
  futureOnly = true
): Promise<FestivalSession[]> {
  const supabase = await createClient();

  // First get all series linked to this festival
  const { data: seriesData, error: seriesError } = await supabase
    .from("series")
    .select("id")
    .eq("festival_id", festivalId)
    .eq("is_active", true);

  if (seriesError || !seriesData || seriesData.length === 0) {
    return [];
  }

  const seriesIds = (seriesData as { id: string }[]).map((s) => s.id);

  // Now get all events for these series
  let query = supabase
    .from("events")
    .select(`
      id,
      title,
      start_date,
      start_time,
      end_time,
      category,
      image_url,
      series_id,
      is_all_day,
      venues (
        id,
        name,
        slug,
        neighborhood,
        nearest_marta_station,
        marta_walk_minutes,
        marta_lines,
        beltline_adjacent,
        beltline_segment,
        parking_type,
        parking_free,
        transit_score
      )
    `)
    .in("series_id", seriesIds)
    // Hide TBA events (no start_time, not all-day)
    .or("start_time.not.is.null,is_all_day.eq.true")
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

  return (data as RawFestivalEvent[]).map((event) => ({
    id: event.id,
    title: event.title,
    start_date: event.start_date,
    start_time: event.start_time,
    end_time: event.end_time,
    category: event.category,
    image_url: event.image_url,
    series_id: event.series_id,
    venue: event.venues,
  }));
}

export async function getAllFestivals(portalId?: string): Promise<Festival[]> {
  const supabase = await createClient();

  let query = supabase
    .from("festivals")
    .select("*")
    // Only show festivals with confirmed dates — no TBA/unconfirmed
    .not("announced_start", "is", null)
    .order("announced_start", { ascending: true, nullsFirst: false });

  if (portalId) {
    query = query.eq("portal_id", portalId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  // Defense-in-depth: filter out bad data at query time
  const currentYear = new Date().getFullYear();

  return (data as Festival[]).filter((f) => {
    // Reject stale dates from past years
    if (f.announced_start) {
      const startYear = parseInt(f.announced_start.substring(0, 4));
      if (startYear < currentYear) return false;
    }

    // Reject absurd durations (>60 days) unless typical_duration is also long
    if (f.announced_start && f.announced_end) {
      const startMs = new Date(f.announced_start).getTime();
      const endMs = new Date(f.announced_end).getTime();
      const days = (endMs - startMs) / (1000 * 60 * 60 * 24);
      if (days > 60 && (f.typical_duration_days ?? 0) < 30) return false;
      if (days < 0) return false; // end before start
    }

    return true;
  });
}

export function groupEventsByDay(sessions: FestivalSession[]): Map<string, FestivalSession[]> {
  const groups = new Map<string, FestivalSession[]>();

  for (const session of sessions) {
    if (!groups.has(session.start_date)) {
      groups.set(session.start_date, []);
    }
    groups.get(session.start_date)!.push(session);
  }

  // Sort events within each day by time
  for (const events of groups.values()) {
    events.sort((a, b) => {
      return (a.start_time || "").localeCompare(b.start_time || "");
    });
  }

  return groups;
}
