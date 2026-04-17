# Film Editorial Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land Phase 1a of the film spec — schema additions, canonical Atlanta venue seed, editorial content seed, and the three film-specific API routes (`/api/film/this-week`, `/api/film/today-playbill`, `/api/film/schedule`) — so the Feed widget (Plan 3, future) and Explore page (Plan 4+, future) have real data to render.

**Architecture:**
- Supabase Postgres schema additions on `places`, `screening_titles`, `screening_runs` (no new tables — everything lives on existing screening entities)
- Display classification is **derived** (editorial / premium format / additional) from `programming_style` + `venue_formats` — never stored, avoids collision with PRD-040's `venue_tier`
- Three new Next.js API routes, each with a portal-scoped server loader returning typed payloads
- Seed migrations for canonical Atlanta venue list + initial editorial content (curator picks, blurbs, press quotes)

**Tech Stack:** Supabase (Postgres 16), Next.js 16 App Router, TypeScript, Vitest, Python crawlers (out of scope — Plan 2 handles format-label population)

**Spec:** `docs/superpowers/specs/2026-04-17-now-showing-and-explore-film-design.md`

**Out of scope (separate plans):**
- Crawler format extraction + new AMC venues → Plan 2 (Phase 1b, crawler-dev)
- Feed widget UI → Plan 3 (Phase 2)
- Explore page UI → Plans 4-6 (Phase 3a/b/c)

---

## File Structure

### Create
- `database/migrations/607_film_editorial_fields.sql` — schema additions (places + screening entities)
- `supabase/migrations/20260417120000_film_editorial_fields.sql` — supabase-track parity
- `database/migrations/608_film_venue_classification.sql` — canonical Atlanta venue seed
- `supabase/migrations/20260417120100_film_venue_classification.sql` — parity
- `database/migrations/609_film_editorial_seed.sql` — initial curator picks, blurbs, press quotes (JSON override committed as SQL)
- `supabase/migrations/20260417120200_film_editorial_seed.sql` — parity
- `web/lib/film/classification.ts` — pure derivation helpers (`classifyVenue`, hero cascade ranking)
- `web/lib/film/this-week-loader.ts` — server loader for `/api/film/this-week`
- `web/lib/film/today-playbill-loader.ts` — server loader for `/api/film/today-playbill`
- `web/lib/film/schedule-loader.ts` — server loader for `/api/film/schedule`
- `web/lib/film/types.ts` — shared payload types for all three routes
- `web/app/api/film/this-week/route.ts` — API route
- `web/app/api/film/today-playbill/route.ts` — API route
- `web/app/api/film/schedule/route.ts` — API route
- `web/lib/film/classification.test.ts` — unit tests for derivation helpers
- `web/app/api/film/this-week/route.test.ts`
- `web/app/api/film/today-playbill/route.test.ts`
- `web/app/api/film/schedule/route.test.ts`

### Modify
- `web/lib/supabase/types.ts` (or equivalent generated types path — verify before editing) — regenerate types after schema migrations land

### Not modified in this plan
- `web/components/feed/sections/NowShowingSection.tsx` — replaced by Plan 3
- Any crawler files — Plan 2 territory

---

## Task 1: Schema migrations for editorial fields

**Files:**
- Create: `database/migrations/607_film_editorial_fields.sql`
- Create: `supabase/migrations/20260417120000_film_editorial_fields.sql`

**Context the engineer needs:** The canonical approach is the scaffolding script at `database/create_migration_pair.py` which writes BOTH tracks. Run it, then fill in the SQL body. Both files must contain the same body unless there's a documented reason otherwise (see `database/CLAUDE.md`).

- [ ] **Step 1: Generate the migration pair**

Run:
```bash
python3 /Users/coach/Projects/LostCity/database/create_migration_pair.py film_editorial_fields
```

Expected: two empty files created at `database/migrations/607_film_editorial_fields.sql` and `supabase/migrations/YYYYMMDDHHMMSS_film_editorial_fields.sql`. Note the timestamp of the supabase file.

- [ ] **Step 2: Fill in the migration body (same content in both files)**

Write this SQL into both files:

```sql
-- ─── places: film programming + format capability ────────────────────────────
DO $$ BEGIN
  CREATE TYPE programming_style_enum AS ENUM
    ('repertory', 'indie', 'arthouse', 'drive_in', 'festival');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE places
  ADD COLUMN IF NOT EXISTS programming_style programming_style_enum,
  ADD COLUMN IF NOT EXISTS venue_formats TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS founding_year INTEGER;

COMMENT ON COLUMN places.programming_style IS
  'NULL = not an editorial programmer. Set for repertory, arthouse, drive-in, festival, and indie venues to trigger full Programmer''s Board treatment in /explore/film.';

COMMENT ON COLUMN places.venue_formats IS
  'Array of premium-format capability tokens: true_imax, imax, dolby_cinema, 4dx, screenx, rpx, 70mm, 35mm, atmos. Empty array = no premium formats (standard venue or editorial programmer without format specialization).';

COMMENT ON COLUMN places.founding_year IS
  'Displayed as gold accent on editorial program cards (e.g., "Plaza Theatre · 1939"). Set on places with programming_style.';

-- ─── screening_titles: editorial content + premiere flags ───────────────────
DO $$ BEGIN
  CREATE TYPE premiere_scope_enum AS ENUM ('atl', 'us', 'world');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE screening_titles
  ADD COLUMN IF NOT EXISTS editorial_blurb TEXT,
  ADD COLUMN IF NOT EXISTS film_press_quote TEXT,
  ADD COLUMN IF NOT EXISTS film_press_source TEXT,
  ADD COLUMN IF NOT EXISTS is_premiere BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS premiere_scope premiere_scope_enum;

COMMENT ON COLUMN screening_titles.editorial_blurb IS
  'One-line CM-written description reused across all runs of this film. Editorial voice (Programmer''s Board style), not marketing synopsis.';

COMMENT ON COLUMN screening_titles.film_press_quote IS
  'Optional press quote. Named film_* to distinguish from places.editorial_mentions which serves venue reviews.';

-- ─── screening_runs: per-week curator pick flag ─────────────────────────────
ALTER TABLE screening_runs
  ADD COLUMN IF NOT EXISTS is_curator_pick BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS curator_pick_week DATE;

COMMENT ON COLUMN screening_runs.is_curator_pick IS
  'CM-editable weekly pick. Primary editorial signal for the hero cascade in /api/film/this-week.';

COMMENT ON COLUMN screening_runs.curator_pick_week IS
  'ISO week Monday date. When set with is_curator_pick=true, pick is active for that week only. NULL + is_curator_pick=true = ongoing pick until cleared.';

-- ─── indexes for the new query surface ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_places_programming_style
  ON places (programming_style) WHERE programming_style IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_places_venue_formats
  ON places USING GIN (venue_formats);

CREATE INDEX IF NOT EXISTS idx_screening_runs_curator_pick_week
  ON screening_runs (curator_pick_week)
  WHERE is_curator_pick = TRUE;
```

