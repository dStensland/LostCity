import { createClient } from "@/lib/supabase/server";
import { getLocalDateString } from "@/lib/formats";

// --- Types ---

export interface Artist {
  id: string;
  name: string;
  slug: string;
  discipline: string;
  bio: string | null;
  image_url: string | null;
  genres: string[] | null;
  hometown: string | null;
  spotify_id: string | null;
  musicbrainz_id: string | null;
  wikidata_id: string | null;
  created_at: string;
}

export interface EventArtist {
  id: number;
  event_id: number;
  name: string;
  role: string | null;
  billing_order: number | null;
  is_headliner: boolean;
  artist: Artist | null;
}

export interface ArtistEvent {
  id: number;
  title: string;
  start_date: string;
  start_time: string | null;
  category: string | null;
  image_url: string | null;
  venue: {
    id: number;
    name: string;
    slug: string;
    neighborhood: string | null;
  } | null;
  role: string | null;
  is_headliner: boolean;
}

export interface ArtistFestival {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  announced_start: string | null;
  announced_end: string | null;
  categories: string[] | null;
}

// --- Raw types for Supabase query results ---

type RawEventArtist = {
  id: number;
  event_id: number;
  name: string;
  role: string | null;
  billing_order: number | null;
  is_headliner: boolean;
  artists: {
    id: string;
    name: string;
    slug: string;
    discipline: string;
    bio: string | null;
    image_url: string | null;
    genres: string[] | null;
    hometown: string | null;
    spotify_id: string | null;
    musicbrainz_id: string | null;
    wikidata_id: string | null;
    created_at: string;
  } | null;
};

type RawArtistEvent = {
  event_id: number;
  role: string | null;
  is_headliner: boolean;
  events: {
    id: number;
    title: string;
    start_date: string;
    start_time: string | null;
    category: string | null;
    image_url: string | null;
    venues: {
      id: number;
      name: string;
      slug: string;
      neighborhood: string | null;
    } | null;
  } | null;
};

// --- Functions ---

export async function getArtistBySlug(slug: string): Promise<Artist | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("artists")
    .select("id, name, slug, discipline, bio, image_url, genres, hometown, spotify_id, musicbrainz_id, wikidata_id, created_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Artist;
}

export async function getEventArtists(eventId: number): Promise<EventArtist[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("event_artists")
    .select(`
      id,
      event_id,
      name,
      role,
      billing_order,
      is_headliner,
      artists (
        id, name, slug, discipline, bio, image_url, genres, hometown,
        spotify_id, musicbrainz_id, wikidata_id, created_at
      )
    `)
    .eq("event_id", eventId)
    .order("billing_order", { ascending: true, nullsFirst: false })
    .order("is_headliner", { ascending: false })
    .order("name", { ascending: true });

  if (error || !data) {
    return [];
  }

  return (data as RawEventArtist[]).map((row) => ({
    id: row.id,
    event_id: row.event_id,
    name: row.name,
    role: row.role,
    billing_order: row.billing_order,
    is_headliner: row.is_headliner,
    artist: row.artists,
  }));
}

export async function getFestivalArtists(festivalId: string): Promise<EventArtist[]> {
  const supabase = await createClient();

  // Step 1: Get all series linked to this festival
  const { data: seriesData, error: seriesError } = await supabase
    .from("series")
    .select("id")
    .eq("festival_id", festivalId)
    .eq("is_active", true);

  if (seriesError || !seriesData || seriesData.length === 0) {
    return [];
  }

  const seriesIds = (seriesData as { id: string }[]).map((s) => s.id);

  // Step 2: Get all event IDs for these series
  const today = getLocalDateString();
  const { data: eventData, error: eventError } = await supabase
    .from("events")
    .select("id")
    .in("series_id", seriesIds)
    .gte("start_date", today);

  if (eventError || !eventData || eventData.length === 0) {
    return [];
  }

  const eventIds = (eventData as { id: number }[]).map((e) => e.id);

  // Step 3: Get all event_artists for these events, joined with artists
  const { data, error } = await supabase
    .from("event_artists")
    .select(`
      id,
      event_id,
      name,
      role,
      billing_order,
      is_headliner,
      artists (
        id, name, slug, discipline, bio, image_url, genres, hometown,
        spotify_id, musicbrainz_id, wikidata_id, created_at
      )
    `)
    .in("event_id", eventIds)
    .order("is_headliner", { ascending: false })
    .order("billing_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (error || !data) {
    return [];
  }

  // Deduplicate by artist slug (or by name if no linked artist)
  const seen = new Set<string>();
  const unique: EventArtist[] = [];

  for (const row of data as RawEventArtist[]) {
    const key = row.artists?.slug || row.name.toLowerCase().replace(/\s+/g, "-");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({
      id: row.id,
      event_id: row.event_id,
      name: row.name,
      role: row.role,
      billing_order: row.billing_order,
      is_headliner: row.is_headliner,
      artist: row.artists,
    });
  }

  return unique;
}

