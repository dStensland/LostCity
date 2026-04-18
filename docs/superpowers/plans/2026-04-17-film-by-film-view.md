# By Film View — /explore/film Plan 5

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the **By Film** view on `/{portal}/explore/film` — every film showing in Atlanta on the selected date, grouped into `OPENS THIS WEEK` (gold) / `NOW PLAYING` (vibe) / `CLOSES THIS WEEK` (coral), each card showing a landscape still + editorial line + press quote + a playing-at matrix that rolls up every theater × showtime into actionable chips.

**Architecture:** New server loader `loadByFilm` transposes today's screenings by `screening_title` (rather than by venue), computes first/last ISO-week classification per film, and returns a `ByFilmPayload`. New API route `/api/film/by-film` wraps it. New view component `ByFilmView` + `FilmCard` + `EditorialGroupHeader` render. `FilmExploreShell` wires the view-toggle `view` prop to dispatch between `ByTheaterView` (Plan 4) and `ByFilmView`, fetching By-Film data on demand when the user selects that toggle. `ViewToggle` drops the `disabled` flag on the By Film option.

**Tech Stack:** Next.js 16 App Router (client view + server loader pattern), Tailwind v4 tokens, Phosphor icons, existing `SmartImage` / `Dot` / `buildHeroTag` / `FilterChip` primitives, Vitest + React Testing Library.

---

## Spec references

