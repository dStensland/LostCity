// web/lib/film/by-film-loader.ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { classifyVenue } from './classification';
import type {
  ByFilmPayload,
  EditorialGroup,
  FilmByFilmEntry,
  FilmVenue,
  FormatToken,
  ProgrammingStyle,
} from './types';

// --------------------------------------------------------------------------
// Pure helpers (exported for unit tests)
// --------------------------------------------------------------------------

export function classifyEditorialGroup(
  runStart: string,
  runEnd: string,
  weekStart: string,
  weekEnd: string,
): EditorialGroup {
  const startsThisWeek = runStart >= weekStart && runStart <= weekEnd;
  const endsThisWeek = runEnd >= weekStart && runEnd <= weekEnd;
  if (startsThisWeek) return 'opens';
  if (endsThisWeek) return 'closes';
  return 'now';
}

const GROUP_ORDER: Record<EditorialGroup, number> = { opens: 0, now: 1, closes: 2 };

type TransposeInputRow = {
  time: {
    id: string;
    start_date: string;
    start_time: string | null;
    end_time: string | null;
    format_labels: FormatToken[];
    status: 'scheduled' | 'cancelled' | 'sold_out';
    ticket_url: string | null;
    event_id: number | null;
  };
  run: { start_date: string; end_date: string };
  venue: FilmVenue;
  title: {
    id: string;
    canonical_title: string;
    slug: string;
    poster_image_url: string | null;
    synopsis: string | null;
    genres: string[] | null;
    editorial_blurb: string | null;
    film_press_quote: string | null;
    film_press_source: string | null;
    is_premiere: boolean;
    premiere_scope: 'atl' | 'us' | 'world' | null;
    director: string | null;
    year: number | null;
    runtime_minutes: number | null;
    rating: string | null;
  };
};

type TransposeContext = {
  portalSlug: string;
  date: string;
  weekStart: string;
  weekEnd: string;
};

export function transposeToFilms(
  rows: TransposeInputRow[],
  ctx: TransposeContext,
): ByFilmPayload {
  type Acc = {
    titleMeta: TransposeInputRow['title'];
    venuesMap: Map<number, { venue: FilmVenue; times: FilmByFilmEntry['venues'][number]['times'] }>;
    runFirst: string;
    runLast: string;
  };
  const byTitle = new Map<string, Acc>();

  for (const row of rows) {
    const tid = row.title.id;
    let acc = byTitle.get(tid);
    if (!acc) {
      acc = {
        titleMeta: row.title,
        venuesMap: new Map(),
        runFirst: row.run.start_date,
        runLast: row.run.end_date,
      };
      byTitle.set(tid, acc);
    } else {
      if (row.run.start_date < acc.runFirst) acc.runFirst = row.run.start_date;
      if (row.run.end_date > acc.runLast) acc.runLast = row.run.end_date;
    }

    let venueEntry = acc.venuesMap.get(row.venue.id);
    if (!venueEntry) {
      venueEntry = { venue: row.venue, times: [] };
      acc.venuesMap.set(row.venue.id, venueEntry);
    }
    venueEntry.times.push({
      id: row.time.id,
      start_date: row.time.start_date,
      start_time: row.time.start_time,
      format_labels: row.time.format_labels,
      status: row.time.status,
    });
  }

  const films: FilmByFilmEntry[] = [];
  let total = 0;
  for (const acc of byTitle.values()) {
    const venues = Array.from(acc.venuesMap.values())
      .map((v) => ({
        venue: v.venue,
        times: v.times.sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? '')),
      }))
      .sort((a, b) => a.venue.name.localeCompare(b.venue.name));
    total += venues.reduce((n, v) => n + v.times.length, 0);

    films.push({
      film: {
        screening_title_id: acc.titleMeta.id,
        slug: acc.titleMeta.slug,
        title: acc.titleMeta.canonical_title,
        director: acc.titleMeta.director,
        year: acc.titleMeta.year,
        runtime_minutes: acc.titleMeta.runtime_minutes,
        rating: acc.titleMeta.rating,
        image_url: acc.titleMeta.poster_image_url,
        editorial_blurb: acc.titleMeta.editorial_blurb,
        film_press_quote: acc.titleMeta.film_press_quote,
        film_press_source: acc.titleMeta.film_press_source,
        is_premiere: Boolean(acc.titleMeta.is_premiere),
        premiere_scope: acc.titleMeta.premiere_scope,
        genres: acc.titleMeta.genres,
      },
      editorial_group: classifyEditorialGroup(
        acc.runFirst,
        acc.runLast,
        ctx.weekStart,
        ctx.weekEnd,
      ),
      run_first_date: acc.runFirst,
      run_last_date: acc.runLast,
      venues,
    });
  }

  films.sort((a, b) => {
    const g = GROUP_ORDER[a.editorial_group] - GROUP_ORDER[b.editorial_group];
    return g !== 0 ? g : a.film.title.localeCompare(b.film.title);
  });

  return {
    portal_slug: ctx.portalSlug,
    date: ctx.date,
    iso_week_start: ctx.weekStart,
    iso_week_end: ctx.weekEnd,
    films,
    total_screenings: total,
  };
}