export async function getArtistEvents(
  artistId: string,
  futureOnly = true
): Promise<ArtistEvent[]> {
  const supabase = await createClient();

  let query = supabase
    .from("event_artists")
    .select(`
      event_id,
      role,
      is_headliner,
      events (
        id,
        title,
        start_date,
        start_time,
        category,
        image_url,
        venues (
          id, name, slug, neighborhood
        )
      )
    `)
    .eq("artist_id", artistId)
    .order("event_id", { ascending: false });

  if (futureOnly) {
    // We can't filter on nested table directly, so we'll filter after
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  const today = futureOnly ? getLocalDateString() : null;

  return (data as RawArtistEvent[])
    .filter((row) => row.events != null)
    .filter((row) => !today || row.events!.start_date >= today)
    .map((row) => ({
      id: row.events!.id,
      title: row.events!.title,
      start_date: row.events!.start_date,
      start_time: row.events!.start_time,
      category: row.events!.category,
      image_url: row.events!.image_url,
      venue: row.events!.venues,
      role: row.role,
      is_headliner: row.is_headliner,
    }))
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
}

export async function getArtistFestivals(artistId: string): Promise<ArtistFestival[]> {
  const supabase = await createClient();

  // Get all event IDs for this artist
  const { data: eventArtists, error: eaError } = await supabase
    .from("event_artists")
    .select("event_id")
    .eq("artist_id", artistId);

  if (eaError || !eventArtists || eventArtists.length === 0) {
    return [];
  }

  const eventIds = (eventArtists as { event_id: number }[]).map((ea) => ea.event_id);

  // Get series IDs for those events
  const { data: events, error: evError } = await supabase
    .from("events")
    .select("series_id")
    .in("id", eventIds)
    .not("series_id", "is", null);

  if (evError || !events || events.length === 0) {
    return [];
  }

  const seriesIds = [...new Set(
    (events as { series_id: string | null }[])
      .map((e) => e.series_id)
      .filter((id): id is string => id != null)
  )];

  if (seriesIds.length === 0) {
    return [];
  }

  // Get festivals for those series
  const { data: seriesData, error: serError } = await supabase
    .from("series")
    .select("festival_id")
    .in("id", seriesIds)
    .not("festival_id", "is", null);

  if (serError || !seriesData || seriesData.length === 0) {
    return [];
  }

  const festivalIds = [...new Set(
    (seriesData as { festival_id: string | null }[])
      .map((s) => s.festival_id)
      .filter((id): id is string => id != null)
  )];

  if (festivalIds.length === 0) {
    return [];
  }

  const { data: festivals, error: fError } = await supabase
    .from("festivals")
    .select("id, name, slug, image_url, announced_start, announced_end, categories")
    .in("id", festivalIds)
    .order("announced_start", { ascending: true });

  if (fError || !festivals) {
    return [];
  }

  return festivals as ArtistFestival[];
}

// --- Helpers ---

/** Map artist discipline to category color CSS variable */
export function getDisciplineColor(discipline: string): string {
  const colors: Record<string, string> = {
    musician: "var(--neon-magenta)",
    band: "var(--neon-magenta)",
    dj: "var(--neon-cyan)",
    comedian: "var(--neon-amber)",
    visual_artist: "var(--neon-purple)",
    actor: "var(--coral)",
    speaker: "var(--gold)",
    filmmaker: "var(--neon-cyan)",
  };
  return colors[discipline] || "var(--coral)";
}

/** Map artist discipline to a display label */
export function getDisciplineLabel(discipline: string): string {
  const labels: Record<string, string> = {
    musician: "Musician",
    band: "Band",
    dj: "DJ",
    comedian: "Comedian",
    visual_artist: "Visual Artist",
    actor: "Actor",
    speaker: "Speaker",
    filmmaker: "Filmmaker",
  };
  return labels[discipline] || discipline.replace(/_/g, " ");
}