- [ ] **Step 3: Apply the migration locally**

Run:
```bash
cd web && npx supabase db reset
```

Expected: migrations apply cleanly. Error messages about existing types should be suppressed by the `DO $$ BEGIN ... EXCEPTION` guards.

Verify columns exist:
```bash
cd web && npx supabase db diff
```

Expected: no diff (migration already applied).

- [ ] **Step 4: Run the parity audit**

Run:
```bash
python3 /Users/coach/Projects/LostCity/database/audit_migration_parity.py --fail-on-unmatched
```

Expected: exit 0. If unmatched, the two migration files have diverged — diff them and align.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/607_film_editorial_fields.sql \
  supabase/migrations/20260417*_film_editorial_fields.sql
git commit -m "feat(db): add film editorial fields to places, screening_titles, screening_runs"
```

---

## Task 2: Canonical Atlanta venue seed migration

**Files:**
- Create: `database/migrations/608_film_venue_classification.sql`
- Create: `supabase/migrations/20260417120100_film_venue_classification.sql`

**Context:** The canonical list is in the spec §4. Editorial programs get `programming_style`; premium format venues get `venue_formats`. AMC Mall of Georgia + North Point + Avenue Forsyth rows may not exist yet (they aren't crawled — Plan 2 adds them). Use INSERT ... ON CONFLICT DO UPDATE to handle both cases.

- [ ] **Step 1: Generate the migration pair**

```bash
python3 /Users/coach/Projects/LostCity/database/create_migration_pair.py film_venue_classification
```

- [ ] **Step 2: Fill in the SQL body (both files)**

```sql
-- Editorial programmers — set programming_style + founding_year
UPDATE places SET
  programming_style = 'repertory',
  venue_formats = '{70mm, 35mm}',
  founding_year = 1939
WHERE slug = 'plaza-theatre';

UPDATE places SET
  programming_style = 'repertory',
  venue_formats = '{70mm, 35mm}',
  founding_year = 1968
WHERE slug = 'tara-theatre';

UPDATE places SET
  programming_style = 'drive_in',
  venue_formats = '{}',
  founding_year = 1949
WHERE slug = 'starlight-six-drive-in';

UPDATE places SET
  programming_style = 'arthouse',
  venue_formats = '{atmos}'
WHERE slug = 'landmark-midtown-art-cinema';

UPDATE places SET
  programming_style = 'indie',
  venue_formats = '{atmos}'
WHERE slug = 'springs-cinema-and-taphouse';

-- Premium format venues — set venue_formats only
-- Some of these rows don't exist yet (Plan 2 adds them via crawler work).
-- Use INSERT ... ON CONFLICT to no-op when missing; the Plan 2 crawler inserts
-- will then backfill the format array on their first run via a trigger OR
-- these UPDATEs can be re-run after Plan 2 lands. For v1, UPDATE is sufficient
-- for rows that already exist.

UPDATE places SET venue_formats = '{true_imax, 70mm}'
WHERE slug = 'amc-mall-of-georgia-20';

UPDATE places SET venue_formats = '{imax, 4dx, rpx, screenx}'
WHERE slug = 'regal-atlantic-station';

UPDATE places SET venue_formats = '{dolby_cinema}'
WHERE slug = 'amc-north-point-mall-12';

UPDATE places SET venue_formats = '{dolby_cinema}'
WHERE slug = 'amc-avenue-forsyth-12';

UPDATE places SET venue_formats = '{dolby_cinema, imax}'
WHERE slug = 'amc-southlake-pavilion-24';

UPDATE places SET venue_formats = '{imax}'
WHERE slug = 'amc-phipps-plaza-14';

UPDATE places SET venue_formats = '{imax}'
WHERE slug = 'amc-barrett-commons-24';

UPDATE places SET venue_formats = '{imax}'
WHERE slug = 'amc-colonial-18';

UPDATE places SET venue_formats = '{imax, rpx}'
WHERE slug = 'regal-avalon';

UPDATE places SET venue_formats = '{atmos}'
WHERE slug = 'amc-parkway-pointe-15';

UPDATE places SET venue_formats = '{atmos}'
WHERE slug = 'amc-madison-yards-8';

-- Log the update result so we see which venues were missing from the DB
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT slug FROM (VALUES
      ('plaza-theatre'), ('tara-theatre'), ('starlight-six-drive-in'),
      ('landmark-midtown-art-cinema'), ('springs-cinema-and-taphouse'),
      ('amc-mall-of-georgia-20'), ('regal-atlantic-station'),
      ('amc-north-point-mall-12'), ('amc-avenue-forsyth-12'),
      ('amc-southlake-pavilion-24'), ('amc-phipps-plaza-14'),
      ('amc-barrett-commons-24'), ('amc-colonial-18'), ('regal-avalon'),
      ('amc-parkway-pointe-15'), ('amc-madison-yards-8')
    ) AS t(slug)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM places WHERE slug = r.slug) THEN
      RAISE NOTICE 'Film venue seed: place not found, skipped: %', r.slug;
    END IF;
  END LOOP;
END $$;
```

- [ ] **Step 3: Apply and verify**

Run:
```bash
cd web && npx supabase db reset
```

Expected: migrations apply; any missing-slug NOTICE messages are informational (Plan 2 creates those rows).

Verify:
```bash
cd web && npx supabase db diff
psql "$DATABASE_URL" -c "SELECT slug, programming_style, venue_formats, founding_year FROM places WHERE programming_style IS NOT NULL OR cardinality(venue_formats) > 0 ORDER BY slug;"
```

Expected: rows for seeded slugs show the classification. Missing slugs (Plan 2 territory) don't appear.

- [ ] **Step 4: Parity audit**

```bash
python3 /Users/coach/Projects/LostCity/database/audit_migration_parity.py --fail-on-unmatched
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/608_film_venue_classification.sql \
  supabase/migrations/20260417*_film_venue_classification.sql
