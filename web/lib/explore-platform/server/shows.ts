import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getLocalDateString } from "@/lib/formats";
import { isChainCinemaVenue } from "@/lib/cinema-filter";
import { getOrSetSharedCacheJson } from "@/lib/shared-cache";
import { applyFeedGate } from "@/lib/feed-gate";
import {
  resolvePortalQueryContext,
  type PortalQueryContext,
} from "@/lib/portal-query-context";
import {
  applyFederatedPortalScopeToQuery,
  isVenueCityInScope,
} from "@/lib/portal-scope";
import { getPortalSourceAccess } from "@/lib/federation";
import { isNoiseEvent } from "@/lib/show-noise-filter";
import type { ExploreLaneServerLoaderArgs } from "@/lib/explore-platform/types";
import type {
  ShowtimesFilm,
  ShowtimesMeta,
  ShowtimeEntry,
  ShowtimesTheaterGroup,
  ShowsLaneInitialData,
  ShowsTab,
} from "@/lib/explore-platform/lane-data";
import type { MusicShow } from "@/components/find/MusicShowCard";
import type { StageShow } from "@/components/find/StageShowCard";

const SHOWTIMES_PAYLOAD_CACHE_TTL_MS = 2 * 60 * 1000;
const SHOWTIMES_PAYLOAD_CACHE_MAX_ENTRIES = 120;
const SHOWTIMES_CACHE_NAMESPACE = "api:showtimes";
const SHOWTIMES_META_DATE_LIMIT = 2000;
const SHOWTIMES_META_LOOKAHEAD_DAYS = 60;

const MUSIC_CACHE_NAMESPACE = "api:whats-on:music";
const MUSIC_CACHE_TTL_MS = 3 * 60 * 1000;
const MUSIC_CACHE_MAX_ENTRIES = 90;
const MUSIC_EVENT_LIMIT = 200;
const MUSIC_META_DATE_LIMIT = 1000;
const MUSIC_META_LOOKAHEAD_DAYS = 30;

const STAGE_CACHE_NAMESPACE = "api:whats-on:stage";
const STAGE_CACHE_TTL_MS = 3 * 60 * 1000;
const STAGE_CACHE_MAX_ENTRIES = 90;
const STAGE_EVENT_LIMIT = 200;
const STAGE_META_DATE_LIMIT = 1000;
const STAGE_META_LOOKAHEAD_DAYS = 30;

const STAGE_CATEGORIES = ["comedy", "theater", "dance"] as const;
type StageCategory = (typeof STAGE_CATEGORIES)[number];

function isStageCategory(value: string | null): value is StageCategory {
  return STAGE_CATEGORIES.includes(value as StageCategory);
}

type ShowtimeVenue = {
  id: number;
  name: string;
  slug: string;
  neighborhood: string | null;
  city: string | null;
  google_rating?: number | null;
  google_rating_count?: number | null;
  place_vertical_details?: {
    google?: { rating?: number | null; rating_count?: number | null } | null;
  } | null;
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
  festival: { name: string } | { name: string }[] | null;
};

type ShowtimeEvent = {
  id: number;
  start_date: string;
  title: string;
  start_time: string | null;
  image_url: string | null;
  tags: string[] | null;
  series_id: string | null;
  screen_name: string | null;
  venue: ShowtimeVenue | null;
  series: ShowtimeSeries | null;
};

type StoredScreeningTitle = {
  id: string;
  canonical_title: string;
  slug: string;
  poster_image_url: string | null;
  genres: string[] | null;
  director: string | null;
  runtime_minutes: number | null;
  year: number | null;
  rating: string | null;
};

type StoredScreeningRun = {
  id: string;
  screening_title_id: string;
  place_id: number | null;
  source_id: number | null;
  festival_id: string | null;
  is_special_event: boolean;
  screen_name: string | null;
};

type StoredScreeningTime = {
  id: string;
  screening_run_id: string;
  event_id: number | null;
  start_date: string;
  start_time: string | null;
};

type MusicVenue = {
  id: number;
  name: string;
  slug: string;
  neighborhood: string | null;
  city: string | null;
  image_url: string | null;
  lat: number | null;
  lng: number | null;
  place_type: string | null;
};

