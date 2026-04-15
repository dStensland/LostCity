import { createClient } from "@/lib/supabase/server";
import { getLocalDateString } from "@/lib/formats";
import {
  fetchScreeningBundleFromTables,
  type ScreeningBundle,
} from "@/lib/screenings";

// Type for raw event data from Supabase query
type RawFestivalEvent = {
  id: number;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  category: string | null;
  category_id?: string | null;
  image_url: string | null;
  series_id: string | null;
  tags: string[] | null;
  source_url: string | null;
  ticket_url: string | null;
  series?: {
    id: string;
    slug: string;
    title: string;
    series_type: string;
    image_url: string | null;
    festival?: {
      id?: string | null;
      name?: string | null;
    } | null;
  } | null;
  venue: {
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
  description: string | null;
  start_date: string;
  end_date: string | null;
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
  const today = futureOnly ? getLocalDateString() : undefined;

  const eventSelect = `
    id,
    title,
    description,
    start_date,
    end_date,
    start_time,
    end_time,
    category:category_id,
    image_url,
    series_id,
    is_all_day,
    venue:places (
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
  `;

  // Path 1: events linked through series.festival_id → events.series_id
  const { data: seriesData } = await supabase
    .from("series")
    .select("id")
    .eq("festival_id", festivalId)
    .eq("is_active", true);

  const seriesIds = (seriesData as { id: string }[] | null)?.map((s) => s.id) ?? [];

  let seriesEvents: RawFestivalEvent[] = [];
  if (seriesIds.length > 0) {
    let q = supabase
      .from("events")
      .select(eventSelect)
      .in("series_id", seriesIds)
      .or("start_time.not.is.null,is_all_day.eq.true")
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (today) q = q.gte("start_date", today);

    const { data } = await q;
    seriesEvents = (data as RawFestivalEvent[] | null) ?? [];
  }

  // Path 2: events linked directly via events.festival_id (no series record)
  let directEvents: RawFestivalEvent[] = [];
  {
    let q = supabase
      .from("events")
      .select(eventSelect)
      .eq("festival_id", festivalId)
      .is("series_id", null)
      .or("start_time.not.is.null,is_all_day.eq.true")
      .order("start_date", { ascending: true })
      .order("start_time", { ascending: true });

    if (today) q = q.gte("start_date", today);

    const { data } = await q;
    directEvents = (data as RawFestivalEvent[] | null) ?? [];
  }

  // Merge and dedup by event ID
  const seen = new Set<number>();
  const merged: RawFestivalEvent[] = [];
  for (const event of [...seriesEvents, ...directEvents]) {
    if (!seen.has(event.id)) {
      seen.add(event.id);
      merged.push(event);
    }
  }

  // Re-sort after merge
  merged.sort((a, b) => {
    const dateCmp = a.start_date.localeCompare(b.start_date);
    if (dateCmp !== 0) return dateCmp;
    return (a.start_time || "").localeCompare(b.start_time || "");
  });

  return merged.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    start_date: event.start_date,
    end_date: event.end_date,
    start_time: event.start_time,
    end_time: event.end_time,
    category: event.category,
    image_url: event.image_url,
    series_id: event.series_id,
    venue: event.venue,
  }));
}

export async function getFestivalScreenings(
  festivalId: string,
): Promise<ScreeningBundle | null> {
  // All cinema sources are screening-primary — screening tables are the source of truth.
  const supabase = await createClient();
  const screeningsFromTables = await fetchScreeningBundleFromTables(
    supabase,
    { festivalId },
  );
  return screeningsFromTables && screeningsFromTables.titles.length > 0
    ? screeningsFromTables
    : null;
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

export interface TentpoleEvent {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  is_all_day: boolean;
  is_free: boolean;
  image_url: string | null;
  description: string | null;
  category: string | null;
  festival_id: string | null;
  is_tentpole: boolean;
  source_url: string | null;
  ticket_url: string | null;
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
  } | null;
  festival: {
    id: string;
    slug: string;
    name: string;
    image_url: string | null;
    festival_type: string | null;
    location: string | null;
    neighborhood: string | null;
  } | null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getTentpoleEvents(portalId?: string): Promise<TentpoleEvent[]> {
  const supabase = await createClient();
  const today = getLocalDateString();

  const query = supabase
    .from("events")
    .select(`
      id,
      title,
      start_date,
      start_time,
      end_date,
      end_time,
      is_all_day,
      is_free,
      image_url,
      description,
      category,
      festival_id,
      is_tentpole,
      source_url,
      ticket_url,
      venue:places(id, name, slug, neighborhood),
      festival:festivals!events_festival_id_fkey(id, slug, name, image_url, festival_type, location, neighborhood)
    `)
    .eq("is_tentpole", true)
    .or(`start_date.gte.${today},end_date.gte.${today}`)
    .is("canonical_event_id", null)
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true });

  // Portal scoping: if portalId provided, filter by portal
  // Tentpole events are associated with festivals which have portal_id
  // We join through festival_id → festivals.portal_id
  // For now, we fetch all tentpole events and filter client-side if needed

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data as TentpoleEvent[];
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