git commit -m "feat(db): seed canonical Atlanta film venue classification"
```

---

## Task 3: Initial editorial content seed

**Files:**
- Create: `database/migrations/609_film_editorial_seed.sql`
- Create: `supabase/migrations/20260417120200_film_editorial_seed.sql`

**Context:** This is the "seeded JSON override" the spec calls for — committed SQL with 4 curator picks and 10 editorial blurbs. Without this, the hero cascade falls back to only opens-this-week / festival / closes-this-week and the strip is empty most weeks (architect risk #1).

The content below is illustrative seed data; it will be refreshed weekly by the CM team via new migrations (one per week) until an admin UI lands.

- [ ] **Step 1: Generate the migration pair**

```bash
python3 /Users/coach/Projects/LostCity/database/create_migration_pair.py film_editorial_seed
```

- [ ] **Step 2: Fill in the SQL body (both files)**

```sql
-- ─── Editorial blurbs on film titles ─────────────────────────────────────────
-- One-line CM-written descriptions; reused across all runs of each film.
-- Run matching by canonical_title + year where possible since tmdb_id is sparse.

UPDATE screening_titles SET
  editorial_blurb =
    'A feral, tender coming-of-age debut about a Brooklyn streamer and the voice on the other side of the paywall.',
  film_press_quote = '"A feral, tender debut."',
  film_press_source = 'Little White Lies',
  is_premiere = TRUE,
  premiere_scope = 'atl'
WHERE lower(canonical_title) = 'bunnylovr';

UPDATE screening_titles SET
  editorial_blurb =
    'Japanese survival horror in a subway passage that will not let you leave.'
WHERE lower(canonical_title) = 'exit 8';

UPDATE screening_titles SET
  editorial_blurb =
    'Ducournau''s latest — corporal, mythic, not remotely normal.',
  film_press_quote = '"A relentless fever dream."',
  film_press_source = 'IndieWire'
WHERE lower(canonical_title) = 'normal';

UPDATE screening_titles SET
  editorial_blurb =
    'Cassavetes'' bruised marriage study — improvised, smoke-stained, unshakeable.',
  film_press_quote = '"The marriage movie to end all marriage movies."',
  film_press_source = 'Metrograph Journal'
WHERE lower(canonical_title) = 'faces';

UPDATE screening_titles SET
  editorial_blurb =
    'Chris Smith''s backstage portrait of Lorne Michaels — fewer laughs than you''d expect, more weight.'
WHERE lower(canonical_title) = 'lorne';

UPDATE screening_titles SET
  editorial_blurb =
    'Jacir''s mandate-era epic, three decades in the making. The Palestine submission for Best International Feature.'
WHERE lower(canonical_title) = 'palestine ''36';

-- ─── Curator picks for the current ISO week ─────────────────────────────────
-- Pick the Monday of the current ISO week at migration time; CM refreshes
-- weekly by shipping a new migration.

DO $$
DECLARE
  v_week_monday DATE := date_trunc('week', CURRENT_DATE)::date;
BEGIN
  -- Bunnylovr premiere at Plaza
  UPDATE screening_runs r
  SET is_curator_pick = TRUE,
      curator_pick_week = v_week_monday
  FROM screening_titles t, places p
  WHERE r.screening_title_id = t.id
    AND r.place_id = p.id
    AND lower(t.canonical_title) = 'bunnylovr'
    AND p.slug = 'plaza-theatre'
    AND r.start_date <= v_week_monday + INTERVAL '6 days'
    AND r.end_date >= v_week_monday;

  -- Faces 35mm one-night-only at Tara
  UPDATE screening_runs r
  SET is_curator_pick = TRUE,
      curator_pick_week = v_week_monday
  FROM screening_titles t, places p
  WHERE r.screening_title_id = t.id
    AND r.place_id = p.id
    AND lower(t.canonical_title) = 'faces'
    AND p.slug = 'tara-theatre'
    AND r.start_date <= v_week_monday + INTERVAL '6 days'
    AND r.end_date >= v_week_monday;

  -- Normal drive-in premiere at Starlight
  UPDATE screening_runs r
  SET is_curator_pick = TRUE,
      curator_pick_week = v_week_monday
  FROM screening_titles t, places p
  WHERE r.screening_title_id = t.id
    AND r.place_id = p.id
    AND lower(t.canonical_title) = 'normal'
    AND p.slug = 'starlight-six-drive-in'
    AND r.start_date <= v_week_monday + INTERVAL '6 days'
    AND r.end_date >= v_week_monday;

  RAISE NOTICE 'Film curator picks seeded for week starting %', v_week_monday;
END $$;
```

- [ ] **Step 3: Apply and verify**

```bash
cd web && npx supabase db reset
psql "$DATABASE_URL" -c "SELECT canonical_title, editorial_blurb IS NOT NULL AS has_blurb, film_press_quote IS NOT NULL AS has_quote FROM screening_titles WHERE editorial_blurb IS NOT NULL ORDER BY canonical_title;"
psql "$DATABASE_URL" -c "SELECT t.canonical_title, p.slug AS venue, r.is_curator_pick, r.curator_pick_week FROM screening_runs r JOIN screening_titles t ON r.screening_title_id = t.id JOIN places p ON r.place_id = p.id WHERE r.is_curator_pick = TRUE ORDER BY r.curator_pick_week;"
```

Expected: 6 rows with editorial blurbs (4 with quotes). Up to 3 curator picks if the matching runs exist in the DB; fewer is OK if the crawlers haven't populated them yet — the migration logs a NOTICE but doesn't error.

- [ ] **Step 4: Parity audit + commit**

```bash
python3 /Users/coach/Projects/LostCity/database/audit_migration_parity.py --fail-on-unmatched
git add database/migrations/609_film_editorial_seed.sql \
  supabase/migrations/20260417*_film_editorial_seed.sql