type MusicArtist = {
  name: string;
  is_headliner: boolean;
  billing_order: number | null;
};

type MusicEvent = {
  id: number;
  title: string;
  start_time: string | null;
  is_free: boolean | null;
  tags: string[] | null;
  genres: string[] | null;
  age_policy: string | null;
  ticket_url: string | null;
  price_min: number | null;
  venue: MusicVenue | null;
  event_artists: MusicArtist[] | null;
};

type StageVenue = {
  id: number;
  name: string;
  slug: string;
  neighborhood: string | null;
  city: string | null;
  image_url: string | null;
  lat: number | null;
  lng: number | null;
  place_type: string | null;
};

type StageSeries = {
  id: string;
  slug: string;
  title: string;
};

type StageEvent = {
  id: number;
  title: string;
  start_time: string | null;
  start_date: string;
  end_date: string | null;
  is_free: boolean | null;
  tags: string[] | null;
  genres: string[] | null;
  category_id: string | null;
  age_policy: string | null;
  ticket_url: string | null;
  series_id: string | null;
  venue: StageVenue | null;
  series: StageSeries | null;
};

type ShowsRouteOptions = {
  searchParams: URLSearchParams;
  vertical?: { verticalSlug?: string | null };
};

export interface ShowtimesPayload {
  date: string;
  films?: ShowtimesFilm[];
  theaters?: ShowtimesTheaterGroup[];
  meta?: ShowtimesMeta;
}

export interface ShowListingsPayload<T> {
  date: string;
  shows: T[];
  meta?: { available_dates: string[] };
}

function normalizeFilmTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/\s*\(\d{4}\)\s*$/, "")
    .replace(/\s*\(digital\)\s*$/i, "")
    .replace(/\s*\(35mm\)\s*$/i, "")
    .replace(/\.{3,}$/, "");
}

function addDaysToDateString(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  parsed.setDate(parsed.getDate() + days);
  return getLocalDateString(parsed);
}

function resolveShowsDate(rawDate: string | null): string {
  return rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
    ? rawDate
    : getLocalDateString(new Date());
}

function resolveShowsTab(value: string | null): ShowsTab {
  return value === "music" ||
    value === "theater" ||
    value === "comedy" ||
    value === "film"
    ? value
    : "film";
}

// TODO: Remove once screening tables are confirmed present in all environments.
// All cinema sources are now screening-primary; this guard is defensive scaffolding.
function isMissingScreeningSchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  const code =
    "code" in error && typeof error.code === "string" ? error.code : "";

  return (
    code === "PGRST205" ||
    code === "PGRST200" ||
    code === "42P01" ||
    code === "42703" ||
    /screening_/i.test(message) ||
    /relation .* does not exist/i.test(message) ||
    /column .* does not exist/i.test(message)
  );
}

async function resolveShowsScope(options: ShowsRouteOptions): Promise<{
  portalContext: PortalQueryContext;
  portalCity: string;
  portalId: string | null;
  sourceIds: number[];
  supabase: Awaited<ReturnType<typeof createClient>>;
}> {
  const supabase = await createClient();
  const portalContext = await resolvePortalQueryContext(
    supabase,
    options.searchParams,
    options.vertical,
  );
  const portalId = portalContext.portalId;
  const sourceAccess = portalId ? await getPortalSourceAccess(portalId) : null;

  return {
    portalContext,
    portalCity: portalContext.filters.city || "Atlanta",
    portalId,
    sourceIds: sourceAccess?.sourceIds ?? [],
    supabase,
  };
}