- Design spec: `docs/superpowers/specs/2026-04-17-now-showing-and-explore-film-design.md` §6.4 (By Film view) + §7 (cross-view rules)
- Plan 4 handoff: `docs/superpowers/specs/2026-04-17-film-explore-page-handoff.md`
- Plan 4 shipped artifacts (PR #37): `FilmExploreShell`, `ViewToggle`, `FilmFilterChips`, `ThisWeekZone`, `ByTheaterView`, `TheaterBlockTier1`, `TheaterBlockTier2`
- Data layer (PR #35): `web/lib/film/types.ts`, `loadThisWeek`, `loadTodayPlaybill`
- Helpers (PR #36): `web/lib/film/hero-tags.ts` → `buildHeroTag`

## File structure

**Create (data):**
- `web/lib/film/by-film-loader.ts` — server loader: transposes screening runs into films-with-venues for a given date; classifies into editorial group (`opens` / `now` / `closes`).
- `web/lib/film/__tests__/by-film-loader.test.ts` — unit tests on the pure helpers (`classifyEditorialGroup`, `transposeToFilms`).
- `web/app/api/film/by-film/route.ts` — thin wrapper around `loadByFilm`.
- `web/app/api/film/by-film/__tests__/route.test.ts` — route tests.

**Create (types):**
- Extend `web/lib/film/types.ts` — add `EditorialGroup`, `FilmByFilmEntry`, `ByFilmPayload`.

**Create (components):**
- `web/app/[portal]/explore/film/_components/EditorialGroupHeader.tsx` — kicker + hairline divider + count.
- `web/app/[portal]/explore/film/_components/FilmCard.tsx` — landscape still + editorial + playing-at matrix.
- `web/app/[portal]/explore/film/_components/ByFilmView.tsx` — group dispatcher + empty/loading states.
- Tests for all three (co-located under `__tests__/`).

**Modify:**
- `web/app/[portal]/explore/film/_components/ViewToggle.tsx` — flip `disabled: false` on the `by-film` option; drop `soon` suffix for it.
- `web/app/[portal]/explore/film/_components/ViewToggle.test.tsx` — update tests: by-film is now enabled, only `schedule` remains disabled.
- `web/app/[portal]/explore/film/_components/FilmExploreShell.tsx` — add `byFilm` state + on-demand fetch + view dispatcher.

---

## Task 1: Extend `FilmFilters` pass-through + types

**Goal:** Add the shared types that loader + route + view all use. Small, isolated type-only change.

**Files:**
- Modify: `web/lib/film/types.ts` (append new types; don't touch existing)

- [ ] **Step 1: Append new types at the bottom of `web/lib/film/types.ts`**

```ts
// --- By Film view (Plan 5) -------------------------------------------------

export type EditorialGroup = 'opens' | 'now' | 'closes';

export type FilmByFilmEntry = {
  film: {
    screening_title_id: string;
    slug: string;
    title: string;
    director: string | null;
    year: number | null;
    runtime_minutes: number | null;
    rating: string | null;
    image_url: string | null;
    editorial_blurb: string | null;
    film_press_quote: string | null;
    film_press_source: string | null;
    is_premiere: boolean;
    premiere_scope: 'atl' | 'us' | 'world' | null;
    genres: string[] | null;
  };
  editorial_group: EditorialGroup;
  run_first_date: string;
  run_last_date: string;
  venues: Array<{
    venue: FilmVenue;
    times: Array<{
      id: string;
      start_date: string;
      start_time: string | null;
      format_labels: FormatToken[];
      status: 'scheduled' | 'cancelled' | 'sold_out';
    }>;
  }>;
};

export type ByFilmPayload = {
  portal_slug: string;
  date: string;
  iso_week_start: string;
  iso_week_end: string;
  films: FilmByFilmEntry[];
  total_screenings: number;
};
```

- [ ] **Step 2: Typecheck**

`cd web && npx tsc --noEmit`
Expected: no errors (pure type addition).

- [ ] **Step 3: Commit**

```bash
git add web/lib/film/types.ts
git commit -m "feat(film): ByFilmPayload + FilmByFilmEntry types

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: `classifyEditorialGroup` + `transposeToFilms` pure helpers

**Goal:** Two pure functions that the loader will compose. `classifyEditorialGroup` maps `(run_first_date, run_last_date, isoWeekStart, isoWeekEnd)` → `'opens' | 'now' | 'closes'`. `transposeToFilms` turns a flat array of `(screening_time, run, venue, title)` rows into the grouped film payload.

**Files:**
- Create: `web/lib/film/by-film-loader.ts` (pure helpers first; Supabase wrapper added in Task 3)
- Test: `web/lib/film/__tests__/by-film-loader.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `web/lib/film/__tests__/by-film-loader.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { classifyEditorialGroup, transposeToFilms } from '../by-film-loader';
import type { EditorialGroup, FormatToken } from '../types';

describe('classifyEditorialGroup', () => {
  const weekStart = '2026-04-20';
  const weekEnd = '2026-04-26';

  it('returns "opens" when run.start_date falls within the week', () => {
    const result = classifyEditorialGroup('2026-04-22', '2026-05-08', weekStart, weekEnd);
    expect(result).toBe<EditorialGroup>('opens');
  });

  it('returns "closes" when run.end_date falls within the week (and start is before)', () => {
    const result = classifyEditorialGroup('2026-04-10', '2026-04-24', weekStart, weekEnd);
    expect(result).toBe<EditorialGroup>('closes');
  });

  it('returns "now" when run spans both boundaries', () => {
    const result = classifyEditorialGroup('2026-04-01', '2026-05-15', weekStart, weekEnd);
    expect(result).toBe<EditorialGroup>('now');
  });

  it('returns "opens" when a single-day run falls inside the week', () => {
    const result = classifyEditorialGroup('2026-04-23', '2026-04-23', weekStart, weekEnd);
    expect(result).toBe<EditorialGroup>('opens');
  });

  it('prefers "opens" over "closes" when both dates are inside the week', () => {
    const result = classifyEditorialGroup('2026-04-22', '2026-04-24', weekStart, weekEnd);
    expect(result).toBe<EditorialGroup>('opens');
  });
});

describe('transposeToFilms', () => {
  const base = {
    portalSlug: 'atlanta',
    date: '2026-04-23',
    weekStart: '2026-04-20',
    weekEnd: '2026-04-26',
  };

  const venueA = {
    id: 1, slug: 'plaza', name: 'Plaza',
    neighborhood: 'Poncey-Highland', classification: 'editorial_program' as const,
    programming_style: 'repertory' as const, venue_formats: [] as FormatToken[],
    founding_year: 1939, google_rating: null,
  };

  const venueB = {
    id: 2, slug: 'tara', name: 'Tara',
    neighborhood: 'Cheshire Bridge', classification: 'editorial_program' as const,
    programming_style: 'repertory' as const, venue_formats: [] as FormatToken[],
    founding_year: 1968, google_rating: null,
  };

  const titleX = {
    id: 'tx', canonical_title: 'Bunnylovr', slug: 'bunnylovr',
    poster_image_url: null, synopsis: null, genres: ['drama'],
    editorial_blurb: 'A bruised debut.', film_press_quote: null, film_press_source: null,
    is_premiere: true, premiere_scope: 'atl' as const,
    director: 'Katarina Zhu', year: 2024, runtime_minutes: 101, rating: 'NR',
  };

  it('groups multiple runs of the same screening_title into one film entry', () => {
    const rows = [
      { time: { id: 't1', start_date: base.date, start_time: '19:45', end_time: null, format_labels: [], status: 'scheduled' as const, ticket_url: null, event_id: null }, run: { start_date: '2026-04-22', end_date: '2026-04-29' }, venue: venueA, title: titleX },
      { time: { id: 't2', start_date: base.date, start_time: '21:30', end_time: null, format_labels: [], status: 'scheduled' as const, ticket_url: null, event_id: null }, run: { start_date: '2026-04-22', end_date: '2026-04-29' }, venue: venueB, title: titleX },
    ];
    const payload = transposeToFilms(rows, base);
    expect(payload.films).toHaveLength(1);
    expect(payload.films[0].venues).toHaveLength(2);
    expect(payload.total_screenings).toBe(2);
  });

  it('assigns editorial_group "opens" when the film opens this week', () => {
    const rows = [
      { time: { id: 't1', start_date: base.date, start_time: '19:45', end_time: null, format_labels: [], status: 'scheduled' as const, ticket_url: null, event_id: null }, run: { start_date: '2026-04-22', end_date: '2026-05-02' }, venue: venueA, title: titleX },
    ];
    const payload = transposeToFilms(rows, base);
    expect(payload.films[0].editorial_group).toBe<EditorialGroup>('opens');
  });

  it('sorts films by group order (opens → now → closes) then by title asc', () => {
    const titleY = { ...titleX, id: 'ty', canonical_title: 'Apollo', slug: 'apollo' };
    const titleZ = { ...titleX, id: 'tz', canonical_title: 'Zinc', slug: 'zinc' };
    const rows = [
      { time: { id: 'tz1', start_date: base.date, start_time: '20:00', end_time: null, format_labels: [], status: 'scheduled' as const, ticket_url: null, event_id: null }, run: { start_date: '2026-04-10', end_date: '2026-04-24' }, venue: venueA, title: titleZ }, // closes
      { time: { id: 'ty1', start_date: base.date, start_time: '20:00', end_time: null, format_labels: [], status: 'scheduled' as const, ticket_url: null, event_id: null }, run: { start_date: '2026-04-22', end_date: '2026-05-02' }, venue: venueA, title: titleY }, // opens
      { time: { id: 'tx1', start_date: base.date, start_time: '20:00', end_time: null, format_labels: [], status: 'scheduled' as const, ticket_url: null, event_id: null }, run: { start_date: '2026-04-01', end_date: '2026-05-10' }, venue: venueA, title: titleX }, // now
    ];
    const payload = transposeToFilms(rows, base);
    expect(payload.films.map((f) => f.film.title)).toEqual(['Apollo', 'Bunnylovr', 'Zinc']);
    expect(payload.films.map((f) => f.editorial_group)).toEqual(['opens', 'now', 'closes']);
  });

  it('exposes iso_week range in the payload', () => {
    const rows = [
      { time: { id: 't', start_date: base.date, start_time: '19:00', end_time: null, format_labels: [], status: 'scheduled' as const, ticket_url: null, event_id: null }, run: { start_date: '2026-04-22', end_date: '2026-04-29' }, venue: venueA, title: titleX },
    ];
    const payload = transposeToFilms(rows, base);
    expect(payload.iso_week_start).toBe(base.weekStart);
    expect(payload.iso_week_end).toBe(base.weekEnd);
  });
});
```

- [ ] **Step 2: Run tests — fail**

`cd web && npx vitest run lib/film/__tests__/by-film-loader.test.ts`
Expected: FAIL ("Cannot find module '../by-film-loader'").

- [ ] **Step 3: Implement the pure helpers**

Create `web/lib/film/by-film-loader.ts`:

```ts
// web/lib/film/by-film-loader.ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type {
  ByFilmPayload,
  EditorialGroup,
  FilmByFilmEntry,
  FilmVenue,
  FormatToken,
  ProgrammingStyle,
  VenueClassification,
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
  // Phase 1: group by screening_title_id → { titleMeta, venuesMap, runFirst, runLast }
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

  // Phase 2: materialize + sort venues (by name) and times (by start_time)
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

  // Phase 3: sort films by group order, then title asc
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
// Supabase wrapper — reserved for Task 3
// --------------------------------------------------------------------------

export async function loadByFilm(_args: {
  portalSlug: string;
  date: string;
}): Promise<ByFilmPayload> {
  void createClient;
  throw new Error('loadByFilm not yet implemented — see Task 3');
}
```

**Note:** `loadByFilm` is a temporary stub that throws — Task 3 replaces it with the real Supabase query. Keep the throw so tests/calls fail loudly until Task 3 lands.

- [ ] **Step 4: Run tests — pass**

`cd web && npx vitest run lib/film/__tests__/by-film-loader.test.ts`
Expected: 9 passing (5 classify + 4 transpose).

- [ ] **Step 5: Commit**

```bash
git add web/lib/film/by-film-loader.ts web/lib/film/__tests__/by-film-loader.test.ts
git commit -m "feat(film): by-film pure helpers (classifyEditorialGroup + transposeToFilms)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: `loadByFilm` Supabase wrapper

**Goal:** Replace the Task-2 stub with the real server loader that queries Supabase, filters to today's scheduled screenings in the portal, and hands rows to `transposeToFilms`.

**Files:**
- Modify: `web/lib/film/by-film-loader.ts` (replace the stub `loadByFilm`)

**Pre-check:** Read `web/lib/film/today-playbill-loader.ts` (top-to-bottom) to copy:
- The `resolvePortalId` inline helper (same pattern)
- The ISO-week helper (`isoWeekRangeForDate`)
- The nested-join + portal filter pattern (`screening_runs!inner → places!inner` with `portal_id` narrowing in-memory)
- The `as unknown as` double-cast pattern for the joined rows

Keep signatures identical to that loader where possible — don't invent new helpers.

- [ ] **Step 1: Replace `loadByFilm`**

Replace the `loadByFilm` function at the bottom of `web/lib/film/by-film-loader.ts` with:

```ts
// --------------------------------------------------------------------------
// Supabase wrapper
// --------------------------------------------------------------------------

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
  return (data as { id: string }).id;
}

function isoWeekRangeForDate(date: string): { start: string; end: string } {
  const d = new Date(date + 'T00:00:00Z');
  const day = d.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

type RawTimeRow = {
  id: string;
  start_date: string;
  start_time: string | null;
  end_time: string | null;
  format_labels: FormatToken[] | null;
  status: 'scheduled' | 'cancelled' | 'sold_out';
  ticket_url: string | null;
  event_id: number | null;
  screening_runs: {
    id: string;
    start_date: string;
    end_date: string;
    screen_name: string | null;
    screening_titles: {
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
    places: {
      id: number;
      slug: string;
      name: string;
      neighborhood: string | null;
      portal_id: string;
      programming_style: ProgrammingStyle | null;
      venue_formats: FormatToken[] | null;
      founding_year: number | null;
      place_vertical_details: { google?: { rating?: number | null } | null } | null;
    };
  };
};

function classifyVenue(programmingStyle: ProgrammingStyle | null): VenueClassification {
  if (!programmingStyle) return 'premium_format';
  if (
    programmingStyle === 'repertory' ||
    programmingStyle === 'indie' ||
    programmingStyle === 'arthouse' ||
    programmingStyle === 'drive_in' ||
    programmingStyle === 'festival'
  ) {
    return 'editorial_program';
  }
  return 'premium_format';
}

export async function loadByFilm(args: {
  portalSlug: string;
  date: string;
}): Promise<ByFilmPayload> {
  const supabase = await createClient();
  const portalId = await resolvePortalId(supabase, args.portalSlug);
  const week = isoWeekRangeForDate(args.date);

  const { data, error } = await supabase
    .from('screening_times')
    .select(
      `id, start_date, start_time, end_time, format_labels, status, ticket_url, event_id,
       screening_runs!inner (
         id, start_date, end_date, screen_name,
         screening_titles!inner (
           id, canonical_title, slug, poster_image_url, synopsis, genres,
           editorial_blurb, film_press_quote, film_press_source,
           is_premiere, premiere_scope, director, year, runtime_minutes, rating
         ),
         places!inner (
           id, slug, name, neighborhood, portal_id,
           programming_style, venue_formats, founding_year, place_vertical_details
         )
       )`,
    )
    .eq('start_date', args.date)
    .eq('status', 'scheduled');

  if (error) throw new Error(`loadByFilm query failed: ${error.message}`);

  const rawRows = (data ?? []) as unknown as RawTimeRow[];

  const inputRows: TransposeInputRow[] = rawRows
    .filter((r) => r.screening_runs.places.portal_id === portalId)
    .map((r) => ({
      time: {
        id: r.id,
        start_date: r.start_date,
        start_time: r.start_time,
        end_time: r.end_time,
        format_labels: r.format_labels ?? [],
        status: r.status,
        ticket_url: r.ticket_url,
        event_id: r.event_id,
      },
      run: {
        start_date: r.screening_runs.start_date,
        end_date: r.screening_runs.end_date,
      },
      venue: {
        id: r.screening_runs.places.id,
        slug: r.screening_runs.places.slug,
        name: r.screening_runs.places.name,
        neighborhood: r.screening_runs.places.neighborhood,
        classification: classifyVenue(r.screening_runs.places.programming_style),
        programming_style: r.screening_runs.places.programming_style,
        venue_formats: r.screening_runs.places.venue_formats ?? [],
        founding_year: r.screening_runs.places.founding_year,
        google_rating: r.screening_runs.places.place_vertical_details?.google?.rating ?? null,
      },
      title: {
        id: r.screening_runs.screening_titles.id,
        canonical_title: r.screening_runs.screening_titles.canonical_title,
        slug: r.screening_runs.screening_titles.slug,
        poster_image_url: r.screening_runs.screening_titles.poster_image_url,
        synopsis: r.screening_runs.screening_titles.synopsis,
        genres: r.screening_runs.screening_titles.genres,
        editorial_blurb: r.screening_runs.screening_titles.editorial_blurb,
        film_press_quote: r.screening_runs.screening_titles.film_press_quote,
        film_press_source: r.screening_runs.screening_titles.film_press_source,
        is_premiere: Boolean(r.screening_runs.screening_titles.is_premiere),
        premiere_scope: r.screening_runs.screening_titles.premiere_scope,
        director: r.screening_runs.screening_titles.director,
        year: r.screening_runs.screening_titles.year,
        runtime_minutes: r.screening_runs.screening_titles.runtime_minutes,
        rating: r.screening_runs.screening_titles.rating,
      },
    }));

  return transposeToFilms(inputRows, {
    portalSlug: args.portalSlug,
    date: args.date,
    weekStart: week.start,
    weekEnd: week.end,
  });
}
```

**Important:** delete the stub `loadByFilm` (the throw-only version) before writing this one. No dual-definition.

**Important:** if the existing `today-playbill-loader.ts` uses a *different* column list for `places` or `screening_titles`, match it exactly — don't fork the select.

- [ ] **Step 2: Typecheck clean**

`cd web && npx tsc --noEmit`

- [ ] **Step 3: Unit tests still pass (pure helpers unchanged)**

`cd web && npx vitest run lib/film/__tests__/by-film-loader.test.ts`
Expected: 9 passing.

- [ ] **Step 4: Commit**

```bash
git add web/lib/film/by-film-loader.ts
git commit -m "feat(film): loadByFilm Supabase wrapper

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: `/api/film/by-film` route + tests

**Files:**
- Create: `web/app/api/film/by-film/route.ts`
- Test: `web/app/api/film/by-film/__tests__/route.test.ts`

- [ ] **Step 1: Write the route**

Create `web/app/api/film/by-film/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from '@/lib/rate-limit';
import { loadByFilm } from '@/lib/film/by-film-loader';

export const revalidate = 300;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayYyyymmdd(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = new URL(request.url);
  const portal = searchParams.get('portal');
  if (!portal) {
    return NextResponse.json(
      { error: 'Missing required query param: portal' },
      { status: 400 },
    );
  }

  const date = searchParams.get('date') ?? todayYyyymmdd();
  if (!DATE_RE.test(date)) {
    return NextResponse.json(
      { error: 'Invalid date format. Use YYYY-MM-DD.' },
      { status: 400 },
    );
  }

  try {
    const payload = await loadByFilm({ portalSlug: portal, date });
    const res = NextResponse.json(payload);
    res.headers.set(
      'Cache-Control',
      'public, s-maxage=300, stale-while-revalidate=600',
    );
    return res;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to load by-film',
      },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Route tests**

Create `web/app/api/film/by-film/__tests__/route.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

vi.mock('@/lib/film/by-film-loader', () => ({
  loadByFilm: vi.fn().mockResolvedValue({
    portal_slug: 'atlanta',
    date: '2026-04-23',
    iso_week_start: '2026-04-20',
    iso_week_end: '2026-04-26',
    films: [],
    total_screenings: 0,
  }),
}));

describe('GET /api/film/by-film', () => {
  it('400s when portal missing', async () => {
    const req = new NextRequest('http://x/api/film/by-film?date=2026-04-23');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('400s on bad date format', async () => {
    const req = new NextRequest('http://x/api/film/by-film?portal=atlanta&date=nope');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('200s with the by-film payload', async () => {
    const req = new NextRequest('http://x/api/film/by-film?portal=atlanta&date=2026-04-23');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ portal_slug: 'atlanta', films: [], total_screenings: 0 });
  });
});
```

- [ ] **Step 3: Run tests — pass**

`cd web && npx vitest run app/api/film/by-film/__tests__/route.test.ts`
Expected: 3 passing.

- [ ] **Step 4: Typecheck + commit**

```bash
cd web && npx tsc --noEmit
cd ..
git add web/app/api/film/by-film/route.ts web/app/api/film/by-film/__tests__/route.test.ts
git commit -m "feat(film): /api/film/by-film route + tests

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: `EditorialGroupHeader` component

**Goal:** Mono-caps kicker + hairline divider filling remaining width. One per editorial group.

**Files:**
- Create: `web/app/[portal]/explore/film/_components/EditorialGroupHeader.tsx`
- Test: `web/app/[portal]/explore/film/_components/__tests__/EditorialGroupHeader.test.tsx`

- [ ] **Step 1: Tests**

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import EditorialGroupHeader from '../EditorialGroupHeader';

describe('EditorialGroupHeader', () => {
  it('renders the opens label in gold', () => {
    const { container } = render(<EditorialGroupHeader group="opens" count={3} />);
    const label = screen.getByText(/OPENS THIS WEEK/i);
    expect(label).toBeInTheDocument();
    expect(label.className).toContain('text-[var(--gold)]');
    expect(container.textContent).toContain('3');
  });

  it('renders the now-playing label in vibe', () => {
    render(<EditorialGroupHeader group="now" count={7} />);
    const label = screen.getByText(/NOW PLAYING/i);
    expect(label.className).toContain('text-[var(--vibe)]');
  });

  it('renders the closes label in coral', () => {
    render(<EditorialGroupHeader group="closes" count={1} />);
    const label = screen.getByText(/CLOSES THIS WEEK/i);
    expect(label.className).toContain('text-[var(--coral)]');
  });

  it('singular count renders "1 film" (no "s")', () => {
    render(<EditorialGroupHeader group="opens" count={1} />);
    expect(screen.getByText(/1 film/i)).toBeInTheDocument();
    expect(screen.queryByText(/1 films/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Fail**

`cd web && npx vitest run "app/[portal]/explore/film/_components/__tests__/EditorialGroupHeader.test.tsx"`

- [ ] **Step 3: Implement**

```tsx
"use client";

import type { EditorialGroup } from '@/lib/film/types';

const LABEL: Record<EditorialGroup, string> = {
  opens: 'OPENS THIS WEEK',
  now: 'NOW PLAYING',
  closes: 'CLOSES THIS WEEK',
};

const TONE: Record<EditorialGroup, string> = {
  opens: 'text-[var(--gold)]',
  now: 'text-[var(--vibe)]',
  closes: 'text-[var(--coral)]',
};

interface Props {
  group: EditorialGroup;
  count: number;
}

export default function EditorialGroupHeader({ group, count }: Props) {
  const toneClass = TONE[group];
  return (
    <div className="flex items-baseline gap-3 mt-2">
      <span
        className={`font-mono text-xs font-bold uppercase tracking-[0.16em] ${toneClass}`}
      >
        {LABEL[group]}
      </span>
      <span className="flex-1 h-px bg-[var(--twilight)]" />
      <span className="font-mono text-xs text-[var(--muted)]">
        {count} film{count === 1 ? '' : 's'}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Pass + commit**

```bash
cd web && npx vitest run "app/[portal]/explore/film/_components/__tests__/EditorialGroupHeader.test.tsx"
cd web && npx tsc --noEmit
cd ..
git add "web/app/[portal]/explore/film/_components/EditorialGroupHeader.tsx" "web/app/[portal]/explore/film/_components/__tests__/EditorialGroupHeader.test.tsx"
git commit -m "feat(film): EditorialGroupHeader — Opens / Now / Closes kicker

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: `FilmCard` component

**Goal:** Landscape still (320×180) on the left, content stack on the right: title + meta row + editorial line + press quote block + "Playing at" matrix where each theater is a row with format-tagged showtime chips. Collapses a block of standard (non-premium) chain showings into a single "+ standard showings" link when there are many.

**Files:**
- Create: `web/app/[portal]/explore/film/_components/FilmCard.tsx`
- Test: `web/app/[portal]/explore/film/_components/__tests__/FilmCard.test.tsx`

**Rule:** Collapse rule — if a venue with `classification === 'premium_format'` has screenings whose `format_labels` is empty (standard showings at chains), collapse those into a single chip `standard →` linking to the film detail page. Tier 1 (editorial_program) venues are never collapsed.

- [ ] **Step 1: Tests**

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import FilmCard from '../FilmCard';
import type { FilmByFilmEntry, FilmVenue, FormatToken } from '@/lib/film/types';

function venue(id: number, name: string, classification: 'editorial_program' | 'premium_format', formats: FormatToken[] = []): FilmVenue {
  return {
    id, slug: name.toLowerCase().replace(/\s/g, '-'), name,
    neighborhood: null, classification,
    programming_style: classification === 'editorial_program' ? 'repertory' : null,
    venue_formats: formats, founding_year: null, google_rating: null,
  };
}

function time(id: string, hh: string, formats: FormatToken[] = []): FilmByFilmEntry['venues'][number]['times'][number] {
  return {
    id, start_date: '2026-04-23', start_time: hh,
    format_labels: formats, status: 'scheduled',
  };
}

function entry(overrides: Partial<FilmByFilmEntry> = {}): FilmByFilmEntry {
  return {
    film: {
      screening_title_id: 'tx',
      slug: 'bunnylovr',
      title: 'Bunnylovr',
      director: 'Katarina Zhu',
      year: 2024,
      runtime_minutes: 101,
      rating: 'NR',
      image_url: null,
      editorial_blurb: 'A bruised, brilliant debut.',
      film_press_quote: 'Stays with you.',
      film_press_source: 'Little White Lies',
      is_premiere: true,
      premiere_scope: 'atl',
      genres: null,
    },
    editorial_group: 'opens',
    run_first_date: '2026-04-22',
    run_last_date: '2026-05-05',
    venues: [
      { venue: venue(1, 'Plaza Theatre', 'editorial_program'), times: [time('t1', '19:45')] },
    ],
    ...overrides,
  };
}

describe('FilmCard', () => {
  it('renders film title + director + year + runtime + rating', () => {
    render(<FilmCard entry={entry()} portalSlug="atlanta" />);
    expect(screen.getByText('Bunnylovr')).toBeInTheDocument();
    expect(screen.getByText(/Dir\. Katarina Zhu/)).toBeInTheDocument();
    expect(screen.getByText(/2024/)).toBeInTheDocument();
    expect(screen.getByText(/1h 41m/)).toBeInTheDocument();
    expect(screen.getByText(/NR/)).toBeInTheDocument();
  });

  it('renders editorial blurb and press quote with source attribution', () => {
    render(<FilmCard entry={entry()} portalSlug="atlanta" />);
    expect(screen.getByText(/A bruised, brilliant debut\./)).toBeInTheDocument();
    expect(screen.getByText(/Stays with you\./)).toBeInTheDocument();
    expect(screen.getByText(/Little White Lies/)).toBeInTheDocument();
  });

  it('renders each theater row with showtime chip and format suffix where present', () => {
    const e = entry({
      venues: [
        {
          venue: venue(2, 'AMC Mall of Georgia', 'premium_format', ['true_imax']),
          times: [time('t2', '19:30', ['true_imax'])],
        },
      ],
    });
    render(<FilmCard entry={e} portalSlug="atlanta" />);
    expect(screen.getByText('AMC Mall of Georgia')).toBeInTheDocument();
    expect(screen.getByText(/7:30/)).toBeInTheDocument();
    expect(screen.getByText(/TRUE IMAX/)).toBeInTheDocument();
  });

  it('collapses standard (no format_labels) chain showings into a single link', () => {
    const e = entry({
      venues: [
        {
          venue: venue(3, 'AMC Phipps', 'premium_format', ['imax']),
          times: [
            time('t1', '14:00'),
            time('t2', '17:00'),
            time('t3', '20:00'),
          ],
        },
      ],
    });
    render(<FilmCard entry={e} portalSlug="atlanta" />);
    expect(screen.getByText(/standard showings/i)).toBeInTheDocument();
    // Individual standard times should NOT render as chips
    expect(screen.queryByText(/2:00/)).not.toBeInTheDocument();
  });

  it('does NOT collapse tier-1 (editorial_program) screenings even without format labels', () => {
    const e = entry({
      venues: [
        {
          venue: venue(1, 'Plaza Theatre', 'editorial_program'),
          times: [time('t1', '19:45'), time('t2', '21:30')],
        },
      ],
    });
    render(<FilmCard entry={e} portalSlug="atlanta" />);
    expect(screen.getByText(/7:45/)).toBeInTheDocument();
    expect(screen.getByText(/9:30/)).toBeInTheDocument();
    expect(screen.queryByText(/standard showings/i)).not.toBeInTheDocument();
  });

  it('shows the gold editorial badge for premiered films', () => {
    render(<FilmCard entry={entry()} portalSlug="atlanta" />);
    expect(screen.getByText(/ATL PREMIERE/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Fail**

`cd web && npx vitest run "app/[portal]/explore/film/_components/__tests__/FilmCard.test.tsx"`

- [ ] **Step 3: Implement**

```tsx
"use client";

import Link from 'next/link';
import SmartImage from '@/components/SmartImage';
import Dot from '@/components/ui/Dot';
import { formatTime } from '@/lib/formats';
import { buildSeriesUrl, buildSpotUrl } from '@/lib/entity-urls';
import { buildHeroTag } from '@/lib/film/hero-tags';
import type { FilmByFilmEntry, FilmScreening, FormatToken } from '@/lib/film/types';

const FORMAT_LABEL: Partial<Record<FormatToken, string>> = {
  true_imax: 'TRUE IMAX',
  imax: 'IMAX',
  dolby_cinema: 'DOLBY CINEMA',
  '4dx': '4DX',
  screenx: 'SCREENX',
  rpx: 'RPX',
  '70mm': '70MM',
  '35mm': '35MM',
};

function runtimeStr(minutes: number | null): string {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// buildHeroTag expects a full FilmScreening — construct a minimal "pseudo"
// screening from the ByFilm entry so we can reuse the same gold-tag logic.
function buildBadgeFromEntry(entry: FilmByFilmEntry) {
  if (!entry.film.is_premiere && !entry.venues.some((v) => v.times.some((t) => t.format_labels.length > 0))) {
    return null;
  }
  const firstVenue = entry.venues[0];
  const firstTime = firstVenue?.times[0];
  if (!firstVenue || !firstTime) return null;
  const pseudo: FilmScreening = {
    run_id: 'pseudo',
    screening_title_id: entry.film.screening_title_id,
    title: entry.film.title,
    slug: entry.film.slug,
    director: entry.film.director,
    year: entry.film.year,
    runtime_minutes: entry.film.runtime_minutes,
    rating: entry.film.rating,
    image_url: entry.film.image_url,
    editorial_blurb: entry.film.editorial_blurb,
    film_press_quote: entry.film.film_press_quote,
    film_press_source: entry.film.film_press_source,
    is_premiere: entry.film.is_premiere,
    premiere_scope: entry.film.premiere_scope,
    is_curator_pick: false,
    festival_id: null,
    festival_name: null,
    venue: firstVenue.venue,
    times: [
      {
        id: firstTime.id,
        start_date: firstTime.start_date,
        start_time: firstTime.start_time,
        end_time: null,
        format_labels: firstTime.format_labels,
        status: firstTime.status,
        ticket_url: null,
        event_id: null,
      },
    ],
  };
  if (entry.film.is_premiere) return buildHeroTag(pseudo, 'opens_this_week');
  if (firstTime.format_labels.length > 0) return buildHeroTag(pseudo, 'special_format');
  return null;
}

interface Props {
  entry: FilmByFilmEntry;
  portalSlug: string;
}

export default function FilmCard({ entry, portalSlug }: Props) {
  const filmUrl = buildSeriesUrl(entry.film.slug, portalSlug, 'film');
  const meta = [
    entry.film.director ? `Dir. ${entry.film.director}` : null,
    entry.film.year,
    runtimeStr(entry.film.runtime_minutes),
    entry.film.rating,
  ]
    .filter(Boolean)
    .join(' · ');
  const badge = buildBadgeFromEntry(entry);

  return (
    <article className="rounded-card-xl border border-[var(--twilight)] bg-[var(--night)] overflow-hidden flex flex-col md:flex-row">
      {/* Landscape still — 320×180 */}
      <Link
        href={filmUrl}
        className="relative w-full md:w-[320px] aspect-[16/9] flex-shrink-0 bg-[var(--dusk)]"
      >
        {entry.film.image_url ? (
          <SmartImage
            src={entry.film.image_url}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 320px"
            className="object-cover"
          />
        ) : null}
      </Link>

      <div className="flex-1 p-4 sm:p-5 min-w-0 space-y-2.5">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={filmUrl}
              className="font-display text-2xl sm:text-3xl font-semibold text-[var(--cream)] hover:text-[var(--vibe)] transition-colors block truncate"
            >
              {entry.film.title}
            </Link>
            {meta && (
              <p className="font-mono text-xs text-[var(--muted)] mt-0.5">{meta}</p>
            )}
          </div>
          {badge && (
            <span className="shrink-0 px-2 py-0.5 rounded bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-2xs font-bold uppercase tracking-[0.14em]">
              {badge.label}
            </span>
          )}
        </div>

        {entry.film.editorial_blurb && (
          <p className="text-sm italic text-[var(--soft)]">{entry.film.editorial_blurb}</p>
        )}

        {entry.film.film_press_quote && (
          <p className="text-sm italic text-[var(--cream)]/90">
            &ldquo;{entry.film.film_press_quote}&rdquo;
            {entry.film.film_press_source && (
              <span className="not-italic text-[var(--gold)]/80"> — {entry.film.film_press_source}</span>
            )}
          </p>
        )}

        {/* Playing at */}
        <div className="pt-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-2xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
              Playing at
            </span>
            <span className="flex-1 h-px bg-[var(--twilight)]" />
          </div>
          {entry.venues.map(({ venue, times }) => {
            const isPremiumFormat = venue.classification === 'premium_format';
            const standardTimes = isPremiumFormat
              ? times.filter((t) => t.format_labels.length === 0)
              : [];
            const premiumTimes = isPremiumFormat
              ? times.filter((t) => t.format_labels.length > 0)
              : times;
            const collapseStandard = isPremiumFormat && standardTimes.length >= 2;

            return (
              <div key={venue.id} className="flex items-center justify-between gap-3 py-1">
                <Link
                  href={buildSpotUrl(venue.slug, portalSlug, 'page')}
                  className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--cream)] hover:text-[var(--vibe)] transition-colors shrink-0"
                >
                  {venue.name}
                </Link>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {premiumTimes.map((t) => {
                    const fmt = t.format_labels[0];
                    return (
                      <Link
                        key={t.id}
                        href={filmUrl}
                        className="px-2 py-0.5 rounded bg-[var(--vibe)]/15 border border-[var(--vibe)]/30 text-[var(--vibe)] font-mono text-xs tabular-nums hover:bg-[var(--vibe)]/25 transition-colors"
                      >
                        {t.start_time ? formatTime(t.start_time) : '—'}
                        {fmt && (
                          <span className="text-2xs ml-1 text-[var(--gold)]">
                            {FORMAT_LABEL[fmt] ?? fmt.toUpperCase()}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                  {collapseStandard && (
                    <Link
                      href={filmUrl}
                      className="px-2 py-0.5 rounded border border-[var(--twilight)] text-[var(--muted)] font-mono text-xs hover:text-[var(--cream)] hover:border-[var(--soft)] transition-colors"
                    >
                      + {standardTimes.length} standard showings →
                    </Link>
                  )}
                  {isPremiumFormat && !collapseStandard &&
                    standardTimes.map((t) => (
                      <Link
                        key={t.id}
                        href={filmUrl}
                        className="px-2 py-0.5 rounded bg-[var(--vibe)]/15 border border-[var(--vibe)]/30 text-[var(--vibe)] font-mono text-xs tabular-nums hover:bg-[var(--vibe)]/25 transition-colors"
                      >
                        {t.start_time ? formatTime(t.start_time) : '—'}
                      </Link>
                    ))}
                </div>
                <Dot className="hidden" aria-hidden />
              </div>
            );
          })}
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 4: Pass + commit**

```bash
cd web && npx vitest run "app/[portal]/explore/film/_components/__tests__/FilmCard.test.tsx"
cd web && npx tsc --noEmit
cd ..
git add "web/app/[portal]/explore/film/_components/FilmCard.tsx" "web/app/[portal]/explore/film/_components/__tests__/FilmCard.test.tsx"
git commit -m "feat(film): FilmCard — landscape hero + playing-at matrix

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: `ByFilmView` component

**Goal:** Group dispatcher. Reads `ByFilmPayload.films`, splits into `opens` / `now` / `closes` buckets, renders each as `<EditorialGroupHeader>` + list of `<FilmCard>`s. Applies same filters as `ByTheaterView` (format + attribute). Empty groups collapse. Two empty states: "No screenings on this date" (zero films total) vs "No films match your filters" (all filtered out).

**Files:**
- Create: `web/app/[portal]/explore/film/_components/ByFilmView.tsx`
- Test: `web/app/[portal]/explore/film/_components/__tests__/ByFilmView.test.tsx`

**Shared filter predicate:** extract the `filmPassesFilters` logic. In Plan 4 it lived inside `ByTheaterView`. For this plan we duplicate the logic here (copy, don't re-export) to keep tasks independent — a future cleanup pass can deduplicate into `web/lib/film/filter-predicates.ts`.

- [ ] **Step 1: Tests**

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ByFilmView from '../ByFilmView';
import { DEFAULT_FILTERS } from '../FilmFilterChips';
import type { ByFilmPayload, FilmByFilmEntry, EditorialGroup } from '@/lib/film/types';

function entry(title: string, group: EditorialGroup, isPremiere = false): FilmByFilmEntry {
  return {
    film: {
      screening_title_id: `st-${title}`,
      slug: title.toLowerCase(),
      title,
      director: null, year: null, runtime_minutes: null, rating: null,
      image_url: null, editorial_blurb: null,
      film_press_quote: null, film_press_source: null,
      is_premiere: isPremiere, premiere_scope: isPremiere ? 'atl' : null,
      genres: null,
    },
    editorial_group: group,
    run_first_date: '2026-04-22',
    run_last_date: '2026-05-05',
    venues: [
      {
        venue: { id: 1, slug: 'plaza', name: 'Plaza', neighborhood: null, classification: 'editorial_program', programming_style: 'repertory', venue_formats: [], founding_year: null, google_rating: null },
        times: [{ id: `t-${title}`, start_date: '2026-04-23', start_time: '19:45', format_labels: [], status: 'scheduled' }],
      },
    ],
  };
}

function payload(entries: FilmByFilmEntry[]): ByFilmPayload {
  return {
    portal_slug: 'atlanta', date: '2026-04-23',
    iso_week_start: '2026-04-20', iso_week_end: '2026-04-26',
    films: entries,
    total_screenings: entries.length,
  };
}

describe('ByFilmView', () => {
  it('renders the three group headers in the expected order', () => {
    render(
      <ByFilmView
        payload={payload([
          entry('A', 'opens'), entry('B', 'now'), entry('C', 'closes'),
        ])}
        filters={DEFAULT_FILTERS}
        portalSlug="atlanta"
      />,
    );
    expect(screen.getByText(/OPENS THIS WEEK/)).toBeInTheDocument();
    expect(screen.getByText(/NOW PLAYING/)).toBeInTheDocument();
    expect(screen.getByText(/CLOSES THIS WEEK/)).toBeInTheDocument();
  });

  it('collapses an empty group (no closes)', () => {
    render(
      <ByFilmView
        payload={payload([entry('A', 'opens'), entry('B', 'now')])}
        filters={DEFAULT_FILTERS}
        portalSlug="atlanta"
      />,
    );
    expect(screen.getByText(/OPENS THIS WEEK/)).toBeInTheDocument();
    expect(screen.getByText(/NOW PLAYING/)).toBeInTheDocument();
    expect(screen.queryByText(/CLOSES THIS WEEK/)).not.toBeInTheDocument();
  });

  it('filters out films that do not match premieresOnly', () => {
    render(
      <ByFilmView
        payload={payload([entry('Regular', 'now'), entry('Premiered', 'opens', true)])}
        filters={{ ...DEFAULT_FILTERS, premieresOnly: true }}
        portalSlug="atlanta"
      />,
    );
    expect(screen.queryByText('Regular')).not.toBeInTheDocument();
    expect(screen.getByText('Premiered')).toBeInTheDocument();
  });

  it('shows "No screenings on this date" when films is empty', () => {
    render(<ByFilmView payload={payload([])} filters={DEFAULT_FILTERS} portalSlug="atlanta" />);
    expect(screen.getByText(/No screenings on this date/i)).toBeInTheDocument();
  });

  it('shows "No films match your filters" when all filtered out', () => {
    render(
      <ByFilmView
        payload={payload([entry('A', 'now')])}
        filters={{ ...DEFAULT_FILTERS, premieresOnly: true }}
        portalSlug="atlanta"
      />,
    );
    expect(screen.getByText(/No films match/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Fail**

`cd web && npx vitest run "app/[portal]/explore/film/_components/__tests__/ByFilmView.test.tsx"`

- [ ] **Step 3: Implement**

```tsx
"use client";

import { FilmSlate } from '@phosphor-icons/react';
import EditorialGroupHeader from './EditorialGroupHeader';
import FilmCard from './FilmCard';
import type { FilmFilters } from './FilmFilterChips';
import type { ByFilmPayload, EditorialGroup, FilmByFilmEntry } from '@/lib/film/types';

const GROUP_ORDER: EditorialGroup[] = ['opens', 'now', 'closes'];

function entryPassesFilters(e: FilmByFilmEntry, f: FilmFilters): boolean {
  if (f.premieresOnly && !e.film.is_premiere) return false;
  // festival / oneNightOnly: no fields on ByFilmEntry (deferred — the API omits
  // festival_id/festival_name). Do not short-circuit here; let those filters
  // effectively no-op on this view until the payload is extended.
  if (f.driveIn && !e.venues.some((v) => v.venue.programming_style === 'drive_in')) return false;
  if (f.formats.length > 0) {
    const allFormats = new Set(e.venues.flatMap((v) => v.times.flatMap((t) => t.format_labels)));
    if (!f.formats.some((ff) => allFormats.has(ff))) return false;
  }
  return true;
}

function prettyDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

interface Props {
  payload: ByFilmPayload;
  filters: FilmFilters;
  portalSlug: string;
}

export default function ByFilmView({ payload, filters, portalSlug }: Props) {
  if (payload.films.length === 0) {
    return (
      <div className="py-12 text-center space-y-3">
        <FilmSlate weight="duotone" className="w-12 h-12 text-[var(--twilight)] mx-auto" />
        <h3 className="text-xl font-display text-[var(--cream)]">No screenings on this date.</h3>
        <p className="text-sm text-[var(--muted)]">Try another day from the strip above.</p>
      </div>
    );
  }

  const filtered = payload.films.filter((e) => entryPassesFilters(e, filters));

  if (filtered.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm italic text-[var(--muted)]">No films match your filters.</p>
      </div>
    );
  }

  const byGroup = new Map<EditorialGroup, FilmByFilmEntry[]>();
  for (const g of GROUP_ORDER) byGroup.set(g, []);
  for (const e of filtered) byGroup.get(e.editorial_group)!.push(e);

  return (
    <div className="space-y-5">
      <header className="flex items-baseline justify-between">
        <div>
          <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            By Film · {prettyDate(payload.date).toUpperCase()} · {filtered.length} FILM
            {filtered.length === 1 ? '' : 'S'}
          </span>
          <p className="text-sm italic text-[var(--soft)] mt-0.5">
            Every film showing in Atlanta, tonight.
          </p>
        </div>
      </header>

      {GROUP_ORDER.map((g) => {
        const entries = byGroup.get(g)!;
        if (entries.length === 0) return null;
        return (
          <section key={g} className="space-y-3">
            <EditorialGroupHeader group={g} count={entries.length} />
            <div className="space-y-3">
              {entries.map((e) => (
                <FilmCard key={e.film.screening_title_id} entry={e} portalSlug={portalSlug} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Pass + commit**

```bash
cd web && npx vitest run "app/[portal]/explore/film/_components/__tests__/ByFilmView.test.tsx"
cd web && npx tsc --noEmit
cd ..
git add "web/app/[portal]/explore/film/_components/ByFilmView.tsx" "web/app/[portal]/explore/film/_components/__tests__/ByFilmView.test.tsx"
git commit -m "feat(film): ByFilmView — Opens/Now/Closes group dispatcher

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Enable `by-film` in `ViewToggle`

**Files:**
- Modify: `web/app/[portal]/explore/film/_components/ViewToggle.tsx`
- Modify: `web/app/[portal]/explore/film/_components/__tests__/ViewToggle.test.tsx`

- [ ] **Step 1: Flip the `disabled` flag**

In `ViewToggle.tsx`, change the `OPTIONS` array — set `{ id: 'by-film', label: 'By Film', disabled: false }`. Leave `'schedule'` as `disabled: true`.

- [ ] **Step 2: Update the test expectations**

The existing test "disables By Film and Schedule (v1)" will now fail. Replace that test with:

```tsx
  it('disables only Schedule (v1 ships by-film)', () => {
    render(<ViewToggle view="by-theater" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /By Film/i }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: /Schedule/i }).hasAttribute('disabled')).toBe(true);
  });
```

Add one new test after that:

```tsx
  it('fires onChange("by-film") when By Film is clicked', () => {
    const onChange = vi.fn();
    render(<ViewToggle view="by-theater" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /By Film/i }));
    expect(onChange).toHaveBeenCalledWith('by-film');
  });
```

- [ ] **Step 3: Run — 5 tests pass**

`cd web && npx vitest run "app/[portal]/explore/film/_components/__tests__/ViewToggle.test.tsx"`
Expected: 5 passing (was 4, +1).

- [ ] **Step 4: Commit**

```bash
git add "web/app/[portal]/explore/film/_components/ViewToggle.tsx" "web/app/[portal]/explore/film/_components/__tests__/ViewToggle.test.tsx"
git commit -m "feat(film): enable By Film in ViewToggle

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 9: Wire `FilmExploreShell` to dispatch between views

**Files:**
- Modify: `web/app/[portal]/explore/film/_components/FilmExploreShell.tsx`

**Goal:** Add `byFilmData` + `byFilmLoading` state. When `view === 'by-film'` and `byFilmData === null` OR `selectedDate` changed while in by-film view, fetch `/api/film/by-film?portal=&date=`. Render `<ByFilmView>` when active; keep `<ByTheaterView>` as default. Empty `<ThisWeekZone>` behavior unchanged.

- [ ] **Step 1: Edit `FilmExploreShell.tsx`**

Apply these changes in order.

**Add imports at the top, alongside the existing imports:**

```tsx
import ByFilmView from './ByFilmView';
import type { ByFilmPayload } from '@/lib/film/types';
```

**Add new state alongside the existing `useState` calls:**

```tsx
  const [byFilm, setByFilm] = useState<ByFilmPayload | null>(null);
  const [byFilmLoading, setByFilmLoading] = useState(false);
```

**Add a helper fetcher inside the component (just below `handleDateSelect`):**

```tsx
  const fetchByFilm = useCallback(
    (date: string) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      setByFilmLoading(true);
      fetch(`/api/film/by-film?portal=${portalSlug}&date=${date}`, {
        signal: controller.signal,
      })
        .then((r) =>
          r.ok
            ? (r.json() as Promise<ByFilmPayload>)
            : Promise.reject(new Error(`HTTP ${r.status}`)),
        )
        .then((p) => setByFilm(p))
        .catch((err) => {
          if (err instanceof Error && err.name === 'AbortError') return;
          setByFilm({
            portal_slug: portalSlug,
            date,
            iso_week_start: '',
            iso_week_end: '',
            films: [],
            total_screenings: 0,
          });
        })
        .finally(() => {
          clearTimeout(timeoutId);
          setByFilmLoading(false);
        });
      return () => {
        clearTimeout(timeoutId);
        controller.abort();
      };
    },
    [portalSlug],
  );
```

**Replace the existing `void view;` placeholder + `<ByTheaterView>` render block with a view dispatcher:**

Find the current code:
```tsx
  // view is owned but only 'by-theater' ships a real view in this plan;
  // suppress unused-variable lint by referencing it in a render path guard.
  void view;
```

Replace with a `useEffect` that refetches on view or date change:

```tsx
  // Fetch by-film data when entering the view, and on date change while in it.
  useEffect(() => {
    if (view !== 'by-film') return;
    fetchByFilm(selectedDate);
  }, [view, selectedDate, fetchByFilm]);
```

Then find the render block at the bottom (the `<div className={loading ? …}>` wrapping `<ByTheaterView …>`) and replace with a view dispatcher:

```tsx
      <div className={(loading || byFilmLoading) ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
        {view === 'by-film' ? (
          byFilm ? (
            <ByFilmView payload={byFilm} filters={filters} portalSlug={portalSlug} />
          ) : (
            <div className="h-48 rounded-card-xl bg-[var(--night)] border border-[var(--twilight)] animate-pulse" />
          )
        ) : (
          <ByTheaterView playbill={playbill} filters={filters} portalSlug={portalSlug} />
        )}
      </div>
```

**Add `useEffect` to the existing `import` line:**
```tsx
import { useCallback, useEffect, useState } from 'react';
```

- [ ] **Step 2: Typecheck clean**

`cd web && npx tsc --noEmit`

- [ ] **Step 3: Full test suite**

`cd web && npx vitest run`
Expected: all prior tests still pass + new tests from Tasks 2-8.

- [ ] **Step 4: Commit**

```bash
git add "web/app/[portal]/explore/film/_components/FilmExploreShell.tsx"
git commit -m "feat(film): FilmExploreShell dispatches By Theater / By Film

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 10: Full suite + lint checkpoint

- [ ] **Step 1: Run everything**

```bash
cd web
npx tsc --noEmit
npx vitest run
npm run lint
```

Expected:
- tsc clean
- vitest all green (Plan 4 landed at 1158; this plan adds: 9 by-film-loader + 3 route + 4 EditorialGroupHeader + 6 FilmCard + 5 ByFilmView + 1 ViewToggle = **+28 new tests**. Target: ~1186.)
- lint: 0 errors (pre-existing warnings acceptable; no new warnings on new files)

- [ ] **Step 2: Fix any regressions**

If a Plan 4 test fails (e.g. ViewToggle test coverage changed), fix in place. Don't mask.

---

## Task 11: Push + draft PR for Vercel preview

- [ ] **Step 1: Pre-flight `vm_stat` + `lsof -i :3000`**

If memory tight or port bound: skip local verify — Vercel preview IS the verification.

- [ ] **Step 2: Push + draft PR**

```bash
git push -u origin feature/film-by-film-view

gh pr create --draft --title "feat(film): /explore/film By Film view (Opens/Now/Closes + playing-at matrix) — draft" --body "$(cat <<'EOF'
Draft for preview verification. Plan 6 (Schedule grid) is the next and final piece of the explore arc.

## Summary

Ships the By Film view on /{portal}/explore/film — every film showing in Atlanta on the selected date, grouped into OPENS THIS WEEK / NOW PLAYING / CLOSES THIS WEEK, each card showing a landscape still, editorial line, press quote, and a "Playing at" matrix (theater × showtime, format-tagged chips, standard-chain showings collapsed).

## What's included

- \`web/lib/film/by-film-loader.ts\` — classifyEditorialGroup + transposeToFilms pure helpers + loadByFilm Supabase wrapper (9 unit tests)
- \`web/app/api/film/by-film/route.ts\` — 3 route tests
- \`web/lib/film/types.ts\` — ByFilmPayload + FilmByFilmEntry + EditorialGroup
- \`web/app/[portal]/explore/film/_components/EditorialGroupHeader.tsx\` — 4 tests
- \`web/app/[portal]/explore/film/_components/FilmCard.tsx\` — 6 tests (landscape still, editorial block, playing-at matrix, standard-chain collapse)
- \`web/app/[portal]/explore/film/_components/ByFilmView.tsx\` — 5 tests
- \`ViewToggle\` — By Film enabled (+1 test)
- \`FilmExploreShell\` — view dispatcher, on-demand fetch, loading skeleton

+28 new tests · tsc clean · lint clean · full suite green

## Out of scope

- Plan 6: Schedule grid view
- Tier 3 opt-in (additional theaters)
- festival_id / is_one_night_only attributes on ByFilmEntry (payload omits them; filter predicates no-op for those two attributes on this view)
- URL-sync of view/date

## Test plan

- [ ] CI green
- [ ] Vercel preview: visit /atlanta/explore/film, click By Film toggle → view swaps; Opens/Now/Closes groups render when data warrants
- [ ] Click a showtime chip → /atlanta/showtimes/{slug}
- [ ] Click a theater name in the playing-at matrix → /atlanta/spots/{slug}
- [ ] Toggle premieres only → non-premiere films disappear
- [ ] Change date in the strip while in By Film view → refetches

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Wait for Vercel preview + validate-web**

Poll `gh pr checks <N>` until both are green.

---

## Task 12: Flip draft to ready + merge

- [ ] **Step 1: Verify green**

```bash
gh pr checks <PR-NUMBER>
```
Both `validate-web` and `Vercel` must be green.

- [ ] **Step 2: Mark ready + merge**

```bash
gh pr ready <PR-NUMBER>
gh pr merge <PR-NUMBER> --squash --admin
```

- [ ] **Step 3: Clean up**

```bash
cd /Users/coach/Projects/LostCity
git worktree remove .worktrees/film-by-film
git branch -D feature/film-by-film-view
```

- [ ] **Step 4: Return PR URL**

---

## Self-review notes

- **Spec coverage:**
  - §6.4 zone header (`BY FILM · TODAY · {date} · N FILMS` + italic subhead) → Task 7 `ByFilmView` header
  - §6.4 three editorial groups with gold/vibe/coral tones → Task 5 `EditorialGroupHeader`
  - §6.4 FilmCard layout (landscape 320×180 still + title + meta + editorial + press quote + playing-at matrix) → Task 6 `FilmCard`
  - §6.4 standard-showings collapse → Task 6 `FilmCard` + test 4
  - §7 filters are page-global, apply across all views → Task 7 `ByFilmView` reuses `FilmFilters`
  - §7 click-to-plan on chips, title → detail page → Task 6 `FilmCard` links
- **Out of scope called out explicitly:** `is_one_night_only` + `festival` filters no-op on this view since `FilmByFilmEntry` omits those fields (the loader SELECT doesn't fetch them). Flag in the PR body.
- **Type consistency:** `EditorialGroup`, `FilmByFilmEntry`, `ByFilmPayload`, `FormatToken` all sourced from `web/lib/film/types.ts`. `FilmVenue` reused from PR #35.
- **No placeholders.** Every code block is complete. `loadByFilm` stub in Task 2 is called out as intentional, replaced in Task 3.
- **Reuses shipped work:** `buildHeroTag` (PR #36), `FilterChip` (Plan 4), `EditorialGroupHeader` + `FilmCard` new but compose with shipped `SmartImage`/`Dot`/`buildSeriesUrl`/`buildSpotUrl`.
- **Browser verify gate:** Task 11 single-agent, Vercel preview preferred over local dev per memory-budget rule.
- **No motion task.** The cards inherit the shell's entrance transition. Hover lifts are baked into the chip styling already.