git commit -m "feat(db): seed initial film editorial blurbs + curator picks"
```

---

## Task 4: Shared types for film API payloads

**Files:**
- Create: `web/lib/film/types.ts`

- [ ] **Step 1: Write the types file**

```typescript
// web/lib/film/types.ts
// Shared payload types for /api/film/* routes.

export type VenueClassification =
  | 'editorial_program'
  | 'premium_format'
  | 'additional';

export type ProgrammingStyle =
  | 'repertory'
  | 'indie'
  | 'arthouse'
  | 'drive_in'
  | 'festival';

export type FormatToken =
  | 'true_imax'
  | 'imax'
  | 'dolby_cinema'
  | '4dx'
  | 'screenx'
  | 'rpx'
  | '70mm'
  | '35mm'
  | 'atmos';

export type FilmVenue = {
  id: number;
  slug: string;
  name: string;
  neighborhood: string | null;
  classification: VenueClassification;
  programming_style: ProgrammingStyle | null;
  venue_formats: FormatToken[];
  founding_year: number | null;
  google_rating: number | null;
};

export type FilmScreening = {
  run_id: string;
  screening_title_id: string;
  title: string;
  slug: string;
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
  is_curator_pick: boolean;
  festival_id: string | null;
  festival_name: string | null;
  venue: FilmVenue;
  times: Array<{
    id: string;
    start_date: string; // ISO yyyy-mm-dd
    start_time: string | null; // HH:MM
    end_time: string | null;
    format_labels: FormatToken[];
    status: 'scheduled' | 'cancelled' | 'sold_out';
    ticket_url: string | null;
    event_id: number | null;
  }>;
};

export type HeroReason =
  | 'curator_pick'
  | 'opens_this_week'
  | 'festival'
  | 'special_format'
  | 'closes_this_week';

export type ThisWeekPayload = {
  portal_slug: string;
  iso_week_start: string; // yyyy-mm-dd Monday
  iso_week_end: string; // yyyy-mm-dd Sunday
  heroes: Array<FilmScreening & { hero_reason: HeroReason }>;
};

export type TodayPlaybillPayload = {
  portal_slug: string;
  date: string; // yyyy-mm-dd
  venues: Array<{
    venue: FilmVenue;
    screenings: FilmScreening[];
  }>;
  total_screenings: number;
};

export type SchedulePayload = {
  portal_slug: string;
  date: string;
  sunrise: string | null; // HH:MM
  sunset: string | null; // HH:MM
  venues: Array<{
    venue: FilmVenue;
    screenings: FilmScreening[];
  }>;
};
```

- [ ] **Step 2: Commit**

```bash
git add web/lib/film/types.ts
git commit -m "feat(film): shared API payload types"
```

---

## Task 5: Classification + hero cascade helpers (unit-tested)

**Files:**
- Create: `web/lib/film/classification.ts`
- Create: `web/lib/film/classification.test.ts`

**Context:** Display classification is derived, not stored. Hero-selection cascade is pure given input. Both are deterministic — unit test them directly.

- [ ] **Step 1: Write the failing tests**

```typescript
// web/lib/film/classification.test.ts
import { describe, it, expect } from 'vitest';
import {
  classifyVenue,
  rankHeroCandidates,
  type HeroCandidate,
} from './classification';

describe('classifyVenue', () => {
  it('returns editorial_program when programming_style is set', () => {
    expect(
      classifyVenue({ programming_style: 'repertory', venue_formats: [] }),
    ).toBe('editorial_program');
    expect(
      classifyVenue({ programming_style: 'drive_in', venue_formats: [] }),
    ).toBe('editorial_program');
  });

  it('returns premium_format when style is null but formats present', () => {
    expect(
      classifyVenue({ programming_style: null, venue_formats: ['true_imax'] }),
    ).toBe('premium_format');
    expect(
      classifyVenue({
        programming_style: null,
        venue_formats: ['imax', '4dx'],
      }),
    ).toBe('premium_format');
  });

  it('returns additional when neither style nor formats set', () => {
    expect(
      classifyVenue({ programming_style: null, venue_formats: [] }),
    ).toBe('additional');
  });

  it('prefers editorial_program even if venue also has formats', () => {
    expect(
      classifyVenue({
        programming_style: 'repertory',
        venue_formats: ['70mm'],
      }),
    ).toBe('editorial_program');
  });
});