async function loadStoredShowtimeEvents(
  supabase: Awaited<ReturnType<typeof createClient>>,
  options: {
    dateFrom: string;
    dateTo: string;
    portalCity: string;
    sourceIds: number[];
    includeChains: boolean;
    portalId?: string | null;
  },
): Promise<ShowtimeEvent[] | null> {
  const timesResult = await supabase
    .from("screening_times")
    .select("id, screening_run_id, event_id, start_date, start_time")
    .gte("start_date", options.dateFrom)
    .lte("start_date", options.dateTo)
    .not("start_time", "is", null)
    .order("start_date", { ascending: true })
    .limit(SHOWTIMES_META_DATE_LIMIT);

  if (timesResult.error) {
    if (isMissingScreeningSchemaError(timesResult.error)) return null;
    throw timesResult.error;
  }

  const times = (timesResult.data as StoredScreeningTime[] | null) ?? [];
  if (times.length === 0) return [];

  const runIds = Array.from(new Set(times.map((time) => time.screening_run_id)));
  let runsQuery = supabase
    .from("screening_runs")
    .select("id, screening_title_id, place_id, source_id, festival_id, is_special_event")
    .in("id", runIds);
  if (options.sourceIds.length > 0) {
    runsQuery = runsQuery.in("source_id", options.sourceIds);
  } else if (options.portalId) {
    // Portal without explicit federation — scope to portal-owned sources
    const { data: ownedSources } = await supabase
      .from("sources")
      .select("id")
      .eq("owner_portal_id", options.portalId);
    const ownedIds = (ownedSources || []).map((r: { id: number }) => r.id);
    if (ownedIds.length > 0) {
      runsQuery = runsQuery.in("source_id", ownedIds);
    }
  }

  const runsResult = await runsQuery;
  if (runsResult.error) {
    if (isMissingScreeningSchemaError(runsResult.error)) return null;
    throw runsResult.error;
  }

  const runs = (runsResult.data as StoredScreeningRun[] | null) ?? [];
  if (runs.length === 0) return [];

  const screenNameMap = new Map<string, string>();
  try {
    const screenResult = await supabase
      .from("screening_runs")
      .select("id, screen_name")
      .in("id", runs.map((r) => r.id))
      .not("screen_name", "is", null);
    if (!screenResult.error && screenResult.data) {
      for (const row of screenResult.data as { id: string; screen_name: string }[]) {
        screenNameMap.set(row.id, row.screen_name);
      }
    }
  } catch {
    // Column doesn't exist yet — ignore
  }

  const runsWithScreen = runs.map((run) => ({
    ...run,
    screen_name: screenNameMap.get(run.id) ?? null,
  }));

  const runMap = new Map(runsWithScreen.map((run) => [run.id, run]));

  const titleIds = Array.from(new Set(runs.map((run) => run.screening_title_id)));
  const titlesResult = await supabase
    .from("screening_titles")
    .select("id, canonical_title, slug, poster_image_url, genres, director, runtime_minutes, year, rating")
    .in("id", titleIds);
  if (titlesResult.error) {
    if (isMissingScreeningSchemaError(titlesResult.error)) return null;
    throw titlesResult.error;
  }
  const titleMap = new Map(
    (((titlesResult.data as StoredScreeningTitle[] | null) ?? [])).map((title) => [
      title.id,
      title,
    ]),
  );

  const placeIds = Array.from(
    new Set(
      runs
        .map((run) => run.place_id)
        .filter((placeId): placeId is number => typeof placeId === "number"),
    ),
  );
  const placesResult = placeIds.length
    ? await supabase
        .from("places")
        .select("id, name, slug, neighborhood, city, place_vertical_details(google)")
        .in("id", placeIds)
    : { data: [], error: null };
  if (placesResult.error) {
    throw placesResult.error;
  }
  const placeMap = new Map(
    (((placesResult.data as ShowtimeVenue[] | null) ?? [])).map((place) => [
      place.id,
      place,
    ]),
  );

  const events: ShowtimeEvent[] = [];
  for (const time of times) {
    const run = runMap.get(time.screening_run_id);
    const title = run ? titleMap.get(run.screening_title_id) : null;
    const venue = run?.place_id ? placeMap.get(run.place_id) ?? null : null;
    if (!run || !title || !venue || !isVenueCityInScope(venue.city, options.portalCity)) {
      continue;
    }
    if (!options.includeChains && isChainCinemaVenue(venue)) {
      continue;
    }
    if (typeof time.event_id !== "number") {
      continue;
    }
    events.push({
      id: time.event_id,
      start_date: time.start_date,
      title: title.canonical_title,
      start_time: time.start_time,
      image_url: title.poster_image_url,
      tags: run.is_special_event ? ["screening"] : ["showtime"],
      series_id: title.id,
      screen_name: run.screen_name ?? null,
      venue,
      series: {
        id: title.id,
        slug: title.slug,
        title: title.canonical_title,
        image_url: title.poster_image_url,
        genres: title.genres,
        director: title.director ?? null,
        year: title.year ?? null,
        runtime_minutes: title.runtime_minutes ?? null,
        rating: title.rating ?? null,
        festival_id: run.festival_id,
        festival: null,
      },
    });
  }

  return events;
}

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
      runtime_minutes: number | null;
      rating: string | null;
      year: number | null;
      theaters: Map<
        string,
        {
          venue_id: number;
          venue_name: string;
          venue_slug: string;
          neighborhood: string | null;
          google_rating: number | null;
          google_rating_count: number | null;
          screen_name: string | null;
          times: ShowtimeEntry[];
        }
      >;
    }
  >();

  for (const event of events) {
    const venue = event.venue;
    if (!venue) continue;

    const series = event.series;
    const groupKey = normalizeFilmTitle(series?.title || event.title);
    let film = filmMap.get(groupKey);

    if (!film) {
      film = {
        title: series?.title || event.title,
        series_id: event.series_id,
        series_slug: series?.slug || null,
        image_url: series?.image_url || event.image_url,
        genres: series?.genres || [],
        director: series?.director ?? null,
        runtime_minutes: series?.runtime_minutes ?? null,
        rating: series?.rating ?? null,
        year: series?.year ?? null,
        theaters: new Map(),
      };
      filmMap.set(groupKey, film);
    }

    if (!film.image_url && event.image_url) {
      film.image_url = event.image_url;
    }
    if (!film.series_id && event.series_id) {
      film.series_id = event.series_id;
    }
    if (!film.series_slug && series?.slug) {
      film.series_slug = series.slug;
    }

    const theaterKey = event.screen_name
      ? `${venue.id}|${event.screen_name}`
      : String(venue.id);
    let theater = film.theaters.get(theaterKey);
    if (!theater) {
      const googleData = venue.place_vertical_details?.google ?? null;
      theater = {
        venue_id: venue.id,
        venue_name: venue.name,
        venue_slug: venue.slug,
        neighborhood: venue.neighborhood,
        google_rating: googleData?.rating ?? null,
        google_rating_count: googleData?.rating_count ?? null,
        screen_name: event.screen_name ?? null,
        times: [],
      };
      film.theaters.set(theaterKey, theater);
    }

    if (event.start_time) {
      const time = event.start_time.slice(0, 5);
      if (!theater.times.some((entry) => entry.time === time)) {
        theater.times.push({ time, event_id: event.id });
      }
    }
  }

  return filmMap;
}

