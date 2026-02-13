import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { getLocalDateString } from "@/lib/formats";

// Cache 5 min public, 10 min stale-while-revalidate
export const revalidate = 300;

type ShowtimeVenue = { id: number; name: string; slug: string; neighborhood: string | null };
type ShowtimeSeries = { id: string; title: string; image_url: string | null };
type ShowtimeEvent = {
  id: number;
  title: string;
  start_time: string | null;
  image_url: string | null;
  tags: string[] | null;
  series_id: string | null;
  venue: ShowtimeVenue | null;
  series: ShowtimeSeries | null;
};

/** Normalize title for fuzzy matching (strip year/format suffixes) */
function normalizeFilmTitle(title: string): string {
  return title.toLowerCase().trim()
    .replace(/\s*\(\d{4}\)\s*$/, "")
    .replace(/\s*\(digital\)\s*$/i, "")
    .replace(/\s*\(35mm\)\s*$/i, "")
    .replace(/\.{3,}$/, "");
}

/** Group events into film map (by series_id or normalized title) */
function buildFilmMap(events: ShowtimeEvent[]) {
  const filmMap = new Map<
    string,
    {
      title: string;
      series_id: string | null;
      image_url: string | null;
      theaters: Map<number, {
        venue_id: number;
        venue_name: string;
        venue_slug: string;
        neighborhood: string | null;
        times: string[];
      }>;
    }
  >();

  for (const event of events) {
    const venue = event.venue;
    if (!venue) continue;

    const series = event.series;
    const normalizedTitle = normalizeFilmTitle(event.title);
    const groupKey = event.series_id || `title:${normalizedTitle}`;

    let film = filmMap.get(groupKey);
    if (!film) {
      film = {
        title: series?.title || event.title,
        series_id: event.series_id,
        image_url: series?.image_url || event.image_url,
        theaters: new Map(),
      };
      filmMap.set(groupKey, film);
    }

    if (!film.image_url && event.image_url) {
      film.image_url = event.image_url;
    }

    let theater = film.theaters.get(venue.id);
    if (!theater) {
      theater = {
        venue_id: venue.id,
        venue_name: venue.name,
        venue_slug: venue.slug,
        neighborhood: venue.neighborhood,
        times: [],
      };
      film.theaters.set(venue.id, theater);
    }

    if (event.start_time) {
      const time = event.start_time.slice(0, 5);
      if (!theater.times.includes(time)) {
        theater.times.push(time);
      }
    }
  }

  // Merge title-only groups into series-keyed groups with the same normalized title
  const seriesByTitle = new Map<string, string>();
  for (const [key, film] of filmMap) {
    if (film.series_id) {
      seriesByTitle.set(normalizeFilmTitle(film.title), key);
    }
  }
  for (const [key, film] of filmMap) {
    if (film.series_id) continue;
    const normalizedTitle = normalizeFilmTitle(film.title);
    const seriesKey = seriesByTitle.get(normalizedTitle);
    if (seriesKey && seriesKey !== key) {
      const target = filmMap.get(seriesKey)!;
      for (const [venueId, theater] of film.theaters) {
        const existing = target.theaters.get(venueId);
        if (existing) {
          for (const time of theater.times) {
            if (!existing.times.includes(time)) existing.times.push(time);
          }
        } else {
          target.theaters.set(venueId, theater);
        }
      }
      if (!target.image_url && film.image_url) {
        target.image_url = film.image_url;
      }
      filmMap.delete(key);
    }
  }

  return filmMap;
}

/** Convert film map to sorted by-film response array */
function toFilmsResponse(filmMap: ReturnType<typeof buildFilmMap>) {
  return Array.from(filmMap.values())
    .map((film) => ({
      title: film.title,
      series_id: film.series_id,
      image_url: film.image_url,
      theaters: Array.from(film.theaters.values()).map((theater) => ({
        venue_id: theater.venue_id,
        venue_name: theater.venue_name,
        venue_slug: theater.venue_slug,
        neighborhood: theater.neighborhood,
        times: theater.times.sort(),
      })),
    }))
    .sort((a, b) => b.theaters.length - a.theaters.length || a.title.localeCompare(b.title));
}