describe('rankHeroCandidates', () => {
  const base = {
    is_curator_pick: false,
    festival_id: null,
    format_labels: [],
    first_date_in_week: false,
    last_date_in_week: false,
    one_night_only: false,
  };

  it('prioritizes curator picks over all else', () => {
    const picks = [
      { ...base, id: 'a', is_curator_pick: true },
      { ...base, id: 'b', first_date_in_week: true },
      { ...base, id: 'c', festival_id: 'atl-film-fest' },
    ] as HeroCandidate[];
    const ranked = rankHeroCandidates(picks);
    expect(ranked[0].id).toBe('a');
  });

  it('ranks opens-this-week above festival above closes-this-week', () => {
    const picks = [
      { ...base, id: 'close', last_date_in_week: true },
      { ...base, id: 'fest', festival_id: 'atl-film-fest' },
      { ...base, id: 'open', first_date_in_week: true },
    ] as HeroCandidate[];
    const ranked = rankHeroCandidates(picks);
    expect(ranked.map((p) => p.id)).toEqual(['open', 'fest', 'close']);
  });

  it('prefers special-format one-night-only over closes-this-week', () => {
    const picks = [
      { ...base, id: 'close', last_date_in_week: true },
      {
        ...base,
        id: 'special',
        one_night_only: true,
        format_labels: ['70mm'],
      },
    ] as HeroCandidate[];
    const ranked = rankHeroCandidates(picks);
    expect(ranked[0].id).toBe('special');
  });

  it('caps the result at three items', () => {
    const picks = Array.from({ length: 8 }, (_, i) => ({
      ...base,
      id: `p${i}`,
      is_curator_pick: true,
    })) as HeroCandidate[];
    expect(rankHeroCandidates(picks)).toHaveLength(3);
  });

  it('assigns the most specific hero_reason per candidate', () => {
    const picks = [
      {
        ...base,
        id: 'a',
        is_curator_pick: true,
        first_date_in_week: true,
      },
      { ...base, id: 'b', festival_id: 'atl-film-fest' },
    ] as HeroCandidate[];
    const ranked = rankHeroCandidates(picks);
    expect(ranked[0]).toMatchObject({ id: 'a', hero_reason: 'curator_pick' });
    expect(ranked[1]).toMatchObject({ id: 'b', hero_reason: 'festival' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd web && npx vitest run lib/film/classification.test.ts
```

Expected: FAIL with "cannot find module './classification'".

- [ ] **Step 3: Write the implementation**

```typescript
// web/lib/film/classification.ts
import type {
  VenueClassification,
  ProgrammingStyle,
  FormatToken,
  HeroReason,
} from './types';

export function classifyVenue(input: {
  programming_style: ProgrammingStyle | null;
  venue_formats: FormatToken[] | readonly FormatToken[];
}): VenueClassification {
  if (input.programming_style !== null) return 'editorial_program';
  if (input.venue_formats.length > 0) return 'premium_format';
  return 'additional';
}

export type HeroCandidate = {
  id: string;
  is_curator_pick: boolean;
  festival_id: string | null;
  format_labels: FormatToken[];
  first_date_in_week: boolean;
  last_date_in_week: boolean;
  one_night_only: boolean;
};

const SPECIAL_FORMATS: ReadonlySet<FormatToken> = new Set([
  'true_imax',
  '70mm',
  '4dx',
]);

function heroReasonFor(c: HeroCandidate): HeroReason {
  if (c.is_curator_pick) return 'curator_pick';
  if (c.first_date_in_week) return 'opens_this_week';
  if (c.festival_id) return 'festival';
  if (c.one_night_only && c.format_labels.some((f) => SPECIAL_FORMATS.has(f))) {
    return 'special_format';
  }
  return 'closes_this_week';
}

function heroPriority(c: HeroCandidate): number {
  if (c.is_curator_pick) return 0;
  if (c.first_date_in_week) return 1;
  if (c.festival_id) return 2;
  if (c.one_night_only && c.format_labels.some((f) => SPECIAL_FORMATS.has(f))) {
    return 3;
  }
  if (c.last_date_in_week) return 4;
  return 99;
}

export function rankHeroCandidates<T extends HeroCandidate>(
  candidates: T[],
): Array<T & { hero_reason: HeroReason }> {
  return candidates
    .filter((c) => heroPriority(c) < 99)
    .sort((a, b) => heroPriority(a) - heroPriority(b))
    .slice(0, 3)
    .map((c) => ({ ...c, hero_reason: heroReasonFor(c) }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd web && npx vitest run lib/film/classification.test.ts
```

Expected: all 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/film/classification.ts web/lib/film/classification.test.ts
git commit -m "feat(film): pure derivation helpers — classifyVenue + rankHeroCandidates"
```

---

## Task 6: Server loader for `/api/film/this-week`

**Files:**
- Create: `web/lib/film/this-week-loader.ts`

**Context:** This loader queries current-ISO-week screening runs for the portal, evaluates the hero cascade (using the `rankHeroCandidates` helper from Task 5), and returns a `ThisWeekPayload`. Respects portal isolation by joining through `places.portal_id` (verify on real data — spec §10 says every film API takes `p_portal_id`).

- [ ] **Step 1: Write the loader**

```typescript
// web/lib/film/this-week-loader.ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { resolvePortalQueryContext } from '@/lib/portal-query-context';
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

function isoWeekRange(now: Date): { start: string; end: string } {
  const d = new Date(now);
  const day = d.getUTCDay(); // 0 = Sunday
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

export async function loadThisWeek(args: {
  portalSlug: string;
  now?: Date;
}): Promise<ThisWeekPayload> {
  const supabase = await createClient();
  const ctx = await resolvePortalQueryContext(supabase, args.portalSlug);
  const week = isoWeekRange(args.now ?? new Date());

  // Pull runs within the current ISO week, scoped to the portal via place.portal_id.
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
        is_premiere, premiere_scope
      ),
      places!inner (
        id, slug, name, neighborhood, portal_id,
        programming_style, venue_formats, founding_year,
        place_vertical_details
      ),
      screening_times!inner (
        id, start_date, start_time, end_time, format_labels,
        status, ticket_url, event_id
      )
    `)
    .eq('places.portal_id', ctx.portalId)
    .gte('end_date', week.start)
    .lte('start_date', week.end)
    .order('start_date');

  if (error) throw new Error(`loadThisWeek query failed: ${error.message}`);

  const runs = (data ?? []) as Array<any>;

  // Build hero candidates with classification signals.
  const candidates: Array<HeroCandidate & { run: any }> = runs.map((r) => {
    const times = r.screening_times ?? [];
    const firstDate = times.reduce<string | null>(
      (acc: string | null, t: any) =>
        !acc || t.start_date < acc ? t.start_date : acc,
      null,
    );
    const lastDate = times.reduce<string | null>(
      (acc: string | null, t: any) =>
        !acc || t.start_date > acc ? t.start_date : acc,
      null,
    );
    const allFormatLabels: FormatToken[] = Array.from(
      new Set<FormatToken>(
        times.flatMap((t: any) => (t.format_labels ?? []) as FormatToken[]),
      ),
    );
    const isCuratorPickForThisWeek =
      r.is_curator_pick &&
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
        festival_name: null, // hydrated in a follow-up if we need the name
        venue: {
          id: p.id,
          slug: p.slug,
          name: p.name,
          neighborhood: p.neighborhood,
          classification: classifyVenue({
            programming_style: p.programming_style as ProgrammingStyle | null,
            venue_formats: p.venue_formats ?? [],
          }),
          programming_style: p.programming_style as ProgrammingStyle | null,
          venue_formats: (p.venue_formats ?? []) as FormatToken[],
          founding_year: p.founding_year,
          google_rating: p.place_vertical_details?.google?.rating ?? null,
        },
        times: (r.screening_times ?? []).map((st: any) => ({
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
```

- [ ] **Step 2: Commit**

```bash
git add web/lib/film/this-week-loader.ts
git commit -m "feat(film): server loader for this-week hero strip"
```

---

## Task 7: API route `/api/film/this-week` (tested)

**Files:**
- Create: `web/app/api/film/this-week/route.ts`
- Create: `web/app/api/film/this-week/route.test.ts`

- [ ] **Step 1: Write the failing route test**

```typescript
// web/app/api/film/this-week/route.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
  getClientIdentifier: vi.fn(),
  loadThisWeek: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: { read: { limit: 200, windowSec: 60 } },
  applyRateLimit: mocks.applyRateLimit,
  getClientIdentifier: mocks.getClientIdentifier,
}));

vi.mock('@/lib/film/this-week-loader', () => ({
  loadThisWeek: mocks.loadThisWeek,
}));

describe('GET /api/film/this-week', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyRateLimit.mockResolvedValue(null);
    mocks.getClientIdentifier.mockReturnValue('test-client');
  });

  it('returns 400 when portal param is missing', async () => {
    const { GET } = await import('@/app/api/film/this-week/route');
    const request = new NextRequest(
      'http://localhost:3000/api/film/this-week',
    );
    const response = await GET(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/portal/i);
  });

  it('delegates to loadThisWeek and returns payload', async () => {
    mocks.loadThisWeek.mockResolvedValue({
      portal_slug: 'atlanta',
      iso_week_start: '2026-04-13',
      iso_week_end: '2026-04-19',
      heroes: [],
    });

    const { GET } = await import('@/app/api/film/this-week/route');
    const request = new NextRequest(
      'http://localhost:3000/api/film/this-week?portal=atlanta',
    );
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(mocks.loadThisWeek).toHaveBeenCalledWith({ portalSlug: 'atlanta' });
    const body = await response.json();
    expect(body.portal_slug).toBe('atlanta');
  });

  it('returns 500 when loader throws', async () => {
    mocks.loadThisWeek.mockRejectedValue(new Error('db down'));
    const { GET } = await import('@/app/api/film/this-week/route');
    const request = new NextRequest(
      'http://localhost:3000/api/film/this-week?portal=atlanta',
    );
    const response = await GET(request);
    expect(response.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd web && npx vitest run app/api/film/this-week/route.test.ts
```

Expected: FAIL with cannot-find-module.

- [ ] **Step 3: Write the route**

```typescript
// web/app/api/film/this-week/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from '@/lib/rate-limit';
import { loadThisWeek } from '@/lib/film/this-week-loader';

export const revalidate = 300;

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const portal = new URL(request.url).searchParams.get('portal');
  if (!portal) {
    return NextResponse.json(
      { error: 'Missing required query param: portal' },
      { status: 400 },
    );
  }

  try {
    const payload = await loadThisWeek({ portalSlug: portal });
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
          error instanceof Error ? error.message : 'Failed to load this-week',
      },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: Verify tests pass**

```bash
cd web && npx vitest run app/api/film/this-week/route.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Smoke-test against the dev server with real data**

```bash
cd web && npm run dev &
sleep 5
curl -s "http://localhost:3000/api/film/this-week?portal=atlanta" | jq '.heroes | length'
kill %1
```

Expected: an integer (0-3). If 0, no curator picks / opens-this-week / etc. match against current data — check the §8.1 of the spec for realistic fill-rate caveats; this is not a failure. If the request errors, inspect the server log for the supabase query.

- [ ] **Step 6: Commit**

```bash
git add web/app/api/film/this-week/route.ts web/app/api/film/this-week/route.test.ts
git commit -m "feat(film): /api/film/this-week route + tests"
```

---

## Task 8: Server loader for `/api/film/today-playbill`

**Files:**
- Create: `web/lib/film/today-playbill-loader.ts`

**Context:** Returns screenings grouped by venue for a given date. Visibility rule: include all `editorial_program` venues and all `premium_format` venues that have screenings on the date. `additional` venues are excluded unless the caller explicitly opts them in via `includeAdditional` (reserved for when user preferences are wired up; for v1 always false).

- [ ] **Step 1: Write the loader**

```typescript
// web/lib/film/today-playbill-loader.ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { resolvePortalQueryContext } from '@/lib/portal-query-context';
import { classifyVenue } from './classification';
import type {
  FilmScreening,
  TodayPlaybillPayload,
  FormatToken,
  ProgrammingStyle,
} from './types';

export async function loadTodayPlaybill(args: {
  portalSlug: string;
  date: string; // yyyy-mm-dd
  includeAdditional?: boolean;
  additionalVenueIds?: number[];
}): Promise<TodayPlaybillPayload> {
  const supabase = await createClient();
  const ctx = await resolvePortalQueryContext(supabase, args.portalSlug);

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
          is_premiere, premiere_scope
        ),
        places!inner (
          id, slug, name, neighborhood, portal_id,
          programming_style, venue_formats, founding_year,
          place_vertical_details
        )
      )
    `)
    .eq('start_date', args.date)
    .eq('screening_runs.places.portal_id', ctx.portalId)
    .order('start_time');

  if (error) {
    throw new Error(`loadTodayPlaybill query failed: ${error.message}`);
  }

  const rows = (data ?? []) as Array<any>;

  // Group by venue, filtering classification.
  const byVenue = new Map<number, { venue: any; screenings: Map<string, FilmScreening> }>();
  const additionalSet = new Set(args.additionalVenueIds ?? []);

  for (const st of rows) {
    const r = st.screening_runs;
    const t = r.screening_titles;
    const p = r.places;
    const classification = classifyVenue({
      programming_style: p.programming_style as ProgrammingStyle | null,
      venue_formats: p.venue_formats ?? [],
    });

    const visible =
      classification !== 'additional' ||
      (args.includeAdditional === true && additionalSet.has(p.id));
    if (!visible) continue;

    let group = byVenue.get(p.id);
    if (!group) {
      group = {
        venue: {
          id: p.id,
          slug: p.slug,
          name: p.name,
          neighborhood: p.neighborhood,
          classification,
          programming_style: p.programming_style as ProgrammingStyle | null,
          venue_formats: (p.venue_formats ?? []) as FormatToken[],
          founding_year: p.founding_year,
          google_rating: p.place_vertical_details?.google?.rating ?? null,
        },
        screenings: new Map(),
      };
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
        is_curator_pick: r.is_curator_pick ?? false,
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

  // Sort: editorial_program first, then premium_format, then additional.
  const classOrder: Record<string, number> = {
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
```

- [ ] **Step 2: Commit**

```bash
git add web/lib/film/today-playbill-loader.ts
git commit -m "feat(film): server loader for today-playbill"
```

---

## Task 9: API route `/api/film/today-playbill` (tested)

**Files:**
- Create: `web/app/api/film/today-playbill/route.ts`
- Create: `web/app/api/film/today-playbill/route.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// web/app/api/film/today-playbill/route.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
  getClientIdentifier: vi.fn(),
  loadTodayPlaybill: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: { read: { limit: 200, windowSec: 60 } },
  applyRateLimit: mocks.applyRateLimit,
  getClientIdentifier: mocks.getClientIdentifier,
}));

vi.mock('@/lib/film/today-playbill-loader', () => ({
  loadTodayPlaybill: mocks.loadTodayPlaybill,
}));

describe('GET /api/film/today-playbill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyRateLimit.mockResolvedValue(null);
    mocks.getClientIdentifier.mockReturnValue('test-client');
  });

  it('returns 400 when portal is missing', async () => {
    const { GET } = await import('@/app/api/film/today-playbill/route');
    const response = await GET(
      new NextRequest('http://localhost:3000/api/film/today-playbill'),
    );
    expect(response.status).toBe(400);
  });

  it('returns 400 when date is invalid', async () => {
    const { GET } = await import('@/app/api/film/today-playbill/route');
    const response = await GET(
      new NextRequest(
        'http://localhost:3000/api/film/today-playbill?portal=atlanta&date=oops',
      ),
    );
    expect(response.status).toBe(400);
  });

  it('defaults date to today when omitted', async () => {
    mocks.loadTodayPlaybill.mockResolvedValue({
      portal_slug: 'atlanta',
      date: '2026-04-17',
      venues: [],
      total_screenings: 0,
    });
    const { GET } = await import('@/app/api/film/today-playbill/route');
    const response = await GET(
      new NextRequest(
        'http://localhost:3000/api/film/today-playbill?portal=atlanta',
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.loadTodayPlaybill).toHaveBeenCalled();
    const callArgs = mocks.loadTodayPlaybill.mock.calls[0][0];
    expect(callArgs.portalSlug).toBe('atlanta');
    expect(callArgs.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
```

- [ ] **Step 2: Verify failure**

```bash
cd web && npx vitest run app/api/film/today-playbill/route.test.ts
```

Expected: FAIL with cannot-find-module.

- [ ] **Step 3: Write the route**

```typescript
// web/app/api/film/today-playbill/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from '@/lib/rate-limit';
import { loadTodayPlaybill } from '@/lib/film/today-playbill-loader';

export const revalidate = 300;

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'Invalid date format. Use YYYY-MM-DD.' },
      { status: 400 },
    );
  }

  try {
    const payload = await loadTodayPlaybill({
      portalSlug: portal,
      date,
    });
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
          error instanceof Error
            ? error.message
            : 'Failed to load today playbill',
      },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: Verify tests pass**

```bash
cd web && npx vitest run app/api/film/today-playbill/route.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Smoke-test with real data**

```bash
cd web && npm run dev &
sleep 5
curl -s "http://localhost:3000/api/film/today-playbill?portal=atlanta" | jq '.total_screenings, (.venues | length)'
kill %1
```

Expected: two integers (total screenings count, number of venue groups). Real values depend on today's data — not a correctness check, just a sanity smoke test.

- [ ] **Step 6: Commit**

```bash
git add web/app/api/film/today-playbill/route.ts \
  web/app/api/film/today-playbill/route.test.ts
git commit -m "feat(film): /api/film/today-playbill route + tests"
```

---

## Task 10: Server loader for `/api/film/schedule`

**Files:**
- Create: `web/lib/film/schedule-loader.ts`

**Context:** Returns the same venue-grouped shape as today-playbill, but includes sunrise/sunset computed server-side for the Starlight Drive-In marker. Use the `suncalc` package if available, or fall back to a simple formula. Check `package.json` before adding new dependencies — if suncalc isn't installed yet, gate the sunset field to `null` for v1 and add a TODO comment; Plan 4 (Schedule view) will gate on it being present.

- [ ] **Step 1: Check for sun calculation library**

```bash
cd web && jq '.dependencies | keys[] | select(. | test("sun"; "i"))' package.json
```

Expected: either the name of an installed sun library (e.g., `suncalc`) or empty output. If empty, use `null` for sunrise/sunset and add a follow-up note.

- [ ] **Step 2: Write the loader**

```typescript
// web/lib/film/schedule-loader.ts
import 'server-only';
import { loadTodayPlaybill } from './today-playbill-loader';
import type { SchedulePayload } from './types';

// Atlanta coordinates — used when computing sunrise/sunset for the Schedule
// view's Starlight Drive-In row marker. If the portal has a canonical lat/lng
// at the portal level in future, swap this out. For v1 Atlanta is hard-coded.
const ATLANTA_LAT = 33.749;
const ATLANTA_LNG = -84.388;

async function computeSun(date: string): Promise<{
  sunrise: string | null;
  sunset: string | null;
}> {
  // v1: sun library not installed. Plan 4 (Schedule view) will either install
  // suncalc and fill this in, or use a server helper. For now, return nulls
  // and the UI gracefully hides the sunset marker.
  void ATLANTA_LAT;
  void ATLANTA_LNG;
  void date;
  return { sunrise: null, sunset: null };
}

export async function loadSchedule(args: {
  portalSlug: string;
  date: string;
  includeAdditional?: boolean;
  additionalVenueIds?: number[];
}): Promise<SchedulePayload> {
  const playbill = await loadTodayPlaybill(args);
  const sun = await computeSun(args.date);
  return {
    portal_slug: playbill.portal_slug,
    date: playbill.date,
    sunrise: sun.sunrise,
    sunset: sun.sunset,
    venues: playbill.venues,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add web/lib/film/schedule-loader.ts
git commit -m "feat(film): server loader for schedule view (sun placeholders)"
```

---

## Task 11: API route `/api/film/schedule` (tested)

**Files:**
- Create: `web/app/api/film/schedule/route.ts`
- Create: `web/app/api/film/schedule/route.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// web/app/api/film/schedule/route.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  applyRateLimit: vi.fn(),
  getClientIdentifier: vi.fn(),
  loadSchedule: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMITS: { read: { limit: 200, windowSec: 60 } },
  applyRateLimit: mocks.applyRateLimit,
  getClientIdentifier: mocks.getClientIdentifier,
}));

vi.mock('@/lib/film/schedule-loader', () => ({
  loadSchedule: mocks.loadSchedule,
}));

describe('GET /api/film/schedule', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyRateLimit.mockResolvedValue(null);
    mocks.getClientIdentifier.mockReturnValue('test-client');
  });

  it('returns 400 on missing portal', async () => {
    const { GET } = await import('@/app/api/film/schedule/route');
    const response = await GET(
      new NextRequest('http://localhost:3000/api/film/schedule'),
    );
    expect(response.status).toBe(400);
  });

  it('returns 400 on invalid date', async () => {
    const { GET } = await import('@/app/api/film/schedule/route');
    const response = await GET(
      new NextRequest(
        'http://localhost:3000/api/film/schedule?portal=atlanta&date=bad',
      ),
    );
    expect(response.status).toBe(400);
  });

  it('delegates to loadSchedule and returns payload', async () => {
    mocks.loadSchedule.mockResolvedValue({
      portal_slug: 'atlanta',
      date: '2026-04-17',
      sunrise: null,
      sunset: null,
      venues: [],
    });
    const { GET } = await import('@/app/api/film/schedule/route');
    const response = await GET(
      new NextRequest(
        'http://localhost:3000/api/film/schedule?portal=atlanta&date=2026-04-17',
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.loadSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ portalSlug: 'atlanta', date: '2026-04-17' }),
    );
  });
});
```

- [ ] **Step 2: Verify failure**

```bash
cd web && npx vitest run app/api/film/schedule/route.test.ts
```

Expected: FAIL with cannot-find-module.

- [ ] **Step 3: Write the route**

```typescript
// web/app/api/film/schedule/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from '@/lib/rate-limit';
import { loadSchedule } from '@/lib/film/schedule-loader';

export const revalidate = 300;

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: 'Invalid date format. Use YYYY-MM-DD.' },
      { status: 400 },
    );
  }

  try {
    const payload = await loadSchedule({
      portalSlug: portal,
      date,
    });
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
          error instanceof Error
            ? error.message
            : 'Failed to load schedule',
      },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 4: Verify tests pass**

```bash
cd web && npx vitest run app/api/film/schedule/route.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add web/app/api/film/schedule/route.ts web/app/api/film/schedule/route.test.ts
git commit -m "feat(film): /api/film/schedule route + tests"
```

---

## Task 12: Verify full plan — typecheck, test suite, and smoke-run

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

```bash
cd web && npx tsc --noEmit
```

Expected: 0 errors. If errors exist, fix them before declaring Phase 1a complete.

- [ ] **Step 2: Run the film-specific test subset**

```bash
cd web && npx vitest run lib/film app/api/film
```

Expected: all tests PASS. Report the count (should be 9 classification tests + 3 per route × 3 routes = 18 total).

- [ ] **Step 3: Lint**

```bash
cd web && npm run lint -- --max-warnings 0 app/api/film lib/film
```

Expected: 0 errors, 0 warnings on the new files.

- [ ] **Step 4: Migration parity audit**

```bash
python3 /Users/coach/Projects/LostCity/database/audit_migration_parity.py --fail-on-unmatched
```

Expected: exit 0.

- [ ] **Step 5: Smoke-run all three endpoints against real data**

```bash
cd web && npm run dev &
sleep 6
echo "=== this-week ==="
curl -s "http://localhost:3000/api/film/this-week?portal=atlanta" | jq '{heroes: (.heroes | length), start: .iso_week_start}'
echo "=== today-playbill ==="
curl -s "http://localhost:3000/api/film/today-playbill?portal=atlanta" | jq '{total: .total_screenings, venues: (.venues | length)}'
echo "=== schedule ==="
curl -s "http://localhost:3000/api/film/schedule?portal=atlanta" | jq '{sunset: .sunset, venues: (.venues | length)}'
kill %1
```

Expected:
- `this-week`: returns 0-3 heroes (limited by curator picks + cascade)
- `today-playbill`: returns a venue count and total; non-zero if any indie has a screening today
- `schedule`: same venue count as today-playbill, `sunset: null` (Plan 4 fills this)

If all three return shapes without HTTP errors, Phase 1a is landed.

- [ ] **Step 6: Final commit**

```bash
git commit --allow-empty -m "chore(film): Phase 1a complete — schema, seed, APIs, tests landed"
```

---

## Self-review checklist (for the engineer executing)

Before declaring this plan complete:

- [ ] All 12 tasks show all steps checked
- [ ] `npx tsc --noEmit` clean
- [ ] All film tests pass
- [ ] Migration parity audit passes
- [ ] All three endpoints return valid JSON against `portal=atlanta`
- [ ] No crawler files were modified (that's Plan 2)
- [ ] No UI component files were modified (that's Plans 3+)
- [ ] `screening_titles.director` / `runtime_minutes` / `year` / `rating` fields referenced in the loaders were verified to exist before this plan started — if any are actually missing from the live schema, flag it, stop, and update this plan rather than silently coercing

---

## What this plan does NOT deliver

Called out for clarity so the next plan scope is tight:

- **Crawler format extraction** — Plan 2 populates `screening_times.format_labels` by editing Regal/AMC/Plaza/Tara crawlers and adding AMC Mall of Georgia + North Point + Avenue Forsyth to the AMC crawler's LOCATIONS list. Until Plan 2 lands, `format_labels` in API payloads are empty arrays and the "True IMAX" signal in the UI collapses to showing the venue-level `venue_formats` only.
- **Feed widget UI** — Plan 3 (Phase 2) replaces `web/components/feed/sections/NowShowingSection.tsx` with the new two-tier widget consuming `/api/film/this-week` and `/api/film/today-playbill`.
- **`/atlanta/explore/film` page** — Plans 4-6 (Phase 3a/b/c) build page shell + This Week + By Theater view (3a), Schedule view (3b), and chain opt-in persistence (3c).
- **CM editing UI for curator picks** — deferred; weekly picks ship as SQL migrations until an admin surface lands.
- **Sun calculation** — `sunrise`/`sunset` hard-coded `null`; Plan 4 addresses this.
- **TMDB backfill for chain films** — out of scope; grid cells with missing runtime use a 110-min nominal width (Plan 4 fallback).