function toFilmsResponse(filmMap: ReturnType<typeof buildFilmMap>): ShowtimesFilm[] {
  return Array.from(filmMap.values())
    .map((film) => ({
      title: film.title,
      series_id: film.series_id,
      series_slug: film.series_slug,
      image_url: film.image_url,
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

function toTheatersResponse(
  filmMap: ReturnType<typeof buildFilmMap>,
  urgencyMap?: Map<string, { remaining_count: number; first_date: string | null }>,
): ShowtimesTheaterGroup[] {
  const theaterMap = new Map<
    number,
    ShowtimesTheaterGroup & {
      google_rating: number | null;
      google_rating_count: number | null;
      films: Array<
        ShowtimesTheaterGroup["films"][number] & {
          remaining_count: number | null;
          first_date: string | null;
        }
      >;
    }
  >();

  for (const film of filmMap.values()) {
    const urgency = film.series_id ? urgencyMap?.get(film.series_id) : undefined;
    for (const [, theater] of film.theaters) {
      let theaterEntry = theaterMap.get(theater.venue_id);
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
        theaterMap.set(theater.venue_id, theaterEntry);
      }

      theaterEntry.films.push({
        title: film.title,
        series_id: film.series_id,
        series_slug: film.series_slug,
        image_url: film.image_url,
        genres: film.genres,
        director: film.director,
        runtime_minutes: film.runtime_minutes,
        rating: film.rating,
        year: film.year,
        screen_name: theater.screen_name ?? null,
        remaining_count: urgency?.remaining_count ?? null,
        first_date: urgency?.first_date ?? null,
        times: theater.times.sort((a, b) => a.time.localeCompare(b.time)),
      });
    }
  }

  return Array.from(theaterMap.values())
    .map((theater) => ({
      venue_id: theater.venue_id,
      venue_name: theater.venue_name,
      venue_slug: theater.venue_slug,
      neighborhood: theater.neighborhood,
      films: theater.films.sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => {
      const aChain = isChainCinemaVenue({ name: a.venue_name, slug: a.venue_slug });
      const bChain = isChainCinemaVenue({ name: b.venue_name, slug: b.venue_slug });
      if (aChain !== bChain) return aChain ? 1 : -1;
      return a.venue_name.localeCompare(b.venue_name);
    });
}

function isMusicVenueInScope(venue: MusicVenue | null, portalCity: string): boolean {
  return !!venue && isVenueCityInScope(venue.city, portalCity);
}

function isStageVenueInScope(venue: StageVenue | null, portalCity: string): boolean {
  return !!venue && isVenueCityInScope(venue.city, portalCity);
}

function toMusicShow(event: MusicEvent): MusicShow {
  const artists = (event.event_artists ?? [])
    .slice()
    .sort((a, b) => {
      if (a.is_headliner !== b.is_headliner) return a.is_headliner ? -1 : 1;
      return (a.billing_order ?? 9999) - (b.billing_order ?? 9999);
    });

  return {
    event_id: event.id,
    title: event.title,
    start_time: event.start_time,
    is_free: event.is_free ?? false,
    tags: event.tags ?? [],
    genres: event.genres ?? [],
    age_policy: event.age_policy,
    ticket_url: event.ticket_url,
    price_min: event.price_min,
    artists: artists.map((artist) => ({
      name: artist.name,
      is_headliner: artist.is_headliner,
      billing_order: artist.billing_order,
    })),
    venue: {
      id: event.venue!.id,
      name: event.venue!.name,
      slug: event.venue!.slug,
      neighborhood: event.venue!.neighborhood,
      image_url: event.venue!.image_url,
      lat: event.venue!.lat,
      lng: event.venue!.lng,
    },
  };
}

function toStageShow(event: StageEvent): StageShow {
  return {
    event_id: event.id,
    title: event.title,
    start_time: event.start_time,
    start_date: event.start_date,
    end_date: event.end_date,
    is_free: event.is_free ?? false,
    tags: event.tags ?? [],
    genres: event.genres ?? [],
    category_id: event.category_id ?? "theater",
    age_policy: event.age_policy,
    ticket_url: event.ticket_url,
    series_id: event.series_id,
    series_slug: event.series?.slug ?? null,
    venue: {
      id: event.venue!.id,
      name: event.venue!.name,
      slug: event.venue!.slug,
      neighborhood: event.venue!.neighborhood,
      image_url: event.venue!.image_url,
      lat: event.venue!.lat,
      lng: event.venue!.lng,
    },
  };
}

export async function getShowtimesPayload(
  options: ShowsRouteOptions,
): Promise<ShowtimesPayload> {
  const { searchParams } = options;
  const date = resolveShowsDate(searchParams.get("date"));
  const mode = searchParams.get("mode") || "by-film";
  const theaterFilter = searchParams.get("theater");
  const special = searchParams.get("special") === "true";
  const includeMeta = searchParams.get("meta") === "true";
  const includeChains = searchParams.get("include_chains") === "true";
  const { supabase, portalCity, portalId, sourceIds } = await resolveShowsScope(options);

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

  return getOrSetSharedCacheJson<ShowtimesPayload>(
    SHOWTIMES_CACHE_NAMESPACE,
    cacheKey,
    SHOWTIMES_PAYLOAD_CACHE_TTL_MS,
    async () => {
      const [storedEventsForDate, storedEventsForWindow] = await Promise.all([
        loadStoredShowtimeEvents(supabase, {
          dateFrom: date,
          dateTo: date,
          portalCity,
          sourceIds,
          includeChains,
          portalId,
        }),
        loadStoredShowtimeEvents(supabase, {
          dateFrom: date,
          dateTo: addDaysToDateString(date, SHOWTIMES_META_LOOKAHEAD_DAYS),
          portalCity,
          sourceIds,
          includeChains,
          portalId,
        }),
      ]);

      if (storedEventsForDate !== null && storedEventsForWindow !== null) {
        let displayEvents = (special
          ? storedEventsForDate.filter((event) => !(event.tags || []).includes("showtime"))
          : storedEventsForDate.filter((event) => (event.tags || []).includes("showtime")));
        if (theaterFilter) {
          displayEvents = displayEvents.filter((event) => event.venue?.slug === theaterFilter);
        }

        const storedFilmMap = buildFilmMap(displayEvents);
        let urgencyMap: Map<string, { remaining_count: number; first_date: string | null }> | undefined;

        if (mode === "by-theater" && !special) {
          urgencyMap = new Map();
          for (const row of storedEventsForWindow.filter((event) =>
            (event.tags || []).includes("showtime"),
          )) {
            if (!row.series_id) continue;
            const existing = urgencyMap.get(row.series_id);
            if (!existing) {
              urgencyMap.set(row.series_id, {
                remaining_count: 1,
                first_date: row.start_date,
              });
              continue;
            }
            existing.remaining_count += 1;
            if (!existing.first_date || row.start_date < existing.first_date) {
              existing.first_date = row.start_date;
            }
          }
        }

        const payload: ShowtimesPayload = { date };
        if (mode === "by-theater") {
          payload.theaters = toTheatersResponse(storedFilmMap, urgencyMap);
        } else {
          payload.films = toFilmsResponse(storedFilmMap);
        }

        if (!includeMeta) {
          return payload;
        }

        const regularWindowEvents = storedEventsForWindow.filter((event) =>
          (event.tags || []).includes("showtime"),
        );
        const allFilmMap = buildFilmMap(regularWindowEvents);
        const theaterMap = new Map<number, ShowtimesMeta["available_theaters"][number]>();
        const filmMetaMap = new Map<string, ShowtimesMeta["available_films"][number]>();

        for (const film of allFilmMap.values()) {
          const filmKey = film.series_id || `title:${normalizeFilmTitle(film.title)}`;
          if (!filmMetaMap.has(filmKey)) {
            filmMetaMap.set(filmKey, {
              title: film.title,
              series_id: film.series_id,
              series_slug: film.series_slug,
              image_url: film.image_url,
            });
          }
          for (const theater of film.theaters.values()) {
            if (!theaterMap.has(theater.venue_id)) {
              theaterMap.set(theater.venue_id, {
                venue_id: theater.venue_id,
                venue_name: theater.venue_name,
                venue_slug: theater.venue_slug,
                neighborhood: theater.neighborhood,
              });
            }
          }
        }

        payload.meta = {
          available_dates: [...new Set(regularWindowEvents.map((event) => event.start_date))],
          available_theaters: Array.from(theaterMap.values()).sort((a, b) =>
            a.venue_name.localeCompare(b.venue_name),
          ),
          available_films: Array.from(filmMetaMap.values()).sort((a, b) =>
            a.title.localeCompare(b.title),
          ),
        };

        return payload;
      }

      // All cinema sources are screening-primary — screening tables should
      // always be populated. Return empty payload as safe fallback.
      return { date };
    },
    { maxEntries: SHOWTIMES_PAYLOAD_CACHE_MAX_ENTRIES },
  );
}

export async function getMusicShowsPayload(
  options: ShowsRouteOptions,
): Promise<ShowListingsPayload<MusicShow>> {
  const { searchParams } = options;
  const date = resolveShowsDate(searchParams.get("date"));
  const includeMeta = searchParams.get("meta") === "true";
  const { supabase, portalCity, portalId, sourceIds } = await resolveShowsScope(options);

  const cacheKey = [date, includeMeta ? "1" : "0", portalCity, portalId ?? "none"].join("|");

  return getOrSetSharedCacheJson<ShowListingsPayload<MusicShow>>(
    MUSIC_CACHE_NAMESPACE,
    cacheKey,
    MUSIC_CACHE_TTL_MS,
    async () => {
      let query = supabase
        .from("events")
        .select(
          `
          id,
          title,
          start_time,
          is_free,
          tags,
          genres,
          age_policy,
          ticket_url,
          price_min,
          venue:places!events_place_id_fkey(
            id,
            name,
            slug,
            neighborhood,
            city,
            image_url,
            lat,
            lng,
            place_type
          ),
          event_artists(name, is_headliner, billing_order)
          `,
        )
        .eq("start_date", date)
        .eq("category_id", "music")
        .not("start_time", "is", null)
        .order("start_time", { ascending: true })
        .limit(MUSIC_EVENT_LIMIT);

      query = applyFeedGate(query);
      query = applyFederatedPortalScopeToQuery(query, {
        portalId,
        publicOnlyWhenNoPortal: true,
        sourceIds,
      });

      const { data, error } = await query;
      if (error) throw error;

      const shows = ((data as MusicEvent[] | null) ?? [])
        .filter((event) => isMusicVenueInScope(event.venue, portalCity))
        .filter((event) => !isNoiseEvent(event.title, event.venue?.place_type ?? null))
        .map(toMusicShow);

      const payload: ShowListingsPayload<MusicShow> = { date, shows };
      if (!includeMeta) return payload;

      const dateWindowEnd = addDaysToDateString(date, MUSIC_META_LOOKAHEAD_DAYS);
      let metaQuery = supabase
        .from("events")
        .select(
          `
          start_date,
          venue:places!events_place_id_fkey(city)
          `,
        )
        .eq("category_id", "music")
        .or("is_feed_ready.eq.true,is_feed_ready.is.null")
        .gte("start_date", date)
        .lte("start_date", dateWindowEnd)
        .not("start_time", "is", null)
        .order("start_date", { ascending: true })
        .limit(MUSIC_META_DATE_LIMIT);

      metaQuery = applyFederatedPortalScopeToQuery(metaQuery, {
        portalId,
        publicOnlyWhenNoPortal: true,
        sourceIds,
      });

      const { data: metaRows } = await metaQuery;
      payload.meta = {
        available_dates: [
          ...new Set(
            (((metaRows as Array<{ start_date: string; venue: MusicVenue | null }> | null) ?? [])
              .filter((row) => isMusicVenueInScope(row.venue, portalCity))
              .map((row) => row.start_date)),
          ),
        ],
      };

      return payload;
    },
    { maxEntries: MUSIC_CACHE_MAX_ENTRIES },
  );
}

export async function getStageShowsPayload(
  options: ShowsRouteOptions & { categoryFilter: StageCategory | null },
): Promise<ShowListingsPayload<StageShow>> {
  const { searchParams, categoryFilter } = options;
  const date = resolveShowsDate(searchParams.get("date"));
  const includeMeta = searchParams.get("meta") === "true";
  const { supabase, portalCity, portalId, sourceIds } = await resolveShowsScope(options);

  const cacheKey = [
    date,
    includeMeta ? "1" : "0",
    portalCity,
    portalId ?? "none",
    categoryFilter ?? "all",
  ].join("|");

  return getOrSetSharedCacheJson<ShowListingsPayload<StageShow>>(
    STAGE_CACHE_NAMESPACE,
    cacheKey,
    STAGE_CACHE_TTL_MS,
    async () => {
      let query = supabase
        .from("events")
        .select(
          `
          id,
          title,
          start_time,
          start_date,
          end_date,
          is_free,
          tags,
          genres,
          category_id,
          age_policy,
          ticket_url,
          series_id,
          venue:places!events_place_id_fkey(
            id,
            name,
            slug,
            neighborhood,
            city,
            image_url,
            lat,
            lng,
            place_type
          ),
          series:series!events_series_id_fkey(id, slug, title)
          `,
        )
        .eq("start_date", date)
        .not("start_time", "is", null)
        .order("start_time", { ascending: true })
        .limit(STAGE_EVENT_LIMIT);

      if (categoryFilter === "theater") {
        query = query.in("category_id", ["theater", "dance"]);
      } else if (categoryFilter) {
        query = query.eq("category_id", categoryFilter);
      } else {
        query = query.in("category_id", [...STAGE_CATEGORIES]);
      }

      query = applyFeedGate(query);
      query = applyFederatedPortalScopeToQuery(query, {
        portalId,
        publicOnlyWhenNoPortal: true,
        sourceIds,
      });

      const { data, error } = await query;
      if (error) throw error;

      const shows = ((data as StageEvent[] | null) ?? [])
        .filter((event) => isStageVenueInScope(event.venue, portalCity))
        .filter((event) => !isNoiseEvent(event.title, event.venue?.place_type ?? null))
        .map(toStageShow);

      const payload: ShowListingsPayload<StageShow> = { date, shows };
      if (!includeMeta) return payload;

      const dateWindowEnd = addDaysToDateString(date, STAGE_META_LOOKAHEAD_DAYS);
      let metaQuery = supabase
        .from("events")
        .select(
          `
          start_date,
          venue:places!events_place_id_fkey(city)
          `,
        )
        .or("is_feed_ready.eq.true,is_feed_ready.is.null")
        .gte("start_date", date)
        .lte("start_date", dateWindowEnd)
        .not("start_time", "is", null)
        .order("start_date", { ascending: true })
        .limit(STAGE_META_DATE_LIMIT);

      if (categoryFilter === "theater") {
        metaQuery = metaQuery.in("category_id", ["theater", "dance"]);
      } else if (categoryFilter) {
        metaQuery = metaQuery.eq("category_id", categoryFilter);
      } else {
        metaQuery = metaQuery.in("category_id", [...STAGE_CATEGORIES]);
      }

      metaQuery = applyFederatedPortalScopeToQuery(metaQuery, {
        portalId,
        publicOnlyWhenNoPortal: true,
        sourceIds,
      });

      const { data: metaRows } = await metaQuery;
      payload.meta = {
        available_dates: [
          ...new Set(
            (((metaRows as Array<{ start_date: string; venue: StageVenue | null }> | null) ?? [])
              .filter((row) => isStageVenueInScope(row.venue, portalCity))
              .map((row) => row.start_date)),
          ),
        ],
      };

      return payload;
    },
    { maxEntries: STAGE_CACHE_MAX_ENTRIES },
  );
}

export async function getExploreShowsInitialData({
  portalId,
  portalExclusive,
  params,
}: ExploreLaneServerLoaderArgs): Promise<ShowsLaneInitialData | null> {
  const tab = resolveShowsTab(params.get("tab"));
  const searchParams = new URLSearchParams(params.toString());
  searchParams.set("portal_id", portalId);
  if (portalExclusive) {
    searchParams.set("portal_exclusive", "true");
  }

  const date = resolveShowsDate(searchParams.get("date"));
  searchParams.set("date", date);

  if (tab === "film") {
    searchParams.set("meta", "true");
    searchParams.set("include_chains", "true");
    searchParams.set("mode", "by-theater");
    const payload = await getShowtimesPayload({ searchParams });
    if (!payload.meta || !payload.theaters) return null;
    return {
      tab: "film",
      date: payload.date,
      viewMode: "by-theater",
      meta: payload.meta,
      theaters: payload.theaters,
      requestKey: `${portalId}|showtimes|${payload.date}|by-theater`,
    };
  }

  if (tab === "music") {
    searchParams.set("meta", "true");
    const payload = await getMusicShowsPayload({ searchParams });
    return {
      tab: "music",
      date: payload.date,
      meta: payload.meta ?? { available_dates: [payload.date] },
      shows: payload.shows,
      requestKey: `${portalId}|shows|music|${payload.date}`,
    };
  }

  searchParams.set("meta", "true");
  const categoryFilter: StageCategory = tab === "comedy" ? "comedy" : "theater";
  const payload = await getStageShowsPayload({ searchParams, categoryFilter });
  return {
    tab,
    date: payload.date,
    meta: payload.meta ?? { available_dates: [payload.date] },
    shows: payload.shows,
    requestKey: `${portalId}|shows|${tab}|${payload.date}`,
  };
}

export { isStageCategory };
