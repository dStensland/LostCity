import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from "@/lib/rate-limit";
import { getLocalDateString } from "@/lib/formats";
import { isChainCinemaVenue } from "@/lib/cinema-filter";
import { getOrSetSharedCacheJson } from "@/lib/shared-cache";
import { applyFeedGate } from "@/lib/feed-gate";
import { resolvePortalQueryContext, getVerticalFromRequest } from "@/lib/portal-query-context";
import { applyFederatedPortalScopeToQuery, isVenueCityInScope } from "@/lib/portal-scope";
import { getPortalSourceAccess } from "@/lib/federation";

// Cache 5 min public, 10 min stale-while-revalidate
export const revalidate = 300;

const SHOWTIMES_PAYLOAD_CACHE_TTL_MS = 2 * 60 * 1000;
const SHOWTIMES_PAYLOAD_CACHE_MAX_ENTRIES = 120;
const SHOWTIMES_CACHE_NAMESPACE = "api:showtimes";
const SHOWTIMES_EVENT_LIMIT = 1200;
const SHOWTIMES_META_DATE_LIMIT = 2000;
const SHOWTIMES_META_LOOKAHEAD_DAYS = 60;

function addDaysToDateString(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  parsed.setDate(parsed.getDate() + days);
  return getLocalDateString(parsed);
}

