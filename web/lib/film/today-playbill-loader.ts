// web/lib/film/today-playbill-loader.ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { classifyVenue } from './classification';
import type {
  FilmScreening,
  FilmVenue,
  TodayPlaybillPayload,
  FormatToken,
  ProgrammingStyle,
  VenueClassification,
} from './types';

// ---------------------------------------------------------------------------
// Raw Supabase row shapes (narrowed from the joined select)
// ---------------------------------------------------------------------------

type RawScreeningTitle = {
  id: string;
  canonical_title: string;
  slug: string;
  poster_image_url: string | null;
  synopsis: string | null;
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
  programming_style: ProgrammingStyle | null;
  venue_formats: FormatToken[] | null;
  founding_year: number | null;
  place_vertical_details: { google?: { rating?: number | null } | null } | null;
};

type RawScreeningRun = {
  id: string;
  screening_title_id: string;
  festival_id: string | null;
  is_special_event: boolean | null;
  is_curator_pick: boolean | null;
  curator_pick_week: string | null;
  screen_name: string | null;
  screening_titles: RawScreeningTitle;
  places: RawPlace;
};

type RawScreeningTime = {
  id: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  format_labels: FormatToken[] | null;
  status: 'scheduled' | 'cancelled' | 'sold_out';
  ticket_url: string | null;
  event_id: number | null;
  screening_runs: RawScreeningRun;
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

export async function loadTodayPlaybill(args: {
  portalSlug: string;
  date: string;
  includeAdditional?: boolean;
  additionalVenueIds?: number[];
}): Promise<TodayPlaybillPayload> {
  const supabase = await createClient();
  const portalId = await resolvePortalId(supabase, args.portalSlug);
  const weekRange = isoWeekRangeForDate(args.date);

  const { data, error } = await supabase
    .from('screening_times')
    .select(`
      id, start_date, start_time, end_time, format_labels,
      status, ticket_url, event_id,
      screening_runs!inner (
        id, screening_title_id, festival_id, is_special_event,
        is_curator_pick, curator_pick_week, screen_name,
        screening_titles!inner (
          id, canonical_title, slug, poster_image_url, synopsis,
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
    throw new Error(`loadTodayPlaybill query failed: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as RawScreeningTime[];

  const byVenue = new Map<
    number,
    { venue: FilmVenue; screenings: Map<string, FilmScreening> }
  >();
  const additionalSet = new Set(args.additionalVenueIds ?? []);

  for (const st of rows) {
    const r = st.screening_runs;
    const t = r.screening_titles;
    const p = r.places;
    const classification: VenueClassification = classifyVenue({
      programming_style: p.programming_style,
      venue_formats: (p.venue_formats ?? []) as FormatToken[],
    });

    const visible =
      classification !== 'additional' ||
      (args.includeAdditional === true && additionalSet.has(p.id));
    if (!visible) continue;

    let group = byVenue.get(p.id);
    if (!group) {
      const venue: FilmVenue = {
        id: p.id,
        slug: p.slug,
        name: p.name,
        neighborhood: p.neighborhood,
        classification,
        programming_style: p.programming_style,
        venue_formats: (p.venue_formats ?? []) as FormatToken[],
        founding_year: p.founding_year,
        google_rating: p.place_vertical_details?.google?.rating ?? null,
      };
      group = { venue, screenings: new Map() };
      byVenue.set(p.id, group);
    }

    let screening = group.screenings.get(r.id);
    if (!screening) {
      screening = {
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
        is_curator_pick:
          (r.is_curator_pick ?? false) &&
          (r.curator_pick_week === null ||
            (r.curator_pick_week >= weekRange.start &&
              r.curator_pick_week <= weekRange.end)),
        festival_id: r.festival_id,
        festival_name: null,
        venue: group.venue,
        times: [],
      };
      group.screenings.set(r.id, screening);
    }

    screening.times.push({
      id: st.id,
      start_date: st.start_date,
      start_time: st.start_time,
      end_time: st.end_time,
      format_labels: (st.format_labels ?? []) as FormatToken[],
      status: st.status,
      ticket_url: st.ticket_url,
      event_id: st.event_id,
    });
  }

  const venues = Array.from(byVenue.values()).map((g) => ({
    venue: g.venue,
    screenings: Array.from(g.screenings.values()),
  }));

  const classOrder: Record<VenueClassification, number> = {
    editorial_program: 0,
    premium_format: 1,
    additional: 2,
  };
  venues.sort(
    (a, b) =>
      classOrder[a.venue.classification] - classOrder[b.venue.classification] ||
      a.venue.name.localeCompare(b.venue.name),
  );

  const totalScreenings = venues.reduce(
    (sum, v) => sum + v.screenings.length,
    0,
  );

  return {
    portal_slug: args.portalSlug,
    date: args.date,
    venues,
    total_screenings: totalScreenings,
  };
}
