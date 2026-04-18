// web/lib/film/by-film-loader.ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type {
  ByFilmPayload,
  EditorialGroup,
  FilmByFilmEntry,
  FilmVenue,
  FormatToken,
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
// Supabase wrapper — stub until Task 3
// --------------------------------------------------------------------------

export async function loadByFilm(_args: {
  portalSlug: string;
  date: string;
}): Promise<ByFilmPayload> {
  void createClient;
  throw new Error('loadByFilm not yet implemented — see Task 3');
}
