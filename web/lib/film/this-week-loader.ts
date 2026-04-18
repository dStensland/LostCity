// web/lib/film/this-week-loader.ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import {
  classifyVenue,
  rankHeroCandidates,
  type HeroCandidate,
} from './classification';
import type {
  FilmScreening,
  ThisWeekPayload,
  FormatToken,
  ProgrammingStyle,
} from './types';

// ---------------------------------------------------------------------------
// Raw Supabase row shapes (narrowed from the joined select)
// ---------------------------------------------------------------------------

type RawScreeningTime = {
  id: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  format_labels: string[] | null;
  status: 'scheduled' | 'cancelled' | 'sold_out';
  ticket_url: string | null;
  event_id: number | null;
};

type RawScreeningTitle = {
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

type RawPlace = {
  id: number;
  slug: string;
  name: string;
  neighborhood: string | null;
  programming_style: string | null;
  venue_formats: string[] | null;
  founding_year: number | null;
  place_vertical_details: { google?: { rating?: number } } | null;
};

type RawScreeningRun = {
  id: string;
  screening_title_id: string;
  start_date: string;
  end_date: string;
  festival_id: string | null;
  is_special_event: boolean | null;
  is_curator_pick: boolean | null;
  curator_pick_week: string | null;
  screen_name: string | null;
  screening_titles: RawScreeningTitle;
  places: RawPlace;
  screening_times: RawScreeningTime[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isoWeekRange(now: Date): { start: string; end: string } {
  const d = new Date(now);
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

export async function loadThisWeek(args: {
  portalSlug: string;
  now?: Date;
}): Promise<ThisWeekPayload> {
  const supabase = await createClient();
  const portalId = await resolvePortalId(supabase, args.portalSlug);
  const week = isoWeekRange(args.now ?? new Date());

  const { data, error } = await supabase
    .from('screening_runs')
    .select(`
      id,
      screening_title_id,
      start_date,
      end_date,
      festival_id,
      is_special_event,
      is_curator_pick,
      curator_pick_week,
      screen_name,
      screening_titles!inner (
        id, canonical_title, slug, poster_image_url, synopsis,
        genres, editorial_blurb, film_press_quote, film_press_source,
        is_premiere, premiere_scope,
        director, year, runtime_minutes, rating
      ),
      places!inner (
        id, slug, name, neighborhood,
        programming_style, venue_formats, founding_year,
        place_vertical_details (google)
      ),
      screening_times!inner (
        id, start_date, start_time, end_time, format_labels,
        status, ticket_url, event_id
      )
    `)
    .eq('portal_id', portalId)
    .gte('end_date', week.start)
    .lte('start_date', week.end)
    .order('start_date');

  if (error) throw new Error(`loadThisWeek query failed: ${error.message}`);

  const runs = (data ?? []) as unknown as RawScreeningRun[];

  const candidates: Array<HeroCandidate & { run: RawScreeningRun }> = runs.map((r) => {
    const times = r.screening_times;
    const firstDate: string | null = times.reduce(
      (acc: string | null, t: RawScreeningTime) =>
        !acc || t.start_date < acc ? t.start_date : acc,
      null as string | null,
    );
    const lastDate: string | null = times.reduce(
      (acc: string | null, t: RawScreeningTime) =>
        !acc || t.start_date > acc ? t.start_date : acc,
      null as string | null,
    );
    const allFormatLabels: FormatToken[] = Array.from(
      new Set<FormatToken>(
        times.flatMap((t) => (t.format_labels ?? []) as FormatToken[]),
      ),
    );
    const isCuratorPickForThisWeek =
      !!r.is_curator_pick &&
      (r.curator_pick_week === null ||
        (r.curator_pick_week >= week.start &&
          r.curator_pick_week <= week.end));
    return {
      run: r,
      id: r.id,
      is_curator_pick: isCuratorPickForThisWeek,
      festival_id: r.festival_id,
      format_labels: allFormatLabels,
      first_date_in_week:
        firstDate !== null && firstDate >= week.start && firstDate <= week.end,
      last_date_in_week:
        lastDate !== null && lastDate >= week.start && lastDate <= week.end,
      one_night_only: firstDate === lastDate && times.length === 1,
    };
  });

  const ranked = rankHeroCandidates(candidates);

  const heroes: Array<FilmScreening & { hero_reason: typeof ranked[0]['hero_reason'] }> =
    ranked.map((c) => {
      const r = c.run;
      const t = r.screening_titles;
      const p = r.places;
      return {
        run_id: r.id,
        screening_title_id: t.id,
        title: t.canonical_title,
        slug: t.slug,
        director: t.director ?? null,
        year: t.year ?? null,
        runtime_minutes: t.runtime_minutes ?? null,
        rating: t.rating ?? null,
        image_url: t.poster_image_url,
        editorial_blurb: t.editorial_blurb,
        film_press_quote: t.film_press_quote,
        film_press_source: t.film_press_source,
        is_premiere: t.is_premiere ?? false,
        premiere_scope: t.premiere_scope ?? null,
        is_curator_pick: c.is_curator_pick,
        festival_id: r.festival_id,
        festival_name: null,
        venue: {
          id: p.id,
          slug: p.slug,
          name: p.name,
          neighborhood: p.neighborhood,
          classification: classifyVenue({
            programming_style: p.programming_style as ProgrammingStyle | null,
            venue_formats: (p.venue_formats ?? []) as FormatToken[],
          }),
          programming_style: p.programming_style as ProgrammingStyle | null,
          venue_formats: (p.venue_formats ?? []) as FormatToken[],
          founding_year: p.founding_year,
          google_rating: p.place_vertical_details?.google?.rating ?? null,
        },
        times: r.screening_times.map((st) => ({
          id: st.id,
          start_date: st.start_date,
          start_time: st.start_time,
          end_time: st.end_time,
          format_labels: (st.format_labels ?? []) as FormatToken[],
          status: st.status,
          ticket_url: st.ticket_url,
          event_id: st.event_id,
        })),
        hero_reason: c.hero_reason,
      };
    });

  return {
    portal_slug: args.portalSlug,
    iso_week_start: week.start,
    iso_week_end: week.end,
    heroes,
  };
}