// --------------------------------------------------------------------------
// Supabase wrapper
// --------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Raw Supabase row shapes (narrowed from the joined select)
// ---------------------------------------------------------------------------

type RawByFilmScreeningTitle = {
  id: string;
  canonical_title: string;
  slug: string;
  poster_image_url: string | null;
  synopsis: string | null;
  genres: string[] | null;
  editorial_blurb: string | null;
  film_press_quote: string | null;
  film_press_source: string | null;
  is_premiere: boolean | null;
  premiere_scope: 'atl' | 'us' | 'world' | null;
  director: string | null;
  year: number | null;
  runtime_minutes: number | null;
  rating: string | null;
};

type RawByFilmPlace = {
  id: number;
  slug: string;
  name: string;
  neighborhood: string | null;
  programming_style: ProgrammingStyle | null;
  venue_formats: FormatToken[] | null;
  founding_year: number | null;
  place_vertical_details: { google?: { rating?: number | null } | null } | null;
};

type RawByFilmScreeningRun = {
  id: string;
  start_date: string;
  end_date: string;
  screen_name: string | null;
  screening_titles: RawByFilmScreeningTitle;
  places: RawByFilmPlace;
};

type RawByFilmTime = {
  id: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  format_labels: FormatToken[] | null;
  status: 'scheduled' | 'cancelled' | 'sold_out';
  ticket_url: string | null;
  event_id: number | null;
  screening_runs: RawByFilmScreeningRun;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isoWeekRangeForDate(date: string): { start: string; end: string } {
  const d = new Date(date + 'T00:00:00Z');
  const day = d.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diffToMonday);
  monday.setUTCHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

async function resolvePortalId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  portalSlug: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('portals')
    .select('id')
    .eq('slug', portalSlug)
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw new Error(`resolvePortalId failed: ${error.message}`);
  if (!data) throw new Error(`Portal not found: ${portalSlug}`);

  const row = data as { id: string };
  return row.id;
}

// ---------------------------------------------------------------------------
// Main loader
// ---------------------------------------------------------------------------

export async function loadByFilm(args: {
  portalSlug: string;
  date: string;
}): Promise<ByFilmPayload> {
  const supabase = await createClient();
  const portalId = await resolvePortalId(supabase, args.portalSlug);
  const week = isoWeekRangeForDate(args.date);

  const { data, error } = await supabase
    .from('screening_times')
    .select(`
      id, start_date, start_time, end_time, format_labels,
      status, ticket_url, event_id,
      screening_runs!inner (
        id, start_date, end_date, screen_name,
        screening_titles!inner (
          id, canonical_title, slug, poster_image_url, synopsis, genres,
          editorial_blurb, film_press_quote, film_press_source,
          is_premiere, premiere_scope,
          director, year, runtime_minutes, rating
        ),
        places!inner (
          id, slug, name, neighborhood,
          programming_style, venue_formats, founding_year,
          place_vertical_details (google)
        )
      )
    `)
    .eq('start_date', args.date)
    .eq('screening_runs.portal_id', portalId)
    .order('start_time');

  if (error) {
    throw new Error(`loadByFilm query failed: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as RawByFilmTime[];

  const inputRows: TransposeInputRow[] = rows.map((st) => {
    const r = st.screening_runs;
    const t = r.screening_titles;
    const p = r.places;
    return {
      time: {
        id: st.id,
        start_date: st.start_date,
        start_time: st.start_time,
        end_time: st.end_time,
        format_labels: (st.format_labels ?? []) as FormatToken[],
        status: st.status,
        ticket_url: st.ticket_url,
        event_id: st.event_id,
      },
      run: {
        start_date: r.start_date,
        end_date: r.end_date,
      },
      venue: {
        id: p.id,
        slug: p.slug,
        name: p.name,
        neighborhood: p.neighborhood,
        classification: classifyVenue({
          programming_style: p.programming_style,
          venue_formats: (p.venue_formats ?? []) as FormatToken[],
        }),
        programming_style: p.programming_style,
        venue_formats: (p.venue_formats ?? []) as FormatToken[],
        founding_year: p.founding_year,
        google_rating: p.place_vertical_details?.google?.rating ?? null,
      },
      title: {
        id: t.id,
        canonical_title: t.canonical_title,
        slug: t.slug,
        poster_image_url: t.poster_image_url,
        synopsis: t.synopsis,
        genres: t.genres,
        editorial_blurb: t.editorial_blurb,
        film_press_quote: t.film_press_quote,
        film_press_source: t.film_press_source,
        is_premiere: Boolean(t.is_premiere),
        premiere_scope: t.premiere_scope,
        director: t.director,
        year: t.year,
        runtime_minutes: t.runtime_minutes,
        rating: t.rating,
      },
    };
  });

  return transposeToFilms(inputRows, {
    portalSlug: args.portalSlug,
    date: args.date,
    weekStart: week.start,
    weekEnd: week.end,
  });
}