/** Convert film map to by-theater response array */
function toTheatersResponse(filmMap: ReturnType<typeof buildFilmMap>) {
  const theaterMap = new Map<number, {
    venue_id: number;
    venue_name: string;
    venue_slug: string;
    neighborhood: string | null;
    films: {
      title: string;
      series_id: string | null;
      image_url: string | null;
      times: string[];
    }[];
  }>();

  for (const film of filmMap.values()) {
    for (const [venueId, theater] of film.theaters) {
      let theaterEntry = theaterMap.get(venueId);
      if (!theaterEntry) {
        theaterEntry = {
          venue_id: theater.venue_id,
          venue_name: theater.venue_name,
          venue_slug: theater.venue_slug,
          neighborhood: theater.neighborhood,
          films: [],
        };
        theaterMap.set(venueId, theaterEntry);
      }
      theaterEntry.films.push({
        title: film.title,
        series_id: film.series_id,
        image_url: film.image_url,
        times: theater.times.sort(),
      });
    }
  }

  // Sort theaters by film count desc, then name
  return Array.from(theaterMap.values())
    .map((t) => ({
      ...t,
      films: t.films.sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => b.films.length - a.films.length || a.venue_name.localeCompare(b.venue_name));
}

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const date = searchParams.get("date") || getLocalDateString(new Date());
  const mode = searchParams.get("mode") || "by-film"; // "by-film" | "by-theater"
  const theaterFilter = searchParams.get("theater"); // venue slug filter
  const special = searchParams.get("special") === "true";
  const includeMeta = searchParams.get("meta") === "true";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "Invalid date format. Use YYYY-MM-DD." },
      { status: 400 }
    );
  }

  // Fetch ALL film events at cinema venues for this date (both showtime and special).
  // We fetch broadly and split in code to avoid PostgREST join-filter limitations.
  const { data: events, error } = await supabase
    .from("events")
    .select(`
      id,
      title,
      start_time,
      image_url,
      tags,
      series_id,
      venue:venues!events_venue_id_fkey(
        id,
        name,
        slug,
        neighborhood
      ),
      series:series!events_series_id_fkey(
        id,
        title,
        image_url
      )
    `)
    .eq("start_date", date)
    .eq("category", "film")
    .not("start_time", "is", null)
    .order("start_time", { ascending: true })
    .limit(2000);

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch showtimes" },
      { status: 500 }
    );
  }

  const typedEvents = (events as unknown as ShowtimeEvent[] | null) || [];

  // Split into regular showtimes vs special screenings
  const regularEvents = typedEvents.filter((e) =>
    (e.tags || []).includes("showtime")
  );
  const specialEvents = typedEvents.filter((e) =>
    !(e.tags || []).includes("showtime")
  );

  // Choose which events to display based on special flag
  let displayEvents = special ? specialEvents : regularEvents;

  // Apply theater filter in code
  if (theaterFilter) {
    displayEvents = displayEvents.filter(
      (e) => e.venue?.slug === theaterFilter
    );
  }

  // Build film map and response
  const filmMap = buildFilmMap(displayEvents);

  // Build response
  const result: Record<string, unknown> = { date };

  if (mode === "by-theater") {
    result.theaters = toTheatersResponse(filmMap);
  } else {
    result.films = toFilmsResponse(filmMap);
  }

  // Meta: available dates, theaters, films (for UI controls)
  if (includeMeta) {
    // Get available dates with showtime-tagged film events.
    // Use client-sent date as lower bound to avoid UTC timezone mismatch on Vercel.
    // Explicit limit to avoid PostgREST default of 1000 truncating dates.
    const { data: dateRows } = await supabase
      .from("events")
      .select("start_date")
      .eq("category", "film")
      .contains("tags", ["showtime"])
      .gte("start_date", date)
      .not("start_time", "is", null)
      .order("start_date", { ascending: true })
      .limit(5000);

    const availableDates = [
      ...new Set(
        ((dateRows as unknown as { start_date: string }[] | null) || []).map(
          (r) => r.start_date
        )
      ),
    ];

    // Derive theaters and films from ALL regular events (not just filtered)
    const allFilmMap = buildFilmMap(regularEvents);

    const theaterSet = new Map<number, { venue_id: number; venue_name: string; venue_slug: string; neighborhood: string | null }>();
    const filmSet = new Map<string, { title: string; series_id: string | null; image_url: string | null }>();

    for (const film of allFilmMap.values()) {
      const filmKey = film.series_id || `title:${normalizeFilmTitle(film.title)}`;
      if (!filmSet.has(filmKey)) {
        filmSet.set(filmKey, {
          title: film.title,
          series_id: film.series_id,
          image_url: film.image_url,
        });
      }
      for (const theater of film.theaters.values()) {
        if (!theaterSet.has(theater.venue_id)) {
          theaterSet.set(theater.venue_id, {
            venue_id: theater.venue_id,
            venue_name: theater.venue_name,
            venue_slug: theater.venue_slug,
            neighborhood: theater.neighborhood,
          });
        }
      }
    }

    result.meta = {
      available_dates: availableDates,
      available_theaters: Array.from(theaterSet.values()).sort((a, b) =>
        a.venue_name.localeCompare(b.venue_name)
      ),
      available_films: Array.from(filmSet.values()).sort((a, b) =>
        a.title.localeCompare(b.title)
      ),
    };
  }

  const response = NextResponse.json(result);
  response.headers.set(
    "Cache-Control",
    "public, s-maxage=300, stale-while-revalidate=600"
  );
  return response;
}