type ShowtimeVenue = {
  id: number;
  name: string;
  slug: string;
  neighborhood: string | null;
  city: string | null;
  google_rating?: number | null;
  google_rating_count?: number | null;
};
type ShowtimeSeries = {
  id: string;
  slug: string;
  title: string;
  image_url: string | null;
  genres: string[] | null;
  director: string | null;
  year: number | null;
  runtime_minutes: number | null;
  rating: string | null;
  festival_id: string | null;
  festival: { name: string } | null;
};
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
  return title
    .toLowerCase()
    .trim()
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
      series_slug: string | null;
      image_url: string | null;
      genres: string[];
      director: string | null;
      year: number | null;
      runtime_minutes: number | null;
      rating: string | null;
      festival_id: string | null;
      festival_name: string | null;
      theaters: Map<
        number,
        {
          venue_id: number;
          venue_name: string;
          venue_slug: string;
          neighborhood: string | null;
          google_rating: number | null;
          google_rating_count: number | null;
          times: { time: string; event_id: number }[];
        }
      >;
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
        series_slug: series?.slug || null,
        image_url: series?.image_url || event.image_url,
        genres: series?.genres || [],
        director: series?.director || null,
        year: series?.year || null,
        runtime_minutes: series?.runtime_minutes ?? null,
        rating: series?.rating ?? null,
        festival_id: series?.festival_id ?? null,
        festival_name: series?.festival
          ? (Array.isArray(series.festival) ? (series.festival[0]?.name ?? null) : (series.festival as { name: string } | null)?.name ?? null)
          : null,
        theaters: new Map(),
      };
      filmMap.set(groupKey, film);
    }

    if (!film.image_url && event.image_url) {
      film.image_url = event.image_url;
    }

    let theater = film.theaters.get(venue.id);
    if (!theater) {
      // Flatten google rating from place_vertical_details
      const raw = venue as typeof venue & {
        place_vertical_details?: { google?: { rating?: number | null; rating_count?: number | null } | null } | null;
      };
      const googleData = raw.place_vertical_details?.google ?? null;

      theater = {
        venue_id: venue.id,
        venue_name: venue.name,
        venue_slug: venue.slug,
        neighborhood: venue.neighborhood,
        google_rating: googleData?.rating ?? null,
        google_rating_count: googleData?.rating_count ?? null,
        times: [],
      };
      film.theaters.set(venue.id, theater);
    }

    if (event.start_time) {
      const time = event.start_time.slice(0, 5);
      if (!theater.times.some((t) => t.time === time)) {
        theater.times.push({ time, event_id: event.id });
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
          for (const entry of theater.times) {
            if (!existing.times.some((t) => t.time === entry.time)) existing.times.push(entry);
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
      series_slug: film.series_slug,
      image_url: film.image_url,
      genres: film.genres,
      director: film.director,
      year: film.year,
      runtime_minutes: film.runtime_minutes,
      rating: film.rating,
      festival_id: film.festival_id,
      festival_name: film.festival_name,
      theaters: Array.from(film.theaters.values()).map((theater) => ({
        venue_id: theater.venue_id,
        venue_name: theater.venue_name,
        venue_slug: theater.venue_slug,
        neighborhood: theater.neighborhood,
        times: theater.times.sort((a, b) => a.time.localeCompare(b.time)),
      })),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/** Convert film map to by-theater response array */
function toTheatersResponse(
  filmMap: ReturnType<typeof buildFilmMap>,
  urgencyMap?: Map<string, { remaining_count: number; first_date: string | null }>,
) {
  const theaterMap = new Map<
    number,
    {
      venue_id: number;
      venue_name: string;
      venue_slug: string;
      neighborhood: string | null;
      google_rating: number | null;
      google_rating_count: number | null;
      films: {
        title: string;
        series_id: string | null;
        series_slug: string | null;
        image_url: string | null;
        genres: string[];
        director: string | null;
        year: number | null;
        runtime_minutes: number | null;
        rating: string | null;
        festival_id: string | null;
        festival_name: string | null;
        remaining_count: number | null;
        first_date: string | null;
        times: { time: string; event_id: number }[];
      }[];
    }
  >();

  for (const film of filmMap.values()) {
    const urgency = film.series_id ? urgencyMap?.get(film.series_id) : undefined;
    for (const [venueId, theater] of film.theaters) {
      let theaterEntry = theaterMap.get(venueId);
      if (!theaterEntry) {
        theaterEntry = {
          venue_id: theater.venue_id,
          venue_name: theater.venue_name,
          venue_slug: theater.venue_slug,
          neighborhood: theater.neighborhood,
          google_rating: theater.google_rating,
          google_rating_count: theater.google_rating_count,
          films: [],
        };
        theaterMap.set(venueId, theaterEntry);
      }
      theaterEntry.films.push({
        title: film.title,
        series_id: film.series_id,
        series_slug: film.series_slug,
        image_url: film.image_url,
        genres: film.genres,
        director: film.director,
        year: film.year,
        runtime_minutes: film.runtime_minutes,
        rating: film.rating,
        festival_id: film.festival_id,
        festival_name: film.festival_name,
        remaining_count: urgency?.remaining_count ?? null,
        first_date: urgency?.first_date ?? null,
        times: theater.times.sort((a, b) => a.time.localeCompare(b.time)),
      });
    }
  }

  // Sort theaters: indie cinemas first (by priority), then chains alphabetically
  return Array.from(theaterMap.values())
    .map((t) => ({
      ...t,
      films: t.films.sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => {
      const aChain = isChainCinemaVenue({ name: a.venue_name, slug: a.venue_slug });
      const bChain = isChainCinemaVenue({ name: b.venue_name, slug: b.venue_slug });
      if (aChain !== bChain) return aChain ? 1 : -1; // indie first
      return a.venue_name.localeCompare(b.venue_name);
    });
}

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const date = searchParams.get("date") || getLocalDateString(new Date());
  const mode = searchParams.get("mode") || "by-film"; // "by-film" | "by-theater"
  const theaterFilter = searchParams.get("theater"); // venue slug filter
  const special = searchParams.get("special") === "true";
  const includeMeta = searchParams.get("meta") === "true";
  const includeChains = searchParams.get("include_chains") === "true";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "Invalid date format. Use YYYY-MM-DD." },
      { status: 400 },
    );
  }

  // Resolve portal context for city + portal_id scoping
  const portalContext = await resolvePortalQueryContext(supabase, searchParams, getVerticalFromRequest(request));
  const portalCity = portalContext.filters.city || "Atlanta";
  const portalId = portalContext.portalId;
  const sourceAccess = portalId ? await getPortalSourceAccess(portalId) : null;

  const cacheKey = [
    date,
    mode,
    theaterFilter || "",
    special ? "1" : "0",
    includeMeta ? "1" : "0",
    includeChains ? "1" : "0",
    portalCity,
    portalId ?? "none",
  ].join("|");
  const result = await getOrSetSharedCacheJson<Record<string, unknown>>(
    SHOWTIMES_CACHE_NAMESPACE,
    cacheKey,
    SHOWTIMES_PAYLOAD_CACHE_TTL_MS,
    async () => {
      // Fetch ALL film events at cinema venues for this date (both showtime and special).
      // We fetch broadly and split in code to avoid PostgREST join-filter limitations.
      let showtimesQuery = supabase
        .from("events")
        .select(
          `
      id,
      title,
      start_time,
      image_url,
      tags,
      series_id,
      venue:places!events_place_id_fkey(
        id,
        name,
        slug,
        neighborhood,
        city,
        place_vertical_details(google)
      ),
      series:series!events_series_id_fkey(
        id,
        slug,
        title,
        image_url,
        genres,
        director,
        year,
        runtime_minutes,
        rating,
        festival_id,
        festival:festivals!series_festival_id_fkey(name)
      )
    `,
        )
        .eq("start_date", date)
        .eq("category_id", "film")
        .not("start_time", "is", null)
        .order("start_time", { ascending: true })
        .limit(SHOWTIMES_EVENT_LIMIT);
      showtimesQuery = applyFeedGate(showtimesQuery);
      showtimesQuery = applyFederatedPortalScopeToQuery(showtimesQuery, {
        portalId,
        publicOnlyWhenNoPortal: true,
        sourceIds: sourceAccess?.sourceIds ?? [],
      });
      const { data: events, error } = await showtimesQuery;

      if (error) {
        throw error;
      }

      const typedEvents = (events as unknown as ShowtimeEvent[] | null) || [];

      // Filter: must have venue and venue must be in portal city scope
      const cityFilteredEvents = typedEvents.filter((e) =>
        e.venue && isVenueCityInScope(e.venue.city, portalCity),
      );

      const venueFilteredEvents = includeChains
        ? cityFilteredEvents
        : cityFilteredEvents.filter((event) => !isChainCinemaVenue(event.venue));

      // Split into regular showtimes vs special screenings
      const regularEvents = venueFilteredEvents.filter((e) =>
        (e.tags || []).includes("showtime"),
      );
      const specialEvents = venueFilteredEvents.filter(
        (e) => !(e.tags || []).includes("showtime"),
      );

      // Choose which events to display based on special flag
      let displayEvents = special ? specialEvents : regularEvents;

      // Apply theater filter in code
      if (theaterFilter) {
        displayEvents = displayEvents.filter(
          (e) => e.venue?.slug === theaterFilter,
        );
      }

      // Build film map and response
      const filmMap = buildFilmMap(displayEvents);

      // Build urgency map for by-theater mode (remaining showtimes + first date per series)
      let urgencyMap: Map<string, { remaining_count: number; first_date: string | null }> | undefined;
      if (mode === "by-theater") {
        const seriesIds = Array.from(filmMap.values())
          .map((f) => f.series_id)
          .filter((id): id is string => id !== null);

        if (seriesIds.length > 0) {
          const { data: urgencyRows } = await supabase
            .from("events")
            .select("series_id, start_date")
            .in("series_id", seriesIds)
            .eq("category_id", "film")
            .contains("tags", ["showtime"])
            .gte("start_date", date)
            .not("start_time", "is", null)
            .limit(5000);

          urgencyMap = new Map();
          for (const row of (urgencyRows as unknown as { series_id: string; start_date: string }[] | null) || []) {
            if (!row.series_id) continue;
            const existing = urgencyMap.get(row.series_id);
            if (!existing) {
              urgencyMap.set(row.series_id, { remaining_count: 1, first_date: row.start_date });
            } else {
              existing.remaining_count += 1;
              if (!existing.first_date || row.start_date < existing.first_date) {
                existing.first_date = row.start_date;
              }
            }
          }
        }
      }

      // Build response
      const responsePayload: Record<string, unknown> = { date };

      if (mode === "by-theater") {
        responsePayload.theaters = toTheatersResponse(filmMap, urgencyMap);
      } else {
        responsePayload.films = toFilmsResponse(filmMap);
      }

      // Meta: available dates, theaters, films (for UI controls)
      if (includeMeta) {
        const dateWindowEnd = addDaysToDateString(date, SHOWTIMES_META_LOOKAHEAD_DAYS);

    // Get available dates with showtime-tagged film events.
    // Use client-sent date as lower bound to avoid UTC timezone mismatch on Vercel.
    // Explicit limit to avoid PostgREST default of 1000 truncating dates.
    let availableDates: string[] = [];
    if (includeChains) {
      let chainsMetaQuery = supabase
        .from("events")
        .select("start_date")
        .eq("category_id", "film")
        .contains("tags", ["showtime"])
        .gte("start_date", date)
        .lte("start_date", dateWindowEnd)
        .not("start_time", "is", null)
        .order("start_date", { ascending: true })
        .limit(SHOWTIMES_META_DATE_LIMIT);
      chainsMetaQuery = applyFederatedPortalScopeToQuery(chainsMetaQuery, {
        portalId,
        publicOnlyWhenNoPortal: true,
        sourceIds: sourceAccess?.sourceIds ?? [],
      });
      const { data: dateRows } = await chainsMetaQuery;

      availableDates = [
        ...new Set(
          ((dateRows as unknown as { start_date: string }[] | null) || []).map(
            (r) => r.start_date,
          ),
        ),
      ];
    } else {
      let indieMetaQuery = supabase
        .from("events")
        .select(
          `
          start_date,
          venue:places!events_place_id_fkey(
            name,
            slug,
            city
          )
        `,
        )
        .eq("category_id", "film")
        .contains("tags", ["showtime"])
        .gte("start_date", date)
        .lte("start_date", dateWindowEnd)
        .not("start_time", "is", null)
        .order("start_date", { ascending: true })
        .limit(SHOWTIMES_META_DATE_LIMIT);
      indieMetaQuery = applyFederatedPortalScopeToQuery(indieMetaQuery, {
        portalId,
        publicOnlyWhenNoPortal: true,
        sourceIds: sourceAccess?.sourceIds ?? [],
      });
      const { data: dateRows } = await indieMetaQuery;

      const filteredRows = (
        (dateRows as unknown as
          | { start_date: string; venue: ShowtimeVenue | null }[]
          | null) || []
      ).filter(
        (row) =>
          isVenueCityInScope(row.venue?.city, portalCity) &&
          !isChainCinemaVenue(row.venue),
      );

      availableDates = [...new Set(filteredRows.map((row) => row.start_date))];
    }

    // Derive theaters and films from ALL regular events (not just filtered)
    const allFilmMap = buildFilmMap(regularEvents);

    const theaterSet = new Map<
      number,
      {
        venue_id: number;
        venue_name: string;
        venue_slug: string;
        neighborhood: string | null;
      }
    >();
    const filmSet = new Map<
      string,
      {
        title: string;
        series_id: string | null;
        series_slug: string | null;
        image_url: string | null;
      }
    >();

    for (const film of allFilmMap.values()) {
      const filmKey =
        film.series_id || `title:${normalizeFilmTitle(film.title)}`;
      if (!filmSet.has(filmKey)) {
        filmSet.set(filmKey, {
          title: film.title,
          series_id: film.series_id,
          series_slug: film.series_slug,
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

        responsePayload.meta = {
          available_dates: availableDates,
          available_theaters: Array.from(theaterSet.values()).sort((a, b) =>
            a.venue_name.localeCompare(b.venue_name),
          ),
          available_films: Array.from(filmSet.values()).sort((a, b) =>
            a.title.localeCompare(b.title),
          ),
        };
      }

      return responsePayload;
    },
    { maxEntries: SHOWTIMES_PAYLOAD_CACHE_MAX_ENTRIES }
  );

  const response = NextResponse.json(result);
  response.headers.set(
    "Cache-Control",
    "public, s-maxage=300, stale-while-revalidate=600",
  );
  return response;
}
