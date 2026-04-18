# Music Phase 1 — Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the data foundation for the music redesign — schema additions on `places` + `events`, canonical Atlanta music-venue seed, residency reclassification + editorial seed, ghost-venue + dedupe hygiene, music genre bucket map, seven portal-scoped API routes, and `getCardTier()` extension — so Plans 2 (Feed widget) and 3a (Explore page) can render real data when they ship.

**Architecture:**
- Schema additions on `places` (`music_programming_style`, `music_venue_formats`, `capacity`) and `events` (`is_curator_pick`). No new tables.
- Display classification (editorial / marquee / additional) is **derived** at query time from the two stored place fields; never stored.
- Seven Next.js API routes, each with a typed server loader enforcing portal isolation via the existing `applyManifestFederatedScopeToQuery` pipeline. Shared types in `web/lib/music/types.ts`.
- `getCardTier()` extended to recognize `is_curator_pick` as a hero-forcing input — one source of truth for ranking; widget queries `card_tier='hero' AND category_id='music'`.
- Residencies use the existing `series` table with a new `series_type='residency'` value (no schema change). Phase 1 reclassifies ~20 rows via migration.
- Ghost-venue policy: seeded tier venues MUST produce events within last 14 days or they're excluded.

**Tech Stack:** Supabase Postgres 16, Next.js 16 App Router, TypeScript, Vitest, Python crawlers (one crawler task for doors_time extraction extension).

**Spec:** `docs/superpowers/specs/2026-04-17-live-music-feed-and-explore-design.md`

**Out of scope (separate plans):**
- Feed widget UI → Plan 2
- `/explore/music` page UI → Plan 3a
- Festivals-on-horizon UI → Plan 3b
- Just-announced / on-sale UI → Plan 3c
- Artist pages redesign → deferred, existing `/artists/[slug]` reused as-is

---

## File Structure

### Create
- `database/migrations/610_music_venue_tiering.sql` — places schema additions (music_programming_style enum, music_venue_formats, capacity)
- `supabase/migrations/<ts>_music_venue_tiering.sql` — parity
- `database/migrations/611_events_curator_pick.sql` — `is_curator_pick` column on events
- `supabase/migrations/<ts>_events_curator_pick.sql` — parity
- `database/migrations/612_music_venue_classification_seed.sql` — 15 canonical venues seeded with tier data
- `supabase/migrations/<ts>_music_venue_classification_seed.sql` — parity
- `database/migrations/613_music_residency_reclassification.sql` — ~20 `recurring_show` → `residency` + editorial blurbs on `series.description`
- `supabase/migrations/<ts>_music_residency_reclassification.sql` — parity
- `database/migrations/614_music_place_dedupe.sql` — consolidates Terminal West × 2 + Fox Theatre × 2 (or marks duplicates inactive)
- `supabase/migrations/<ts>_music_place_dedupe.sql` — parity
- `web/lib/music/types.ts` — shared payload types
- `web/lib/music/genre-map.ts` — specific-tag → broad-bucket mapping
- `web/lib/music/genre-map.test.ts` — tests
- `web/lib/music/classification.ts` — pure derivation helpers (`classifyMusicVenue`, `capacityBand`, hero cascade ranker)
- `web/lib/music/classification.test.ts` — tests
- `web/lib/music/this-week-loader.ts` — server loader
- `web/lib/music/tonight-loader.ts` — server loader
- `web/lib/music/by-venue-loader.ts` — server loader
- `web/lib/music/by-show-loader.ts` — server loader
- `web/lib/music/residencies-loader.ts` — server loader
- `web/lib/music/festivals-horizon-loader.ts` — server loader
- `web/lib/music/on-sale-loader.ts` — server loader
- `web/app/api/music/this-week/route.ts`
- `web/app/api/music/tonight/route.ts`
- `web/app/api/music/by-venue/route.ts`
- `web/app/api/music/by-show/route.ts`
- `web/app/api/music/residencies/route.ts`
- `web/app/api/music/festivals-horizon/route.ts`
- `web/app/api/music/on-sale/route.ts`
- `web/app/api/music/this-week/route.test.ts`
- `web/app/api/music/tonight/route.test.ts`
- `web/app/api/music/by-venue/route.test.ts`
- `web/app/api/music/by-show/route.test.ts`
- `web/app/api/music/residencies/route.test.ts`
- `web/app/api/music/festivals-horizon/route.test.ts`
- `web/app/api/music/on-sale/route.test.ts`

### Modify
- `web/lib/city-pulse/tier-assignment.ts` — extend `TierableEvent` interface + `computeIntrinsicScore` for `is_curator_pick`
- `web/lib/city-pulse/tier-assignment.test.ts` — add tests for new input
- `crawlers/sources/terminal_west.py` (+ Variety, Tabernacle, Eastern, City Winery, Eddie's Attic, Red Light, 529, Earl, Center Stage, Masquerade, Buckhead Theatre) — extend doors_time extraction for Tier-1 venues
- `web/lib/supabase/database.types.ts` — regenerate after migrations land (run `supabase gen types`)

### Not modified in this plan
- `web/components/feed/sections/MusicTabContent.tsx` — replaced by Plan 2
- Any explore page routes — Plan 3a territory

---

## Task 1: Schema — places tiering columns

**Files:**
- Create: `database/migrations/610_music_venue_tiering.sql`
- Create: `supabase/migrations/<ts>_music_venue_tiering.sql`

**Context:** Two migration tracks must carry the same body. Use `database/create_migration_pair.py` to scaffold both. See `database/CLAUDE.md` for parity rules.

- [ ] **Step 1: Generate the migration pair**

Run:
```bash
python3 /Users/coach/Projects/LostCity/database/create_migration_pair.py music_venue_tiering
```

Expected: two files created at `database/migrations/610_music_venue_tiering.sql` and `supabase/migrations/<timestamp>_music_venue_tiering.sql`.

- [ ] **Step 2: Write the SQL body (identical in both files)**

```sql
-- Music programming style enum — intentionally separate from a future
-- film_programming_style to allow multi-role venues (Star Community Bar,
-- Eddie's Attic, Eyedrum) to carry both roles without semantic overload.
DO $$ BEGIN
  CREATE TYPE music_programming_style_enum AS ENUM
    ('listening_room', 'curated_indie', 'jazz_club', 'dj_electronic', 'drive_in_amph');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE places
  ADD COLUMN IF NOT EXISTS music_programming_style music_programming_style_enum,
  ADD COLUMN IF NOT EXISTS music_venue_formats text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS capacity integer;

-- Derived-classification helpers expect these indexes for fast filtering.
CREATE INDEX IF NOT EXISTS idx_places_music_programming_style
  ON places (music_programming_style)
  WHERE music_programming_style IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_places_capacity_desc
  ON places (capacity DESC NULLS LAST)
  WHERE capacity IS NOT NULL;

COMMENT ON COLUMN places.music_programming_style IS
  'Editorial programming identity for music venues. NULL = not an editorial music venue. Distinct from a future film_programming_style to allow multi-role venues.';

COMMENT ON COLUMN places.music_venue_formats IS
  'Posture tags for music venues: listening_room, standing_room, outdoor, seated, dj_booth, arena, lawn, amphitheater. Parallels films venue_formats.';

COMMENT ON COLUMN places.capacity IS
  'Raw room capacity. Display band (intimate/club/theater/arena) derived in TS.';
```

- [ ] **Step 3: Apply the migration locally**

Run:
```bash
cd /Users/coach/Projects/LostCity && npx supabase db reset --local
```

Expected: migrations replay cleanly; no errors.

- [ ] **Step 4: Verify columns exist**

Run:
```bash
psql "$(npx supabase status -o json | jq -r '.DB_URL')" -c "\d places" | grep -E "music_programming_style|music_venue_formats|capacity"
```

Expected: three lines showing the new columns with their types.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/610_music_venue_tiering.sql supabase/migrations/*_music_venue_tiering.sql
git commit -m "feat(db): add music_programming_style, music_venue_formats, capacity on places"
```

---

## Task 2: Schema — events.is_curator_pick

**Files:**
- Create: `database/migrations/611_events_curator_pick.sql`
- Create: `supabase/migrations/<ts>_events_curator_pick.sql`

- [ ] **Step 1: Generate the migration pair**

```bash
python3 /Users/coach/Projects/LostCity/database/create_migration_pair.py events_curator_pick
```

- [ ] **Step 2: Write the SQL body**

```sql
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS is_curator_pick boolean NOT NULL DEFAULT false;

-- Partial index — curator picks are a tiny fraction of events.
CREATE INDEX IF NOT EXISTS idx_events_curator_pick
  ON events (start_date, portal_id)
  WHERE is_curator_pick = true;

COMMENT ON COLUMN events.is_curator_pick IS
  'Weekly editorial flag. True when CM has selected this event as a curator pick for the current week. Primary input to getCardTier hero tier for music surfaces.';
```

- [ ] **Step 3: Apply + verify + commit**

```bash
cd /Users/coach/Projects/LostCity && npx supabase db reset --local
psql "$(npx supabase status -o json | jq -r '.DB_URL')" -c "\d events" | grep is_curator_pick
# Expected: one line: is_curator_pick | boolean | not null default false

git add database/migrations/611_events_curator_pick.sql supabase/migrations/*_events_curator_pick.sql
git commit -m "feat(db): add events.is_curator_pick for music editorial cascade"
```

---

## Task 3: Audit + dedupe duplicate place records

**Files:**
- Create: `database/migrations/614_music_place_dedupe.sql`
- Create: `supabase/migrations/<ts>_music_place_dedupe.sql`

**Context:** Data review flagged `terminal-west` vs `terminal-west-test` and `Fox Theatre` vs `Fox Theatre - Atlanta` as duplicates. By-venue queries must not show empty ghost rows. Policy: pick the row with more events as canonical; merge event FKs; mark dupe `is_active=false`.

- [ ] **Step 1: Audit duplicates interactively (run query first, save output)**

```bash
psql "$(npx supabase status -o json | jq -r '.DB_URL')" -c "
  SELECT
    lower(regexp_replace(name, '\s*[-–]\s*Atlanta$', '', 'g')) AS canon_name,
    array_agg(id ORDER BY id) AS ids,
    array_agg(slug ORDER BY id) AS slugs,
    array_agg((SELECT count(*) FROM events WHERE place_id = places.id) ORDER BY id) AS event_counts
  FROM places
  WHERE place_type IN ('music_venue', 'bar', 'restaurant')
  GROUP BY canon_name
  HAVING count(*) > 1
  ORDER BY canon_name;
"
```

Expected: rows showing grouped duplicates. Save the output — you'll cite specific IDs in the migration.

- [ ] **Step 2: Write the dedupe migration**

Generate the pair first, then fill in with the canonical/dupe IDs from Step 1. Template:

```sql
-- Dedupe Terminal West (canonical keeps more events)
-- Replace `<canon_id>` / `<dupe_id>` with IDs from Step 1 audit.
-- Pattern repeats for each duplicate group.

DO $$
DECLARE
  v_canon_id integer := <canon_id>;
  v_dupe_id integer := <dupe_id>;
BEGIN
  IF v_canon_id IS NULL OR v_dupe_id IS NULL THEN
    RAISE EXCEPTION 'Dedupe migration requires both IDs set';
  END IF;

  -- Reparent events pointing at the duplicate.
  UPDATE events SET place_id = v_canon_id WHERE place_id = v_dupe_id;

  -- Reparent child places (if any).
  UPDATE places SET parent_place_id = v_canon_id WHERE parent_place_id = v_dupe_id;

  -- Mark the duplicate inactive (do not DELETE — preserve history + FK safety).
  UPDATE places SET is_active = false,
                    slug = slug || '-dupe-' || v_dupe_id,
                    name = name || ' [DEDUPED]'
  WHERE id = v_dupe_id;
END $$;

-- Repeat block for Fox Theatre, and any others from the Step 1 audit output.
```

- [ ] **Step 3: Apply + verify**

```bash
cd /Users/coach/Projects/LostCity && npx supabase db reset --local

# Verify no active duplicates remain:
psql "$(npx supabase status -o json | jq -r '.DB_URL')" -c "
  SELECT lower(regexp_replace(name, '\s*[-–]\s*Atlanta$', '', 'g')) AS canon,
         count(*) AS active_count
  FROM places
  WHERE is_active = true AND place_type IN ('music_venue', 'bar', 'restaurant')
  GROUP BY canon HAVING count(*) > 1;
"
```

Expected: zero rows.

- [ ] **Step 4: Commit**

```bash
git add database/migrations/614_music_place_dedupe.sql supabase/migrations/*_music_place_dedupe.sql
git commit -m "feat(db): dedupe Terminal West + Fox Theatre place records"
```

---

## Task 4: Seed canonical music venue classification

**Files:**
- Create: `database/migrations/612_music_venue_classification_seed.sql`
- Create: `supabase/migrations/<ts>_music_venue_classification_seed.sql`

**Context:** Seeds 15 Atlanta music venues with `music_programming_style`, `music_venue_formats`, and `capacity`. See spec §3 for the canonical list. Ghost-venue policy enforced by test (Task 9). Do NOT seed Blind Willie's, Knock Music House, Apache, or REVERB until their sources are reactivated — they're named in spec §12 risk #3.

- [ ] **Step 1: Generate the migration pair**

```bash
python3 /Users/coach/Projects/LostCity/database/create_migration_pair.py music_venue_classification_seed
```

- [ ] **Step 2: Write the SQL body**

```sql
-- Canonical Atlanta music-venue tier seed.
-- See docs/superpowers/specs/2026-04-17-live-music-feed-and-explore-design.md §3.
-- Editorial: music_programming_style set. Marquee: style NULL + capacity >= 1000.

-- ═══ EDITORIAL ════════════════════════════════════════════════════════════
UPDATE places SET
  music_programming_style = 'listening_room',
  music_venue_formats = ARRAY['listening_room', 'seated']::text[],
  capacity = 200
WHERE slug = 'eddies-attic' AND is_active = true;

UPDATE places SET
  music_programming_style = 'listening_room',
  music_venue_formats = ARRAY['listening_room', 'seated']::text[],
  capacity = 100
WHERE slug = 'red-light-cafe' AND is_active = true;

UPDATE places SET
  music_programming_style = 'listening_room',
  music_venue_formats = ARRAY['listening_room', 'seated']::text[],
  capacity = 300
WHERE slug = 'city-winery-atlanta' AND is_active = true;

UPDATE places SET
  music_programming_style = 'curated_indie',
  music_venue_formats = ARRAY['standing_room', 'seated']::text[],
  capacity = 300
WHERE slug = 'smiths-olde-bar' AND is_active = true;

UPDATE places SET
  music_programming_style = 'curated_indie',
  music_venue_formats = ARRAY['standing_room']::text[],
  capacity = 600
WHERE slug = 'terminal-west' AND is_active = true;

UPDATE places SET
  music_programming_style = 'curated_indie',
  music_venue_formats = ARRAY['seated', 'standing_room']::text[],
  capacity = 1050
WHERE slug = 'variety-playhouse' AND is_active = true;

UPDATE places SET
  music_programming_style = 'curated_indie',
  music_venue_formats = ARRAY['standing_room']::text[],
  capacity = 300
WHERE slug = 'the-earl' AND is_active = true;

UPDATE places SET
  music_programming_style = 'curated_indie',
  music_venue_formats = ARRAY['standing_room']::text[],
  capacity = 150
WHERE slug = '529' AND is_active = true;

UPDATE places SET
  music_programming_style = 'curated_indie',
  music_venue_formats = ARRAY['standing_room']::text[],
  capacity = 200
WHERE slug = 'star-community-bar' AND is_active = true;

UPDATE places SET
  music_programming_style = 'curated_indie',
  music_venue_formats = ARRAY['standing_room']::text[],
  capacity = 400
WHERE slug = 'aisle-5' AND is_active = true;

UPDATE places SET
  music_programming_style = 'curated_indie',
  music_venue_formats = ARRAY['standing_room']::text[],
  capacity = 500
WHERE slug LIKE 'masquerade%' AND is_active = true;

UPDATE places SET
  music_programming_style = 'dj_electronic',
  music_venue_formats = ARRAY['dj_booth', 'standing_room']::text[],
  capacity = 300
WHERE slug = 'mjq-concourse' AND is_active = true;

UPDATE places SET
  music_programming_style = 'dj_electronic',
  music_venue_formats = ARRAY['dj_booth', 'standing_room']::text[],
  capacity = 400
WHERE slug = 'the-bakery' AND is_active = true;

-- ═══ MARQUEE (style NULL, capacity set to promote them in derivation) ═════
UPDATE places SET
  capacity = 2600,
  music_venue_formats = ARRAY['standing_room', 'seated']::text[]
WHERE slug = 'tabernacle-atlanta' AND is_active = true AND music_programming_style IS NULL;

UPDATE places SET
  capacity = 2200,
  music_venue_formats = ARRAY['standing_room', 'seated']::text[]
WHERE slug = 'the-eastern' AND is_active = true AND music_programming_style IS NULL;

UPDATE places SET
  capacity = 1800,
  music_venue_formats = ARRAY['standing_room', 'seated']::text[]
WHERE slug = 'buckhead-theatre' AND is_active = true AND music_programming_style IS NULL;

UPDATE places SET
  capacity = 3600,
  music_venue_formats = ARRAY['standing_room', 'seated']::text[]
WHERE slug = 'coca-cola-roxy' AND is_active = true AND music_programming_style IS NULL;

UPDATE places SET
  capacity = 1050,
  music_venue_formats = ARRAY['seated', 'standing_room']::text[]
WHERE slug = 'center-stage-atlanta' AND is_active = true AND music_programming_style IS NULL;

UPDATE places SET
  capacity = 4665,
  music_venue_formats = ARRAY['seated']::text[]
WHERE slug = 'fox-theatre' AND is_active = true AND music_programming_style IS NULL;

UPDATE places SET
  capacity = 21000,
  music_venue_formats = ARRAY['arena', 'seated']::text[]
WHERE slug = 'state-farm-arena' AND is_active = true AND music_programming_style IS NULL;

UPDATE places SET
  capacity = 19000,
  music_venue_formats = ARRAY['outdoor', 'seated', 'lawn']::text[]
WHERE slug = 'cadence-bank-amphitheatre-lakewood' AND is_active = true AND music_programming_style IS NULL;

UPDATE places SET
  capacity = 12000,
  music_venue_formats = ARRAY['outdoor', 'seated', 'lawn']::text[]
WHERE slug = 'ameris-bank-amphitheatre' AND is_active = true AND music_programming_style IS NULL;

UPDATE places SET
  capacity = 2400,
  music_venue_formats = ARRAY['standing_room']::text[]
WHERE slug = 'believe-music-hall' AND is_active = true AND music_programming_style IS NULL;
```

- [ ] **Step 3: Slug reality check**

Run:
```bash
psql "$(npx supabase status -o json | jq -r '.DB_URL')" -c "
  SELECT slug, name, is_active FROM places
  WHERE slug IN (
    'eddies-attic','red-light-cafe','city-winery-atlanta','smiths-olde-bar',
    'terminal-west','variety-playhouse','the-earl','529','star-community-bar',
    'aisle-5','mjq-concourse','the-bakery','tabernacle-atlanta','the-eastern',
    'buckhead-theatre','coca-cola-roxy','center-stage-atlanta','fox-theatre',
    'state-farm-arena','cadence-bank-amphitheatre-lakewood','ameris-bank-amphitheatre',
    'believe-music-hall'
  )
  ORDER BY slug;
"
```

Expected: ~20 rows (Masquerade may have multiple sub-slugs; verify). **If any slug is missing, STOP** — check the actual `places.slug` for that venue and correct the migration before applying. The migration is `WHERE slug = ...`; silent-no-match is a real failure mode.

- [ ] **Step 4: Apply + verify the tier counts**

```bash
cd /Users/coach/Projects/LostCity && npx supabase db reset --local

# Editorial count:
psql "$(npx supabase status -o json | jq -r '.DB_URL')" -c "
  SELECT count(*) FROM places
  WHERE music_programming_style IS NOT NULL AND is_active = true;
"
# Expected: 13-15 depending on Masquerade match

# Marquee count:
psql "$(npx supabase status -o json | jq -r '.DB_URL')" -c "
  SELECT count(*) FROM places
  WHERE music_programming_style IS NULL AND capacity >= 1000 AND is_active = true;
"
# Expected: 10
```

- [ ] **Step 5: Commit**

```bash
git add database/migrations/612_music_venue_classification_seed.sql supabase/migrations/*_music_venue_classification_seed.sql
git commit -m "feat(db): seed 15+ Atlanta music venues with tier classification"
```

---

## Task 5: Reclassify residencies + seed editorial blurbs

**Files:**
- Create: `database/migrations/613_music_residency_reclassification.sql`
- Create: `supabase/migrations/<ts>_music_residency_reclassification.sql`

**Context:** 0 rows currently have `series_type='residency'`. The spec targets ~10 seeded residencies. `series.description` carries the editorial blurb (no new column). Identify candidates via `frequency='weekly' AND category='music' AND is_active=true`.

- [ ] **Step 1: Audit residency candidates**

```bash
psql "$(npx supabase status -o json | jq -r '.DB_URL')" -c "
  SELECT s.id, s.title, s.slug, s.category, s.frequency, s.day_of_week,
         s.series_type,
         (SELECT count(*) FROM events e WHERE e.series_id = s.id) AS event_count,
         (SELECT array_agg(DISTINCT p.name)
          FROM events e JOIN places p ON p.id = e.place_id
          WHERE e.series_id = s.id) AS venues
  FROM series s
  WHERE s.frequency = 'weekly'
    AND s.category = 'music'
    AND s.is_active = true
  ORDER BY event_count DESC
  LIMIT 30;
"
```

Save the output. You need at least 10 real residencies; take the top by event_count with non-generic titles (skip "Karaoke Night", "Open Mic Wednesday" unless they're actually Atlanta institutions).

- [ ] **Step 2: Write the reclassification migration (fill in real IDs)**

```sql
-- Reclassify top-N weekly music series as residencies.
-- Editorial blurbs seeded inline on series.description.
-- Replace <id> placeholders with real IDs from Step 1 audit.

UPDATE series
SET series_type = 'residency',
    description = 'Songwriter-in-the-round since 1993. Audience quiet. Signing up is an honor.'
WHERE slug = 'songwriter-round' OR id = '<eddies_songwriter_round_id>';

UPDATE series
SET series_type = 'residency',
    description = 'Yacht Rock Revue — 70s and 80s smooth hits, every Friday.'
WHERE slug = 'yacht-rock-revue-park-tavern' OR id = '<yacht_rock_id>';

-- Pattern repeats for each of the 10 residencies. Use UUID from Step 1 audit.
-- Spec §2 lists target residencies; adapt to actual data.
--
-- Template for each:
-- UPDATE series SET series_type = 'residency', description = '<blurb>'
-- WHERE id = '<uuid_from_audit>';

-- Index to make residency-query fast:
CREATE INDEX IF NOT EXISTS idx_series_residency_music
  ON series (category, day_of_week)
  WHERE series_type = 'residency' AND is_active = true;
```

- [ ] **Step 3: Verify reclassification + editorial coverage**

```bash
cd /Users/coach/Projects/LostCity && npx supabase db reset --local

psql "$(npx supabase status -o json | jq -r '.DB_URL')" -c "
  SELECT count(*), count(description) AS with_blurb
  FROM series WHERE series_type = 'residency' AND category = 'music';
"
```

Expected: `count >= 10`, `with_blurb` equals `count` (every residency has an editorial blurb).

- [ ] **Step 4: Commit**

```bash
git add database/migrations/613_music_residency_reclassification.sql supabase/migrations/*_music_residency_reclassification.sql
git commit -m "feat(db): seed 10 music residencies with editorial blurbs"
```

---

## Task 6: Extend `getCardTier()` for curator picks

**Files:**
- Modify: `web/lib/city-pulse/tier-assignment.ts`
- Modify: `web/lib/city-pulse/tier-assignment.test.ts`

**Context:** Current shape (verified):

```typescript
export interface TierableEvent {
  is_tentpole?: boolean;
  is_featured?: boolean;
  festival_id?: string | null;
  image_url?: string | null;
  featured_blurb?: string | null;
  importance?: "flagship" | "major" | "standard" | null;
  venue_has_editorial?: boolean;
}
```

We add `is_curator_pick`. A curator pick forces hero tier unconditionally — it's an editorial override.

- [ ] **Step 1: Write the failing test**

Append to `web/lib/city-pulse/tier-assignment.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { computeIntrinsicScore, getCardTier } from "./tier-assignment";

describe("tier-assignment — is_curator_pick", () => {
  it("forces hero tier when is_curator_pick is true, even without other signals", () => {
    expect(getCardTier({ is_curator_pick: true })).toBe("hero");
  });

  it("does not affect tier when is_curator_pick is false", () => {
    expect(getCardTier({ is_curator_pick: false })).toBe("standard");
  });

  it("adds to intrinsic score when true", () => {
    const withPick = computeIntrinsicScore({ is_curator_pick: true });
    const withoutPick = computeIntrinsicScore({ is_curator_pick: false });
    expect(withPick).toBeGreaterThan(withoutPick);
  });
});
```

- [ ] **Step 2: Run test — expect fail**

```bash
cd /Users/coach/Projects/LostCity/web && npx vitest run lib/city-pulse/tier-assignment.test.ts
```

Expected: the three new tests fail (`is_curator_pick` not in `TierableEvent`).

- [ ] **Step 3: Implement**

Edit `web/lib/city-pulse/tier-assignment.ts`:

```typescript
export interface TierableEvent {
  is_tentpole?: boolean;
  is_featured?: boolean;
  festival_id?: string | null;
  image_url?: string | null;
  featured_blurb?: string | null;
  importance?: "flagship" | "major" | "standard" | null;
  venue_has_editorial?: boolean;
  is_curator_pick?: boolean;  // ← added
}

export function computeIntrinsicScore(event: TierableEvent): number {
  let score = 0;
  if (event.is_curator_pick) score += 50;  // ← added; higher than any other individual signal
  if (event.is_tentpole) score += 40;
  if (event.importance === "flagship") score += 40;
  if (event.importance === "major") score += 20;
  if (event.is_featured || event.featured_blurb) score += 15;
  if (event.festival_id) score += 10;
  if (event.venue_has_editorial) score += 15;
  if (event.image_url) score += 10;
  return score;
}

export function getCardTier(
  event: TierableEvent,
  friendsGoingCount = 0,
): CardTier {
  if (event.is_curator_pick) return "hero";  // ← added; unconditional
  const intrinsic = computeIntrinsicScore(event);
  if (intrinsic >= 30 || event.is_tentpole) return "hero";
  if (intrinsic >= 15 || friendsGoingCount > 0) return "featured";
  return "standard";
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
cd /Users/coach/Projects/LostCity/web && npx vitest run lib/city-pulse/tier-assignment.test.ts
```

Expected: all tests pass (old ones still pass; new ones pass).

- [ ] **Step 5: Commit**

```bash
git add web/lib/city-pulse/tier-assignment.ts web/lib/city-pulse/tier-assignment.test.ts
git commit -m "feat(city-pulse): getCardTier respects is_curator_pick as hero override"
```

---

## Task 7: Music genre bucket map + tests

**Files:**
- Create: `web/lib/music/genre-map.ts`
- Create: `web/lib/music/genre-map.test.ts`

**Context:** Maps specific tag strings (from `events.tags` + `events.genres`) to 7 broad display buckets. Used for both filter UI and card chip display. Spec §7.1. Preserves the mapping from the superseded 2026-04-13 music tab spec.

- [ ] **Step 1: Write the test first**

```typescript
// web/lib/music/genre-map.test.ts
import { describe, expect, it } from "vitest";
import { MUSIC_GENRE_BUCKETS, mapTagsToBuckets, tagToBucket } from "./genre-map";

describe("music genre map", () => {
  it("maps specific tags to broad buckets", () => {
    expect(tagToBucket("indie-rock")).toBe("Rock");
    expect(tagToBucket("post-punk")).toBe("Rock");
    expect(tagToBucket("hip-hop")).toBe("Hip-Hop/R&B");
    expect(tagToBucket("house")).toBe("Electronic");
    expect(tagToBucket("bluegrass")).toBe("Country");
  });

  it("returns null for unmapped tags", () => {
    expect(tagToBucket("madrigal")).toBeNull();
    expect(tagToBucket("")).toBeNull();
  });

  it("mapTagsToBuckets dedupes buckets and drops unmapped", () => {
    expect(mapTagsToBuckets(["indie-rock", "post-punk", "jazz"]))
      .toEqual(["Rock", "Jazz/Blues"]);
    expect(mapTagsToBuckets(["madrigal", "chamber"])).toEqual([]);
  });

  it("exposes the 7 buckets in canonical order", () => {
    expect(MUSIC_GENRE_BUCKETS).toEqual([
      "Rock",
      "Hip-Hop/R&B",
      "Electronic",
      "Jazz/Blues",
      "Country",
      "Latin",
      "Pop/Singer-Songwriter",
    ]);
  });
});
```

- [ ] **Step 2: Run test — expect fail**

```bash
cd /Users/coach/Projects/LostCity/web && npx vitest run lib/music/genre-map.test.ts
```

Expected: module not found.

- [ ] **Step 3: Implement**

```typescript
// web/lib/music/genre-map.ts
export const MUSIC_GENRE_BUCKETS = [
  "Rock",
  "Hip-Hop/R&B",
  "Electronic",
  "Jazz/Blues",
  "Country",
  "Latin",
  "Pop/Singer-Songwriter",
] as const;

export type MusicGenreBucket = (typeof MUSIC_GENRE_BUCKETS)[number];

const TAG_TO_BUCKET: Record<string, MusicGenreBucket> = {
  // Rock
  "rock": "Rock",
  "indie": "Rock",
  "indie-rock": "Rock",
  "alt-rock": "Rock",
  "alternative": "Rock",
  "post-punk": "Rock",
  "punk": "Rock",
  "metal": "Rock",
  "hard-rock": "Rock",
  "shoegaze": "Rock",
  "garage-rock": "Rock",
  "psychedelic": "Rock",
  "psych-rock": "Rock",
  "emo": "Rock",

  // Hip-Hop/R&B
  "hip-hop": "Hip-Hop/R&B",
  "rap": "Hip-Hop/R&B",
  "r-and-b": "Hip-Hop/R&B",
  "rnb": "Hip-Hop/R&B",
  "soul": "Hip-Hop/R&B",
  "trap": "Hip-Hop/R&B",
  "neo-soul": "Hip-Hop/R&B",

  // Electronic
  "electronic": "Electronic",
  "edm": "Electronic",
  "house": "Electronic",
  "techno": "Electronic",
  "dj": "Electronic",
  "drum-and-bass": "Electronic",
  "dnb": "Electronic",
  "dubstep": "Electronic",
  "trance": "Electronic",
  "ambient": "Electronic",

  // Jazz/Blues
  "jazz": "Jazz/Blues",
  "blues": "Jazz/Blues",
  "funk": "Jazz/Blues",
  "fusion": "Jazz/Blues",

  // Country
  "country": "Country",
  "bluegrass": "Country",
  "americana": "Country",
  "folk": "Country",
  "alt-country": "Country",

  // Latin
  "latin": "Latin",
  "reggaeton": "Latin",
  "salsa": "Latin",
  "bachata": "Latin",
  "latin-pop": "Latin",

  // Pop/Singer-Songwriter
  "pop": "Pop/Singer-Songwriter",
  "singer-songwriter": "Pop/Singer-Songwriter",
  "indie-pop": "Pop/Singer-Songwriter",
  "acoustic": "Pop/Singer-Songwriter",
};

function normalize(tag: string): string {
  return tag.toLowerCase().trim().replace(/\s+/g, "-").replace(/_/g, "-");
}

export function tagToBucket(tag: string): MusicGenreBucket | null {
  if (!tag) return null;
  return TAG_TO_BUCKET[normalize(tag)] ?? null;
}

export function mapTagsToBuckets(tags: readonly string[]): MusicGenreBucket[] {
  const found = new Set<MusicGenreBucket>();
  for (const tag of tags) {
    const bucket = tagToBucket(tag);
    if (bucket) found.add(bucket);
  }
  // Return in canonical order.
  return MUSIC_GENRE_BUCKETS.filter((b) => found.has(b));
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd /Users/coach/Projects/LostCity/web && npx vitest run lib/music/genre-map.test.ts
```

Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/lib/music/genre-map.ts web/lib/music/genre-map.test.ts
git commit -m "feat(music): genre bucket map utility"
```

---

## Task 8: Shared types — `lib/music/types.ts`

**Files:**
- Create: `web/lib/music/types.ts`

**Context:** One file, all payload types shared across seven API routes + the eventual widget/page components. No tests (pure types). Based on the exact event/place/series Row shapes verified from `database.types.ts`.

- [ ] **Step 1: Write the file**

```typescript
// web/lib/music/types.ts
import type { MusicGenreBucket } from "./genre-map";

export type MusicProgrammingStyle =
  | "listening_room"
  | "curated_indie"
  | "jazz_club"
  | "dj_electronic"
  | "drive_in_amph";

export type MusicDisplayTier = "editorial" | "marquee" | "additional";

export type CapacityBand = "intimate" | "club" | "theater" | "arena";

export interface MusicVenuePayload {
  id: number;
  name: string;
  slug: string;
  neighborhood: string | null;
  image_url: string | null;
  hero_image_url: string | null;
  music_programming_style: MusicProgrammingStyle | null;
  music_venue_formats: string[];
  capacity: number | null;
  // Editorial italic line (venue-level description, CM-written). Reuses places.short_description.
  editorial_line: string | null;
  display_tier: MusicDisplayTier;
  capacity_band: CapacityBand | null;
}

export interface MusicArtistPayload {
  id: string | null;  // null when only event_artists.name is known
  slug: string | null;
  name: string;
  is_headliner: boolean;
  billing_order: number | null;
}

export interface MusicShowPayload {
  id: number;
  title: string;
  start_date: string;  // YYYY-MM-DD
  start_time: string | null;  // HH:MM
  doors_time: string | null;  // HH:MM
  image_url: string | null;
  is_free: boolean;
  is_curator_pick: boolean;
  is_tentpole: boolean;
  importance: "flagship" | "major" | "standard" | null;
  festival_id: string | null;
  ticket_status: string | null;  // "tickets-available" | "low-tickets" | "sold-out" | "free" | null
  ticket_url: string | null;
  age_policy: string | null;
  featured_blurb: string | null;  // CM editorial blurb (existing column)
  tags: string[];
  genres: string[];
  genre_buckets: MusicGenreBucket[];  // derived from tags + genres via genre-map
  venue: MusicVenuePayload;
  artists: MusicArtistPayload[];  // sorted: headliner first, then by billing_order
}

export interface MusicResidencyPayload {
  id: string;
  title: string;
  slug: string;
  description: string | null;  // editorial blurb
  day_of_week: string | null;
  image_url: string | null;
  venue: MusicVenuePayload | null;  // derived from next upcoming event
  next_event: {
    id: number;
    start_date: string;
    start_time: string | null;
    doors_time: string | null;
  } | null;
}

export interface ThisWeekPayload {
  // Cascade-ranked, cap 3. Empty array if no signals present this week.
  shows: MusicShowPayload[];
}

export interface TonightPayload {
  date: string;  // YYYY-MM-DD
  tonight: { venue: MusicVenuePayload; shows: MusicShowPayload[] }[];  // doors/start < 21:00
  late_night: { venue: MusicVenuePayload; shows: MusicShowPayload[] }[];  // doors/start >= 21:00
}

export interface ByVenuePayload {
  date: string;
  my_venues: { venue: MusicVenuePayload; shows: MusicShowPayload[] }[];
  editorial: { venue: MusicVenuePayload; shows: MusicShowPayload[] }[];
  marquee: { venue: MusicVenuePayload; shows: MusicShowPayload[] }[];
  additional: { venue: MusicVenuePayload; shows: MusicShowPayload[] }[];  // empty unless opted in
}

export interface ByShowPayload {
  // Grouped by day; within day, sorted by start_time asc.
  groups: { day_label: string; date: string; shows: MusicShowPayload[] }[];
}

export interface FestivalHorizonPayload {
  festivals: {
    id: string;
    slug: string;
    name: string;
    start_date: string;
    end_date: string;
    venue_name: string | null;
    neighborhood: string | null;
    days_away: number;
    headliner_teaser: string | null;
    genre_bucket: MusicGenreBucket | null;
    image_url: string | null;
  }[];
}

export interface OnSalePayload {
  shows: MusicShowPayload[];  // start_time 2-6 months out, sorted by created_at DESC
}
```

- [ ] **Step 2: Commit (no tests for pure types; typecheck will catch drift)**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit
# Expected: no errors related to web/lib/music/types.ts

git add web/lib/music/types.ts
git commit -m "feat(music): shared payload types for music API routes"
```

---

## Task 9: Classification helpers + ghost-venue policy

**Files:**
- Create: `web/lib/music/classification.ts`
- Create: `web/lib/music/classification.test.ts`

**Context:** Pure derivation. `classifyMusicVenue` maps `(music_programming_style, capacity)` → `MusicDisplayTier`. `capacityBand` maps raw capacity → band enum. `hasRecentEvents` is the ghost-venue check (true if venue produced events in last 14 days).

- [ ] **Step 1: Write the tests**

```typescript
// web/lib/music/classification.test.ts
import { describe, expect, it } from "vitest";
import { capacityBand, classifyMusicVenue, GHOST_VENUE_LOOKBACK_DAYS } from "./classification";

describe("classifyMusicVenue", () => {
  it("returns editorial when programming_style is set", () => {
    expect(classifyMusicVenue({ music_programming_style: "listening_room", capacity: 200 })).toBe("editorial");
    expect(classifyMusicVenue({ music_programming_style: "curated_indie", capacity: 5000 })).toBe("editorial");
  });

  it("returns marquee when style null AND capacity >= 1000", () => {
    expect(classifyMusicVenue({ music_programming_style: null, capacity: 1000 })).toBe("marquee");
    expect(classifyMusicVenue({ music_programming_style: null, capacity: 2600 })).toBe("marquee");
  });

  it("returns additional otherwise", () => {
    expect(classifyMusicVenue({ music_programming_style: null, capacity: 999 })).toBe("additional");
    expect(classifyMusicVenue({ music_programming_style: null, capacity: null })).toBe("additional");
    expect(classifyMusicVenue({ music_programming_style: null, capacity: 300 })).toBe("additional");
  });
});

describe("capacityBand", () => {
  it("bands correctly", () => {
    expect(capacityBand(null)).toBeNull();
    expect(capacityBand(150)).toBe("intimate");
    expect(capacityBand(299)).toBe("intimate");
    expect(capacityBand(300)).toBe("club");
    expect(capacityBand(999)).toBe("club");
    expect(capacityBand(1000)).toBe("theater");
    expect(capacityBand(3000)).toBe("theater");
    expect(capacityBand(3001)).toBe("arena");
    expect(capacityBand(21000)).toBe("arena");
  });
});

describe("GHOST_VENUE_LOOKBACK_DAYS", () => {
  it("is 14 — matches spec §2 ghost venue policy", () => {
    expect(GHOST_VENUE_LOOKBACK_DAYS).toBe(14);
  });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
cd /Users/coach/Projects/LostCity/web && npx vitest run lib/music/classification.test.ts
```

- [ ] **Step 3: Implement**

```typescript
// web/lib/music/classification.ts
import type { CapacityBand, MusicDisplayTier, MusicProgrammingStyle } from "./types";

export const GHOST_VENUE_LOOKBACK_DAYS = 14;

export interface ClassifiableVenue {
  music_programming_style: MusicProgrammingStyle | null;
  capacity: number | null;
}

export function classifyMusicVenue(v: ClassifiableVenue): MusicDisplayTier {
  if (v.music_programming_style) return "editorial";
  if (v.capacity != null && v.capacity >= 1000) return "marquee";
  return "additional";
}

export function capacityBand(capacity: number | null): CapacityBand | null {
  if (capacity == null) return null;
  if (capacity < 300) return "intimate";
  if (capacity < 1000) return "club";
  if (capacity <= 3000) return "theater";
  return "arena";
}
```

- [ ] **Step 4: Run — expect pass**

```bash
cd /Users/coach/Projects/LostCity/web && npx vitest run lib/music/classification.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add web/lib/music/classification.ts web/lib/music/classification.test.ts
git commit -m "feat(music): classification helpers for tier derivation"
```

---

## Task 10: `/api/music/this-week` route + loader + tests

**Files:**
- Create: `web/lib/music/this-week-loader.ts`
- Create: `web/app/api/music/this-week/route.ts`
- Create: `web/app/api/music/this-week/route.test.ts`

**Context:** Returns curator-pick-first cascade, cap 3, for the current ISO week. Query logic: `category_id='music' AND is_curator_pick=true` first, then fill with `importance IN ('flagship','major')`, then `festival_id IS NOT NULL`, then residency finales, then one-night-only title pattern matches. Always portal-scoped via `applyManifestFederatedScopeToQuery`.

- [ ] **Step 1: Write the loader test (mock-based; real integration comes later)**

```typescript
// web/app/api/music/this-week/route.test.ts
import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/music/this-week", () => {
  it("requires portal query param", async () => {
    const req = new Request("http://localhost/api/music/this-week");
    const res = await GET(req as never);
    expect(res.status).toBe(400);
  });

  it("returns an empty shows array when no music events match", async () => {
    // Use a portal with no music events seeded in test DB.
    const req = new Request("http://localhost/api/music/this-week?portal=nonexistent");
    const res = await GET(req as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ shows: [] });
  });

  it("caps at 3 shows even when more signals match", async () => {
    const req = new Request("http://localhost/api/music/this-week?portal=atlanta");
    const res = await GET(req as never);
    const body = await res.json();
    expect(body.shows.length).toBeLessThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Write the loader**

```typescript
// web/lib/music/this-week-loader.ts
import { createClient } from "@/lib/supabase/server";
import { getManifestForPortalSlug } from "@/lib/portal-runtime";
import { applyManifestFederatedScopeToQuery } from "@/lib/city-pulse/source-scoping";
import { getSourceAccessForPortal } from "@/lib/portal-sources";
import { classifyMusicVenue, capacityBand } from "./classification";
import { mapTagsToBuckets } from "./genre-map";
import type {
  MusicShowPayload,
  MusicVenuePayload,
  ThisWeekPayload,
} from "./types";

function isoWeekRange(today: Date): { start: string; end: string } {
  // ISO week: Mon-Sun. Return YYYY-MM-DD strings for start and end.
  const day = (today.getDay() + 6) % 7; // 0=Mon, 6=Sun
  const start = new Date(today);
  start.setDate(today.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

export async function loadThisWeek(portalSlug: string): Promise<ThisWeekPayload> {
  const supabase = await createClient();
  const manifest = await getManifestForPortalSlug(portalSlug);
  if (!manifest) return { shows: [] };
  const sourceAccess = await getSourceAccessForPortal(portalSlug);
  const { start, end } = isoWeekRange(new Date());

  let q = supabase
    .from("events")
    .select(`
      id, title, start_date, start_time, doors_time, image_url,
      is_free, is_curator_pick, is_tentpole, importance, festival_id,
      ticket_status, ticket_url, age_policy, featured_blurb,
      tags, genres,
      place:places!inner(
        id, name, slug, neighborhood, image_url, hero_image_url, short_description,
        music_programming_style, music_venue_formats, capacity
      ),
      event_artists(artist_id, name, is_headliner, billing_order,
        artist:artists(slug))
    `)
    .eq("category_id", "music")
    .eq("is_active", true)
    .gte("start_date", start)
    .lte("start_date", end);

  q = applyManifestFederatedScopeToQuery(q, manifest, {
    publicOnlyWhenNoPortal: true,
    sourceIds: sourceAccess.sourceIds,
    sourceColumn: "source_id",
  });

  const { data, error } = await q;
  if (error || !data) return { shows: [] };

  // Cascade ranking: curator_pick > importance > festival > one-night title > first-scored remainder.
  const oneNightPattern = /\b(release party|farewell|finale|residency finale|one night|feat\.)\b/i;
  type Row = (typeof data)[number];

  const score = (e: Row): number => {
    if (e.is_curator_pick) return 100;
    if (e.importance === "flagship" || e.is_tentpole) return 80;
    if (e.importance === "major") return 60;
    if (e.festival_id) return 50;
    if (oneNightPattern.test(e.title)) return 30;
    return 0;
  };

  const ranked = [...data].sort((a, b) => score(b) - score(a)).filter((e) => score(e) > 0);
  const top = ranked.slice(0, 3);

  const shows: MusicShowPayload[] = top.map((e) => {
    const p = (e.place as unknown as {
      id: number; name: string; slug: string; neighborhood: string | null;
      image_url: string | null; hero_image_url: string | null; short_description: string | null;
      music_programming_style: MusicVenuePayload["music_programming_style"];
      music_venue_formats: string[]; capacity: number | null;
    });
    const venue: MusicVenuePayload = {
      id: p.id,
      name: p.name,
      slug: p.slug,
      neighborhood: p.neighborhood,
      image_url: p.image_url,
      hero_image_url: p.hero_image_url,
      music_programming_style: p.music_programming_style,
      music_venue_formats: p.music_venue_formats ?? [],
      capacity: p.capacity,
      editorial_line: p.short_description,
      display_tier: classifyMusicVenue(p),
      capacity_band: capacityBand(p.capacity),
    };

    const artistRows = (e.event_artists ?? []) as Array<{
      artist_id: string | null; name: string; is_headliner: boolean | null;
      billing_order: number | null; artist: { slug: string | null } | null;
    }>;
    const artists = artistRows
      .map((a) => ({
        id: a.artist_id,
        slug: a.artist?.slug ?? null,
        name: a.name,
        is_headliner: a.is_headliner ?? false,
        billing_order: a.billing_order,
      }))
      .sort((x, y) =>
        (y.is_headliner ? 1 : 0) - (x.is_headliner ? 1 : 0) ||
        (x.billing_order ?? 999) - (y.billing_order ?? 999)
      );

    const allTags = [...(e.tags ?? []), ...(e.genres ?? [])];

    return {
      id: e.id,
      title: e.title,
      start_date: e.start_date,
      start_time: e.start_time,
      doors_time: e.doors_time,
      image_url: e.image_url,
      is_free: e.is_free ?? false,
      is_curator_pick: e.is_curator_pick ?? false,
      is_tentpole: e.is_tentpole ?? false,
      importance: (e.importance ?? null) as MusicShowPayload["importance"],
      festival_id: e.festival_id,
      ticket_status: e.ticket_status,
      ticket_url: e.ticket_url,
      age_policy: e.age_policy,
      featured_blurb: e.featured_blurb,
      tags: e.tags ?? [],
      genres: e.genres ?? [],
      genre_buckets: mapTagsToBuckets(allTags),
      venue,
      artists,
    };
  });

  return { shows };
}
```

- [ ] **Step 3: Write the route**

```typescript
// web/app/api/music/this-week/route.ts
import { NextResponse } from "next/server";
import { loadThisWeek } from "@/lib/music/this-week-loader";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const portal = url.searchParams.get("portal");
  if (!portal) {
    return NextResponse.json({ error: "portal query param required" }, { status: 400 });
  }
  const payload = await loadThisWeek(portal);
  return NextResponse.json(payload);
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd /Users/coach/Projects/LostCity/web && npx vitest run app/api/music/this-week/route.test.ts
```

- [ ] **Step 5: Manual smoke test**

```bash
cd /Users/coach/Projects/LostCity/web && npm run dev &
sleep 5
curl -sS "http://localhost:3000/api/music/this-week?portal=atlanta" | jq '.shows | length'
# Expected: a number 0-3
```

- [ ] **Step 6: Commit**

```bash
git add web/lib/music/this-week-loader.ts web/app/api/music/this-week/route.ts web/app/api/music/this-week/route.test.ts
git commit -m "feat(music): /api/music/this-week — curator-first cascade, cap 3"
```

---

## Task 11: `/api/music/tonight` — tonight + late_night split

**Files:**
- Create: `web/lib/music/tonight-loader.ts`
- Create: `web/app/api/music/tonight/route.ts`
- Create: `web/app/api/music/tonight/route.test.ts`

**Context:** Splits by effective-start-time threshold 21:00 local. Effective-start = `doors_time ?? start_time`. If both null, bucket as tonight (`< 21:00` default).

- [ ] **Step 1: Write the test**

```typescript
// web/app/api/music/tonight/route.test.ts
import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/music/tonight", () => {
  it("requires portal query param", async () => {
    const req = new Request("http://localhost/api/music/tonight");
    const res = await GET(req as never);
    expect(res.status).toBe(400);
  });

  it("accepts optional date param (defaults to today)", async () => {
    const req = new Request("http://localhost/api/music/tonight?portal=atlanta");
    const res = await GET(req as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("tonight");
    expect(body).toHaveProperty("late_night");
    expect(body).toHaveProperty("date");
  });

  it("splits shows into tonight vs late_night by 21:00 threshold", async () => {
    const req = new Request("http://localhost/api/music/tonight?portal=atlanta");
    const res = await GET(req as never);
    const body = await res.json();
    // Structural assertion — shape is correct.
    expect(Array.isArray(body.tonight)).toBe(true);
    expect(Array.isArray(body.late_night)).toBe(true);
  });
});
```

- [ ] **Step 2: Write the loader**

```typescript
// web/lib/music/tonight-loader.ts
import { createClient } from "@/lib/supabase/server";
import { getManifestForPortalSlug } from "@/lib/portal-runtime";
import { applyManifestFederatedScopeToQuery } from "@/lib/city-pulse/source-scoping";
import { getSourceAccessForPortal } from "@/lib/portal-sources";
import { classifyMusicVenue, capacityBand } from "./classification";
import { mapTagsToBuckets } from "./genre-map";
import type {
  MusicShowPayload,
  MusicVenuePayload,
  TonightPayload,
} from "./types";

const LATE_NIGHT_THRESHOLD = "21:00";

function effectiveStart(doors: string | null, show: string | null): string {
  return doors || show || "00:00";
}

function toPayload(e: {
  id: number; title: string; start_date: string;
  start_time: string | null; doors_time: string | null; image_url: string | null;
  is_free: boolean | null; is_curator_pick: boolean | null; is_tentpole: boolean | null;
  importance: string | null; festival_id: string | null;
  ticket_status: string | null; ticket_url: string | null; age_policy: string | null;
  featured_blurb: string | null; tags: string[] | null; genres: string[] | null;
  place: unknown; event_artists: unknown;
}): MusicShowPayload {
  const p = e.place as {
    id: number; name: string; slug: string; neighborhood: string | null;
    image_url: string | null; hero_image_url: string | null; short_description: string | null;
    music_programming_style: MusicVenuePayload["music_programming_style"];
    music_venue_formats: string[]; capacity: number | null;
  };
  const venue: MusicVenuePayload = {
    id: p.id, name: p.name, slug: p.slug, neighborhood: p.neighborhood,
    image_url: p.image_url, hero_image_url: p.hero_image_url,
    music_programming_style: p.music_programming_style,
    music_venue_formats: p.music_venue_formats ?? [],
    capacity: p.capacity,
    editorial_line: p.short_description,
    display_tier: classifyMusicVenue(p),
    capacity_band: capacityBand(p.capacity),
  };

  const artistRows = (e.event_artists ?? []) as Array<{
    artist_id: string | null; name: string; is_headliner: boolean | null;
    billing_order: number | null; artist: { slug: string | null } | null;
  }>;
  const artists = artistRows
    .map((a) => ({
      id: a.artist_id, slug: a.artist?.slug ?? null, name: a.name,
      is_headliner: a.is_headliner ?? false, billing_order: a.billing_order,
    }))
    .sort((x, y) =>
      (y.is_headliner ? 1 : 0) - (x.is_headliner ? 1 : 0) ||
      (x.billing_order ?? 999) - (y.billing_order ?? 999)
    );

  return {
    id: e.id, title: e.title, start_date: e.start_date,
    start_time: e.start_time, doors_time: e.doors_time, image_url: e.image_url,
    is_free: e.is_free ?? false,
    is_curator_pick: e.is_curator_pick ?? false,
    is_tentpole: e.is_tentpole ?? false,
    importance: (e.importance ?? null) as MusicShowPayload["importance"],
    festival_id: e.festival_id,
    ticket_status: e.ticket_status, ticket_url: e.ticket_url,
    age_policy: e.age_policy, featured_blurb: e.featured_blurb,
    tags: e.tags ?? [], genres: e.genres ?? [],
    genre_buckets: mapTagsToBuckets([...(e.tags ?? []), ...(e.genres ?? [])]),
    venue, artists,
  };
}

export async function loadTonight(portalSlug: string, dateIso?: string): Promise<TonightPayload> {
  const supabase = await createClient();
  const manifest = await getManifestForPortalSlug(portalSlug);
  const date = dateIso ?? new Date().toISOString().slice(0, 10);
  if (!manifest) return { date, tonight: [], late_night: [] };
  const sourceAccess = await getSourceAccessForPortal(portalSlug);

  let q = supabase
    .from("events")
    .select(`
      id, title, start_date, start_time, doors_time, image_url,
      is_free, is_curator_pick, is_tentpole, importance, festival_id,
      ticket_status, ticket_url, age_policy, featured_blurb,
      tags, genres,
      place:places!inner(
        id, name, slug, neighborhood, image_url, hero_image_url, short_description,
        music_programming_style, music_venue_formats, capacity
      ),
      event_artists(artist_id, name, is_headliner, billing_order,
        artist:artists(slug))
    `)
    .eq("category_id", "music")
    .eq("is_active", true)
    .eq("start_date", date);

  q = applyManifestFederatedScopeToQuery(q, manifest, {
    publicOnlyWhenNoPortal: true,
    sourceIds: sourceAccess.sourceIds,
    sourceColumn: "source_id",
  });

  const { data, error } = await q;
  if (error || !data) return { date, tonight: [], late_night: [] };

  const tonightMap = new Map<number, { venue: MusicVenuePayload; shows: MusicShowPayload[] }>();
  const lateMap = new Map<number, { venue: MusicVenuePayload; shows: MusicShowPayload[] }>();

  for (const row of data as never[]) {
    const payload = toPayload(row as never);
    const startKey = effectiveStart(payload.doors_time, payload.start_time);
    const bucket = startKey >= LATE_NIGHT_THRESHOLD ? lateMap : tonightMap;
    const existing = bucket.get(payload.venue.id);
    if (existing) {
      existing.shows.push(payload);
    } else {
      bucket.set(payload.venue.id, { venue: payload.venue, shows: [payload] });
    }
  }

  const sortGroup = (group: Map<number, { venue: MusicVenuePayload; shows: MusicShowPayload[] }>) => {
    return Array.from(group.values())
      .map(({ venue, shows }) => ({
        venue,
        shows: shows.sort((a, b) =>
          effectiveStart(a.doors_time, a.start_time).localeCompare(
            effectiveStart(b.doors_time, b.start_time)
          )
        ),
      }))
      .sort((a, b) => {
        const tierOrder = { editorial: 0, marquee: 1, additional: 2 };
        return tierOrder[a.venue.display_tier] - tierOrder[b.venue.display_tier];
      });
  };

  return {
    date,
    tonight: sortGroup(tonightMap),
    late_night: sortGroup(lateMap),
  };
}
```

- [ ] **Step 3: Write the route**

```typescript
// web/app/api/music/tonight/route.ts
import { NextResponse } from "next/server";
import { loadTonight } from "@/lib/music/tonight-loader";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const portal = url.searchParams.get("portal");
  if (!portal) {
    return NextResponse.json({ error: "portal query param required" }, { status: 400 });
  }
  const date = url.searchParams.get("date") ?? undefined;
  const payload = await loadTonight(portal, date);
  return NextResponse.json(payload);
}
```

- [ ] **Step 4: Run tests + smoke + commit**

```bash
cd /Users/coach/Projects/LostCity/web && npx vitest run app/api/music/tonight/route.test.ts
curl -sS "http://localhost:3000/api/music/tonight?portal=atlanta" | jq '.tonight | length, .late_night | length'

git add web/lib/music/tonight-loader.ts web/app/api/music/tonight/route.ts web/app/api/music/tonight/route.test.ts
git commit -m "feat(music): /api/music/tonight with tonight/late_night split at 21:00"
```

---

## Task 12: `/api/music/by-venue`

**Files:**
- Create: `web/lib/music/by-venue-loader.ts`
- Create: `web/app/api/music/by-venue/route.ts`
- Create: `web/app/api/music/by-venue/route.test.ts`

**Context:** Returns four groups (`my_venues`, `editorial`, `marquee`, `additional`). `my_venues` is populated only when the caller passes authenticated-user pin data (or `pinned_slugs` query param for v1 testing; proper auth integration in Plan 3a). `additional` returns [] unless `?include_additional=true`.

- [ ] **Step 1: Test**

```typescript
// web/app/api/music/by-venue/route.test.ts
import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/music/by-venue", () => {
  it("requires portal", async () => {
    const req = new Request("http://localhost/api/music/by-venue");
    expect((await GET(req as never)).status).toBe(400);
  });

  it("returns the four-group shape", async () => {
    const req = new Request("http://localhost/api/music/by-venue?portal=atlanta");
    const body = await (await GET(req as never)).json();
    expect(body).toHaveProperty("my_venues");
    expect(body).toHaveProperty("editorial");
    expect(body).toHaveProperty("marquee");
    expect(body).toHaveProperty("additional");
    expect(body.additional).toEqual([]);  // not opted in
  });

  it("returns additional when opted-in", async () => {
    const req = new Request("http://localhost/api/music/by-venue?portal=atlanta&include_additional=true");
    const body = await (await GET(req as never)).json();
    expect(Array.isArray(body.additional)).toBe(true);
  });
});
```

- [ ] **Step 2: Loader**

```typescript
// web/lib/music/by-venue-loader.ts
import { createClient } from "@/lib/supabase/server";
import { getManifestForPortalSlug } from "@/lib/portal-runtime";
import { applyManifestFederatedScopeToQuery } from "@/lib/city-pulse/source-scoping";
import { getSourceAccessForPortal } from "@/lib/portal-sources";
import { classifyMusicVenue, capacityBand } from "./classification";
import { mapTagsToBuckets } from "./genre-map";
import type { ByVenuePayload, MusicShowPayload, MusicVenuePayload } from "./types";

export interface ByVenueOptions {
  date?: string;
  pinned_slugs?: string[];
  include_additional?: boolean;
  genre_buckets?: string[];  // applied as a filter
}

export async function loadByVenue(portalSlug: string, opts: ByVenueOptions = {}): Promise<ByVenuePayload> {
  const supabase = await createClient();
  const manifest = await getManifestForPortalSlug(portalSlug);
  const date = opts.date ?? new Date().toISOString().slice(0, 10);
  const empty: ByVenuePayload = { date, my_venues: [], editorial: [], marquee: [], additional: [] };
  if (!manifest) return empty;
  const sourceAccess = await getSourceAccessForPortal(portalSlug);

  let q = supabase
    .from("events")
    .select(`
      id, title, start_date, start_time, doors_time, image_url,
      is_free, is_curator_pick, is_tentpole, importance, festival_id,
      ticket_status, ticket_url, age_policy, featured_blurb,
      tags, genres,
      place:places!inner(
        id, name, slug, neighborhood, image_url, hero_image_url, short_description,
        music_programming_style, music_venue_formats, capacity
      ),
      event_artists(artist_id, name, is_headliner, billing_order,
        artist:artists(slug))
    `)
    .eq("category_id", "music")
    .eq("is_active", true)
    .eq("start_date", date);

  q = applyManifestFederatedScopeToQuery(q, manifest, {
    publicOnlyWhenNoPortal: true,
    sourceIds: sourceAccess.sourceIds,
    sourceColumn: "source_id",
  });

  const { data } = await q;
  if (!data) return empty;

  // Build per-venue groups.
  type Group = { venue: MusicVenuePayload; shows: MusicShowPayload[] };
  const venues = new Map<number, Group>();

  for (const row of data as never[]) {
    const e = row as never as {
      id: number; title: string; start_date: string;
      start_time: string | null; doors_time: string | null; image_url: string | null;
      is_free: boolean | null; is_curator_pick: boolean | null; is_tentpole: boolean | null;
      importance: string | null; festival_id: string | null;
      ticket_status: string | null; ticket_url: string | null; age_policy: string | null;
      featured_blurb: string | null; tags: string[] | null; genres: string[] | null;
      place: {
        id: number; name: string; slug: string; neighborhood: string | null;
        image_url: string | null; hero_image_url: string | null; short_description: string | null;
        music_programming_style: MusicVenuePayload["music_programming_style"];
        music_venue_formats: string[]; capacity: number | null;
      };
      event_artists: Array<{
        artist_id: string | null; name: string; is_headliner: boolean | null;
        billing_order: number | null; artist: { slug: string | null } | null;
      }>;
    };
    const p = e.place;
    const venue: MusicVenuePayload = {
      id: p.id, name: p.name, slug: p.slug, neighborhood: p.neighborhood,
      image_url: p.image_url, hero_image_url: p.hero_image_url,
      music_programming_style: p.music_programming_style,
      music_venue_formats: p.music_venue_formats ?? [],
      capacity: p.capacity,
      editorial_line: p.short_description,
      display_tier: classifyMusicVenue(p),
      capacity_band: capacityBand(p.capacity),
    };
    const artists = (e.event_artists ?? [])
      .map((a) => ({
        id: a.artist_id, slug: a.artist?.slug ?? null, name: a.name,
        is_headliner: a.is_headliner ?? false, billing_order: a.billing_order,
      }))
      .sort((x, y) =>
        (y.is_headliner ? 1 : 0) - (x.is_headliner ? 1 : 0) ||
        (x.billing_order ?? 999) - (y.billing_order ?? 999)
      );

    const allTags = [...(e.tags ?? []), ...(e.genres ?? [])];
    const genre_buckets = mapTagsToBuckets(allTags);

    // Genre filter.
    if (opts.genre_buckets && opts.genre_buckets.length > 0) {
      const hit = genre_buckets.some((b) => opts.genre_buckets!.includes(b));
      if (!hit) continue;
    }

    const show: MusicShowPayload = {
      id: e.id, title: e.title, start_date: e.start_date,
      start_time: e.start_time, doors_time: e.doors_time, image_url: e.image_url,
      is_free: e.is_free ?? false,
      is_curator_pick: e.is_curator_pick ?? false,
      is_tentpole: e.is_tentpole ?? false,
      importance: (e.importance ?? null) as MusicShowPayload["importance"],
      festival_id: e.festival_id,
      ticket_status: e.ticket_status, ticket_url: e.ticket_url,
      age_policy: e.age_policy, featured_blurb: e.featured_blurb,
      tags: e.tags ?? [], genres: e.genres ?? [],
      genre_buckets, venue, artists,
    };

    const existing = venues.get(venue.id);
    if (existing) existing.shows.push(show);
    else venues.set(venue.id, { venue, shows: [show] });
  }

  const pinned = new Set(opts.pinned_slugs ?? []);
  const my_venues: Group[] = [];
  const editorial: Group[] = [];
  const marquee: Group[] = [];
  const additional: Group[] = [];

  for (const g of venues.values()) {
    if (pinned.has(g.venue.slug)) my_venues.push(g);
    else if (g.venue.display_tier === "editorial") editorial.push(g);
    else if (g.venue.display_tier === "marquee") marquee.push(g);
    else additional.push(g);
  }

  const sortShows = (g: Group) => ({
    ...g,
    shows: g.shows.sort((a, b) =>
      ((a.doors_time || a.start_time) ?? "").localeCompare((b.doors_time || b.start_time) ?? "")
    ),
  });

  return {
    date,
    my_venues: my_venues.map(sortShows),
    editorial: editorial.map(sortShows),
    marquee: marquee.map(sortShows),
    additional: opts.include_additional ? additional.map(sortShows) : [],
  };
}
```

- [ ] **Step 3: Route**

```typescript
// web/app/api/music/by-venue/route.ts
import { NextResponse } from "next/server";
import { loadByVenue } from "@/lib/music/by-venue-loader";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const portal = url.searchParams.get("portal");
  if (!portal) {
    return NextResponse.json({ error: "portal query param required" }, { status: 400 });
  }
  const payload = await loadByVenue(portal, {
    date: url.searchParams.get("date") ?? undefined,
    pinned_slugs: url.searchParams.getAll("pinned"),
    include_additional: url.searchParams.get("include_additional") === "true",
    genre_buckets: url.searchParams.getAll("genre"),
  });
  return NextResponse.json(payload);
}
```

- [ ] **Step 4: Tests + smoke + commit**

```bash
cd /Users/coach/Projects/LostCity/web && npx vitest run app/api/music/by-venue/route.test.ts
curl -sS "http://localhost:3000/api/music/by-venue?portal=atlanta" | jq '.editorial | length, .marquee | length'

git add web/lib/music/by-venue-loader.ts web/app/api/music/by-venue/route.ts web/app/api/music/by-venue/route.test.ts
git commit -m "feat(music): /api/music/by-venue with tier grouping + genre filter"
```

---

## Task 13: `/api/music/by-show` — chronological grouped list

**Files:**
- Create: `web/lib/music/by-show-loader.ts`
- Create: `web/app/api/music/by-show/route.ts`
- Create: `web/app/api/music/by-show/route.test.ts`

**Context:** Same event shape as by-venue but grouped by day (today, tomorrow, …). Default range: 7 days from `date` param. Genre filter supported.

- [ ] **Step 1: Test**

```typescript
// web/app/api/music/by-show/route.test.ts
import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/music/by-show", () => {
  it("requires portal", async () => {
    expect((await GET(new Request("http://localhost/api/music/by-show") as never)).status).toBe(400);
  });

  it("returns groups sorted by date ascending", async () => {
    const res = await GET(new Request("http://localhost/api/music/by-show?portal=atlanta") as never);
    const body = await res.json();
    expect(Array.isArray(body.groups)).toBe(true);
    if (body.groups.length > 1) {
      for (let i = 1; i < body.groups.length; i++) {
        expect(body.groups[i].date >= body.groups[i - 1].date).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: Loader**

```typescript
// web/lib/music/by-show-loader.ts
// Same base query as tonight-loader but range covers 7 days from `date`.
// Reuses toPayload() pattern from tonight-loader — copy (TDD) or extract shared helper.

import { createClient } from "@/lib/supabase/server";
import { getManifestForPortalSlug } from "@/lib/portal-runtime";
import { applyManifestFederatedScopeToQuery } from "@/lib/city-pulse/source-scoping";
import { getSourceAccessForPortal } from "@/lib/portal-sources";
import { classifyMusicVenue, capacityBand } from "./classification";
import { mapTagsToBuckets } from "./genre-map";
import type { ByShowPayload, MusicShowPayload, MusicVenuePayload } from "./types";

function dayLabel(iso: string, today: string): string {
  if (iso === today) return "TONIGHT";
  const d = new Date(iso + "T00:00:00");
  const tomorrowDate = new Date(today + "T00:00:00");
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  if (iso === tomorrowDate.toISOString().slice(0, 10)) return "TOMORROW";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }).toUpperCase();
}

export interface ByShowOptions {
  date?: string;
  days?: number;  // default 7
  genre_buckets?: string[];
  free_only?: boolean;
  under_25?: boolean;
  all_ages_only?: boolean;
  late_night_only?: boolean;
}

export async function loadByShow(portalSlug: string, opts: ByShowOptions = {}): Promise<ByShowPayload> {
  const supabase = await createClient();
  const manifest = await getManifestForPortalSlug(portalSlug);
  const today = opts.date ?? new Date().toISOString().slice(0, 10);
  const days = opts.days ?? 7;
  const end = new Date(today + "T00:00:00");
  end.setDate(end.getDate() + days - 1);
  const endIso = end.toISOString().slice(0, 10);
  if (!manifest) return { groups: [] };

  const sourceAccess = await getSourceAccessForPortal(portalSlug);

  let q = supabase
    .from("events")
    .select(`
      id, title, start_date, start_time, doors_time, image_url,
      is_free, is_curator_pick, is_tentpole, importance, festival_id,
      ticket_status, ticket_url, age_policy, featured_blurb,
      tags, genres, price_min,
      place:places!inner(
        id, name, slug, neighborhood, image_url, hero_image_url, short_description,
        music_programming_style, music_venue_formats, capacity
      ),
      event_artists(artist_id, name, is_headliner, billing_order,
        artist:artists(slug))
    `)
    .eq("category_id", "music")
    .eq("is_active", true)
    .gte("start_date", today)
    .lte("start_date", endIso);

  q = applyManifestFederatedScopeToQuery(q, manifest, {
    publicOnlyWhenNoPortal: true,
    sourceIds: sourceAccess.sourceIds,
    sourceColumn: "source_id",
  });

  const { data } = await q;
  if (!data) return { groups: [] };

  const byDay = new Map<string, MusicShowPayload[]>();
  for (const row of data as never[]) {
    const e = row as never as {
      id: number; title: string; start_date: string;
      start_time: string | null; doors_time: string | null; image_url: string | null;
      is_free: boolean | null; is_curator_pick: boolean | null; is_tentpole: boolean | null;
      importance: string | null; festival_id: string | null;
      ticket_status: string | null; ticket_url: string | null; age_policy: string | null;
      featured_blurb: string | null; tags: string[] | null; genres: string[] | null;
      price_min: number | null;
      place: {
        id: number; name: string; slug: string; neighborhood: string | null;
        image_url: string | null; hero_image_url: string | null; short_description: string | null;
        music_programming_style: MusicVenuePayload["music_programming_style"];
        music_venue_formats: string[]; capacity: number | null;
      };
      event_artists: Array<{
        artist_id: string | null; name: string; is_headliner: boolean | null;
        billing_order: number | null; artist: { slug: string | null } | null;
      }>;
    };
    const genre_buckets = mapTagsToBuckets([...(e.tags ?? []), ...(e.genres ?? [])]);

    if (opts.genre_buckets?.length && !genre_buckets.some((b) => opts.genre_buckets!.includes(b))) continue;
    if (opts.free_only && !e.is_free) continue;
    if (opts.under_25 && (e.price_min ?? 0) > 25) continue;
    if (opts.all_ages_only && e.age_policy !== "all_ages") continue;
    if (opts.late_night_only) {
      const eff = e.doors_time || e.start_time || "00:00";
      if (eff < "21:00") continue;
    }

    const p = e.place;
    const venue: MusicVenuePayload = {
      id: p.id, name: p.name, slug: p.slug, neighborhood: p.neighborhood,
      image_url: p.image_url, hero_image_url: p.hero_image_url,
      music_programming_style: p.music_programming_style,
      music_venue_formats: p.music_venue_formats ?? [],
      capacity: p.capacity,
      editorial_line: p.short_description,
      display_tier: classifyMusicVenue(p),
      capacity_band: capacityBand(p.capacity),
    };
    const artists = (e.event_artists ?? [])
      .map((a) => ({
        id: a.artist_id, slug: a.artist?.slug ?? null, name: a.name,
        is_headliner: a.is_headliner ?? false, billing_order: a.billing_order,
      }))
      .sort((x, y) =>
        (y.is_headliner ? 1 : 0) - (x.is_headliner ? 1 : 0) ||
        (x.billing_order ?? 999) - (y.billing_order ?? 999)
      );

    const show: MusicShowPayload = {
      id: e.id, title: e.title, start_date: e.start_date,
      start_time: e.start_time, doors_time: e.doors_time, image_url: e.image_url,
      is_free: e.is_free ?? false,
      is_curator_pick: e.is_curator_pick ?? false,
      is_tentpole: e.is_tentpole ?? false,
      importance: (e.importance ?? null) as MusicShowPayload["importance"],
      festival_id: e.festival_id,
      ticket_status: e.ticket_status, ticket_url: e.ticket_url,
      age_policy: e.age_policy, featured_blurb: e.featured_blurb,
      tags: e.tags ?? [], genres: e.genres ?? [],
      genre_buckets, venue, artists,
    };

    const list = byDay.get(show.start_date) ?? [];
    list.push(show);
    byDay.set(show.start_date, list);
  }

  const groups = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, shows]) => ({
      day_label: dayLabel(date, today),
      date,
      shows: shows.sort((a, b) =>
        ((a.doors_time || a.start_time) ?? "").localeCompare((b.doors_time || b.start_time) ?? "")
      ),
    }));

  return { groups };
}
```

- [ ] **Step 3: Route**

```typescript
// web/app/api/music/by-show/route.ts
import { NextResponse } from "next/server";
import { loadByShow } from "@/lib/music/by-show-loader";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const portal = url.searchParams.get("portal");
  if (!portal) {
    return NextResponse.json({ error: "portal query param required" }, { status: 400 });
  }
  const payload = await loadByShow(portal, {
    date: url.searchParams.get("date") ?? undefined,
    days: Number(url.searchParams.get("days") ?? 7),
    genre_buckets: url.searchParams.getAll("genre"),
    free_only: url.searchParams.get("free") === "1",
    under_25: url.searchParams.get("under25") === "1",
    all_ages_only: url.searchParams.get("all_ages") === "1",
    late_night_only: url.searchParams.get("late_night") === "1",
  });
  return NextResponse.json(payload);
}
```

- [ ] **Step 4: Tests + commit**

```bash
cd /Users/coach/Projects/LostCity/web && npx vitest run app/api/music/by-show/route.test.ts

git add web/lib/music/by-show-loader.ts web/app/api/music/by-show/route.ts web/app/api/music/by-show/route.test.ts
git commit -m "feat(music): /api/music/by-show chronological listing with filters"
```

---

## Task 14: `/api/music/residencies`

**Files:**
- Create: `web/lib/music/residencies-loader.ts`
- Create: `web/app/api/music/residencies/route.ts`
- Create: `web/app/api/music/residencies/route.test.ts`

**Context:** Reads `series` where `series_type='residency' AND category='music' AND is_active=true`, joined to next upcoming event for venue + date. Portal scoping is inherited from the event's source.

- [ ] **Step 1: Test**

```typescript
// web/app/api/music/residencies/route.test.ts
import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/music/residencies", () => {
  it("requires portal", async () => {
    expect((await GET(new Request("http://localhost/api/music/residencies") as never)).status).toBe(400);
  });

  it("returns at least some residencies when Atlanta is seeded", async () => {
    const body = await (await GET(new Request("http://localhost/api/music/residencies?portal=atlanta") as never)).json();
    expect(Array.isArray(body.residencies)).toBe(true);
  });
});
```

- [ ] **Step 2: Loader**

```typescript
// web/lib/music/residencies-loader.ts
import { createClient } from "@/lib/supabase/server";
import { getManifestForPortalSlug } from "@/lib/portal-runtime";
import { applyManifestFederatedScopeToQuery } from "@/lib/city-pulse/source-scoping";
import { getSourceAccessForPortal } from "@/lib/portal-sources";
import { capacityBand, classifyMusicVenue } from "./classification";
import type { MusicResidencyPayload, MusicVenuePayload } from "./types";

export async function loadResidencies(portalSlug: string): Promise<{ residencies: MusicResidencyPayload[] }> {
  const supabase = await createClient();
  const manifest = await getManifestForPortalSlug(portalSlug);
  if (!manifest) return { residencies: [] };
  const sourceAccess = await getSourceAccessForPortal(portalSlug);

  const { data: seriesRows } = await supabase
    .from("series")
    .select("id, title, slug, description, day_of_week, image_url")
    .eq("series_type", "residency")
    .eq("category", "music")
    .eq("is_active", true);

  if (!seriesRows) return { residencies: [] };

  const today = new Date().toISOString().slice(0, 10);

  const residencies: MusicResidencyPayload[] = [];
  for (const s of seriesRows) {
    let eq = supabase
      .from("events")
      .select(`
        id, start_date, start_time, doors_time,
        place:places!inner(
          id, name, slug, neighborhood, image_url, hero_image_url, short_description,
          music_programming_style, music_venue_formats, capacity
        )
      `)
      .eq("series_id", s.id)
      .eq("is_active", true)
      .gte("start_date", today)
      .order("start_date", { ascending: true })
      .limit(1);

    eq = applyManifestFederatedScopeToQuery(eq, manifest, {
      publicOnlyWhenNoPortal: true,
      sourceIds: sourceAccess.sourceIds,
      sourceColumn: "source_id",
    });

    const { data: next } = await eq;
    const nextEvent = next?.[0];
    if (!nextEvent) continue;  // portal-scoped: skip if no upcoming event visible

    const p = nextEvent.place as unknown as {
      id: number; name: string; slug: string; neighborhood: string | null;
      image_url: string | null; hero_image_url: string | null; short_description: string | null;
      music_programming_style: MusicVenuePayload["music_programming_style"];
      music_venue_formats: string[]; capacity: number | null;
    };
    const venue: MusicVenuePayload = {
      id: p.id, name: p.name, slug: p.slug, neighborhood: p.neighborhood,
      image_url: p.image_url, hero_image_url: p.hero_image_url,
      music_programming_style: p.music_programming_style,
      music_venue_formats: p.music_venue_formats ?? [],
      capacity: p.capacity,
      editorial_line: p.short_description,
      display_tier: classifyMusicVenue(p),
      capacity_band: capacityBand(p.capacity),
    };

    residencies.push({
      id: s.id,
      title: s.title,
      slug: s.slug,
      description: s.description,
      day_of_week: s.day_of_week,
      image_url: s.image_url,
      venue,
      next_event: {
        id: nextEvent.id,
        start_date: nextEvent.start_date,
        start_time: nextEvent.start_time,
        doors_time: nextEvent.doors_time,
      },
    });
  }

  residencies.sort((a, b) =>
    (a.next_event?.start_date ?? "9999").localeCompare(b.next_event?.start_date ?? "9999")
  );

  return { residencies };
}
```

- [ ] **Step 3: Route**

```typescript
// web/app/api/music/residencies/route.ts
import { NextResponse } from "next/server";
import { loadResidencies } from "@/lib/music/residencies-loader";

export const runtime = "nodejs";
export const revalidate = 300;  // 5 min — residencies are slow-moving

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const portal = url.searchParams.get("portal");
  if (!portal) {
    return NextResponse.json({ error: "portal query param required" }, { status: 400 });
  }
  return NextResponse.json(await loadResidencies(portal));
}
```

- [ ] **Step 4: Tests + commit**

```bash
cd /Users/coach/Projects/LostCity/web && npx vitest run app/api/music/residencies/route.test.ts

git add web/lib/music/residencies-loader.ts web/app/api/music/residencies/route.ts web/app/api/music/residencies/route.test.ts
git commit -m "feat(music): /api/music/residencies surfaced via series_type='residency'"
```

---

## Task 15: `/api/music/festivals-horizon`

**Files:**
- Create: `web/lib/music/festivals-horizon-loader.ts`
- Create: `web/app/api/music/festivals-horizon/route.ts`
- Create: `web/app/api/music/festivals-horizon/route.test.ts`

**Context:** Reads `festivals` with `start_date` within 90 days. Sorts by `start_date` ascending. Adds a `days_away` field computed at query time.

- [ ] **Step 1: Test**

```typescript
// web/app/api/music/festivals-horizon/route.test.ts
import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/music/festivals-horizon", () => {
  it("requires portal", async () => {
    expect((await GET(new Request("http://localhost/api/music/festivals-horizon") as never)).status).toBe(400);
  });

  it("returns festivals sorted by date ascending", async () => {
    const body = await (await GET(new Request("http://localhost/api/music/festivals-horizon?portal=atlanta") as never)).json();
    expect(Array.isArray(body.festivals)).toBe(true);
    if (body.festivals.length > 1) {
      for (let i = 1; i < body.festivals.length; i++) {
        expect(body.festivals[i].days_away >= body.festivals[i - 1].days_away).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: Loader**

```typescript
// web/lib/music/festivals-horizon-loader.ts
import { createClient } from "@/lib/supabase/server";
import { getManifestForPortalSlug } from "@/lib/portal-runtime";
import { mapTagsToBuckets } from "./genre-map";
import type { FestivalHorizonPayload } from "./types";

export async function loadFestivalsHorizon(portalSlug: string): Promise<FestivalHorizonPayload> {
  const supabase = await createClient();
  const manifest = await getManifestForPortalSlug(portalSlug);
  if (!manifest) return { festivals: [] };

  const today = new Date();
  const end = new Date(today);
  end.setDate(today.getDate() + 90);
  const todayIso = today.toISOString().slice(0, 10);
  const endIso = end.toISOString().slice(0, 10);

  // Festivals table carries portal scope via owner_portal_id; enforce.
  const { data } = await supabase
    .from("festivals")
    .select(`
      id, slug, name, start_date, end_date, image_url, tags, genres, description,
      place:places(name, neighborhood)
    `)
    .eq("owner_portal_id", manifest.portalId)
    .eq("is_active", true)
    .gte("start_date", todayIso)
    .lte("start_date", endIso)
    .order("start_date", { ascending: true });

  if (!data) return { festivals: [] };

  const festivals = data.map((f) => {
    const days_away = Math.ceil(
      (new Date(f.start_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    const buckets = mapTagsToBuckets([...(f.tags ?? []), ...(f.genres ?? [])]);
    const place = f.place as unknown as { name: string | null; neighborhood: string | null } | null;
    return {
      id: f.id,
      slug: f.slug,
      name: f.name,
      start_date: f.start_date,
      end_date: f.end_date ?? f.start_date,
      venue_name: place?.name ?? null,
      neighborhood: place?.neighborhood ?? null,
      days_away,
      headliner_teaser: (f.description ?? "").slice(0, 80) || null,
      genre_bucket: buckets[0] ?? null,
      image_url: f.image_url,
    };
  });

  return { festivals };
}
```

- [ ] **Step 3: Route + test + commit**

```typescript
// web/app/api/music/festivals-horizon/route.ts
import { NextResponse } from "next/server";
import { loadFestivalsHorizon } from "@/lib/music/festivals-horizon-loader";

export const runtime = "nodejs";
export const revalidate = 3600;  // 1 hr — festivals don't change often

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const portal = url.searchParams.get("portal");
  if (!portal) {
    return NextResponse.json({ error: "portal query param required" }, { status: 400 });
  }
  return NextResponse.json(await loadFestivalsHorizon(portal));
}
```

```bash
cd /Users/coach/Projects/LostCity/web && npx vitest run app/api/music/festivals-horizon/route.test.ts

git add web/lib/music/festivals-horizon-loader.ts web/app/api/music/festivals-horizon/route.ts web/app/api/music/festivals-horizon/route.test.ts
git commit -m "feat(music): /api/music/festivals-horizon — 90-day window"
```

---

## Task 16: `/api/music/on-sale`

**Files:**
- Create: `web/lib/music/on-sale-loader.ts`
- Create: `web/app/api/music/on-sale/route.ts`
- Create: `web/app/api/music/on-sale/route.test.ts`

**Context:** Music shows with `start_date` between `today + 60d` and `today + 180d`, sorted by `created_at` DESC. V1 proxy for "recently announced"; v2 uses a dedicated `on_sale_date` crawler field.

- [ ] **Step 1-4: Follow same pattern as Tasks 10-15. Reuse the show-payload build (consider extracting to a shared helper if it becomes painful — note for Task 18 refactor)**

```typescript
// web/lib/music/on-sale-loader.ts
import { createClient } from "@/lib/supabase/server";
import { getManifestForPortalSlug } from "@/lib/portal-runtime";
import { applyManifestFederatedScopeToQuery } from "@/lib/city-pulse/source-scoping";
import { getSourceAccessForPortal } from "@/lib/portal-sources";
import { classifyMusicVenue, capacityBand } from "./classification";
import { mapTagsToBuckets } from "./genre-map";
import type { MusicShowPayload, MusicVenuePayload, OnSalePayload } from "./types";

export async function loadOnSale(portalSlug: string, limit = 30): Promise<OnSalePayload> {
  const supabase = await createClient();
  const manifest = await getManifestForPortalSlug(portalSlug);
  if (!manifest) return { shows: [] };
  const sourceAccess = await getSourceAccessForPortal(portalSlug);

  const today = new Date();
  const start = new Date(today); start.setDate(today.getDate() + 60);
  const end = new Date(today); end.setDate(today.getDate() + 180);

  let q = supabase
    .from("events")
    .select(`
      id, title, start_date, start_time, doors_time, image_url, created_at,
      is_free, is_curator_pick, is_tentpole, importance, festival_id,
      ticket_status, ticket_url, age_policy, featured_blurb,
      tags, genres,
      place:places!inner(
        id, name, slug, neighborhood, image_url, hero_image_url, short_description,
        music_programming_style, music_venue_formats, capacity
      ),
      event_artists(artist_id, name, is_headliner, billing_order,
        artist:artists(slug))
    `)
    .eq("category_id", "music")
    .eq("is_active", true)
    .gte("start_date", start.toISOString().slice(0, 10))
    .lte("start_date", end.toISOString().slice(0, 10))
    .order("created_at", { ascending: false })
    .limit(limit);

  q = applyManifestFederatedScopeToQuery(q, manifest, {
    publicOnlyWhenNoPortal: true,
    sourceIds: sourceAccess.sourceIds,
    sourceColumn: "source_id",
  });

  const { data } = await q;
  if (!data) return { shows: [] };

  const shows: MusicShowPayload[] = data.map((row) => {
    const e = row as never as {
      id: number; title: string; start_date: string;
      start_time: string | null; doors_time: string | null; image_url: string | null;
      is_free: boolean | null; is_curator_pick: boolean | null; is_tentpole: boolean | null;
      importance: string | null; festival_id: string | null;
      ticket_status: string | null; ticket_url: string | null; age_policy: string | null;
      featured_blurb: string | null; tags: string[] | null; genres: string[] | null;
      place: {
        id: number; name: string; slug: string; neighborhood: string | null;
        image_url: string | null; hero_image_url: string | null; short_description: string | null;
        music_programming_style: MusicVenuePayload["music_programming_style"];
        music_venue_formats: string[]; capacity: number | null;
      };
      event_artists: Array<{
        artist_id: string | null; name: string; is_headliner: boolean | null;
        billing_order: number | null; artist: { slug: string | null } | null;
      }>;
    };
    const p = e.place;
    const venue: MusicVenuePayload = {
      id: p.id, name: p.name, slug: p.slug, neighborhood: p.neighborhood,
      image_url: p.image_url, hero_image_url: p.hero_image_url,
      music_programming_style: p.music_programming_style,
      music_venue_formats: p.music_venue_formats ?? [],
      capacity: p.capacity,
      editorial_line: p.short_description,
      display_tier: classifyMusicVenue(p),
      capacity_band: capacityBand(p.capacity),
    };
    const artists = (e.event_artists ?? [])
      .map((a) => ({
        id: a.artist_id, slug: a.artist?.slug ?? null, name: a.name,
        is_headliner: a.is_headliner ?? false, billing_order: a.billing_order,
      }))
      .sort((x, y) =>
        (y.is_headliner ? 1 : 0) - (x.is_headliner ? 1 : 0) ||
        (x.billing_order ?? 999) - (y.billing_order ?? 999)
      );
    return {
      id: e.id, title: e.title, start_date: e.start_date,
      start_time: e.start_time, doors_time: e.doors_time, image_url: e.image_url,
      is_free: e.is_free ?? false,
      is_curator_pick: e.is_curator_pick ?? false,
      is_tentpole: e.is_tentpole ?? false,
      importance: (e.importance ?? null) as MusicShowPayload["importance"],
      festival_id: e.festival_id,
      ticket_status: e.ticket_status, ticket_url: e.ticket_url,
      age_policy: e.age_policy, featured_blurb: e.featured_blurb,
      tags: e.tags ?? [], genres: e.genres ?? [],
      genre_buckets: mapTagsToBuckets([...(e.tags ?? []), ...(e.genres ?? [])]),
      venue, artists,
    };
  });

  return { shows };
}
```

```typescript
// web/app/api/music/on-sale/route.ts
import { NextResponse } from "next/server";
import { loadOnSale } from "@/lib/music/on-sale-loader";

export const runtime = "nodejs";
export const revalidate = 600;

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const portal = url.searchParams.get("portal");
  if (!portal) return NextResponse.json({ error: "portal query param required" }, { status: 400 });
  return NextResponse.json(await loadOnSale(portal));
}
```

```typescript
// web/app/api/music/on-sale/route.test.ts
import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/music/on-sale", () => {
  it("requires portal", async () => {
    expect((await GET(new Request("http://localhost/api/music/on-sale") as never)).status).toBe(400);
  });
  it("returns shape", async () => {
    const res = await GET(new Request("http://localhost/api/music/on-sale?portal=atlanta") as never);
    const body = await res.json();
    expect(Array.isArray(body.shows)).toBe(true);
  });
});
```

```bash
cd /Users/coach/Projects/LostCity/web && npx vitest run app/api/music/on-sale/route.test.ts
git add web/lib/music/on-sale-loader.ts web/app/api/music/on-sale/route.ts web/app/api/music/on-sale/route.test.ts
git commit -m "feat(music): /api/music/on-sale — recently-announced 2-6 month window"
```

---

## Task 17: Refactor — extract shared `buildShowPayload` helper

**Files:**
- Create: `web/lib/music/build-show-payload.ts`
- Create: `web/lib/music/build-show-payload.test.ts`
- Modify: all six loaders that duplicate the show-payload shape

**Context:** Tasks 10-16 duplicate the row→MusicShowPayload transform across six loaders. Extract once. DRY after TDD — not before.

- [ ] **Step 1: Write the shared helper**

```typescript
// web/lib/music/build-show-payload.ts
import { classifyMusicVenue, capacityBand } from "./classification";
import { mapTagsToBuckets } from "./genre-map";
import type { MusicShowPayload, MusicVenuePayload } from "./types";

export interface RawEventRow {
  id: number; title: string; start_date: string;
  start_time: string | null; doors_time: string | null; image_url: string | null;
  is_free: boolean | null; is_curator_pick: boolean | null; is_tentpole: boolean | null;
  importance: string | null; festival_id: string | null;
  ticket_status: string | null; ticket_url: string | null; age_policy: string | null;
  featured_blurb: string | null; tags: string[] | null; genres: string[] | null;
  place: {
    id: number; name: string; slug: string; neighborhood: string | null;
    image_url: string | null; hero_image_url: string | null; short_description: string | null;
    music_programming_style: MusicVenuePayload["music_programming_style"];
    music_venue_formats: string[]; capacity: number | null;
  };
  event_artists: Array<{
    artist_id: string | null; name: string; is_headliner: boolean | null;
    billing_order: number | null; artist: { slug: string | null } | null;
  }>;
}

export function buildShowPayload(e: RawEventRow): MusicShowPayload {
  const p = e.place;
  const venue: MusicVenuePayload = {
    id: p.id, name: p.name, slug: p.slug, neighborhood: p.neighborhood,
    image_url: p.image_url, hero_image_url: p.hero_image_url,
    music_programming_style: p.music_programming_style,
    music_venue_formats: p.music_venue_formats ?? [],
    capacity: p.capacity,
    editorial_line: p.short_description,
    display_tier: classifyMusicVenue(p),
    capacity_band: capacityBand(p.capacity),
  };
  const artists = (e.event_artists ?? [])
    .map((a) => ({
      id: a.artist_id, slug: a.artist?.slug ?? null, name: a.name,
      is_headliner: a.is_headliner ?? false, billing_order: a.billing_order,
    }))
    .sort((x, y) =>
      (y.is_headliner ? 1 : 0) - (x.is_headliner ? 1 : 0) ||
      (x.billing_order ?? 999) - (y.billing_order ?? 999)
    );
  return {
    id: e.id, title: e.title, start_date: e.start_date,
    start_time: e.start_time, doors_time: e.doors_time, image_url: e.image_url,
    is_free: e.is_free ?? false,
    is_curator_pick: e.is_curator_pick ?? false,
    is_tentpole: e.is_tentpole ?? false,
    importance: (e.importance ?? null) as MusicShowPayload["importance"],
    festival_id: e.festival_id,
    ticket_status: e.ticket_status, ticket_url: e.ticket_url,
    age_policy: e.age_policy, featured_blurb: e.featured_blurb,
    tags: e.tags ?? [], genres: e.genres ?? [],
    genre_buckets: mapTagsToBuckets([...(e.tags ?? []), ...(e.genres ?? [])]),
    venue, artists,
  };
}
```

- [ ] **Step 2: Test**

```typescript
// web/lib/music/build-show-payload.test.ts
import { describe, expect, it } from "vitest";
import { buildShowPayload } from "./build-show-payload";

describe("buildShowPayload", () => {
  it("maps a minimal row correctly", () => {
    const payload = buildShowPayload({
      id: 1, title: "Show", start_date: "2026-04-20",
      start_time: "20:00", doors_time: "19:00", image_url: null,
      is_free: false, is_curator_pick: true, is_tentpole: false,
      importance: "major", festival_id: null,
      ticket_status: "tickets-available", ticket_url: null, age_policy: null,
      featured_blurb: null, tags: ["indie-rock"], genres: null,
      place: {
        id: 5, name: "Venue", slug: "venue", neighborhood: "EAV",
        image_url: null, hero_image_url: null, short_description: null,
        music_programming_style: "curated_indie",
        music_venue_formats: ["standing_room"], capacity: 200,
      },
      event_artists: [],
    });
    expect(payload.venue.display_tier).toBe("editorial");
    expect(payload.venue.capacity_band).toBe("intimate");
    expect(payload.genre_buckets).toEqual(["Rock"]);
    expect(payload.is_curator_pick).toBe(true);
  });

  it("orders headliner before support by billing_order", () => {
    const payload = buildShowPayload({
      id: 1, title: "Show", start_date: "2026-04-20",
      start_time: null, doors_time: null, image_url: null,
      is_free: null, is_curator_pick: null, is_tentpole: null,
      importance: null, festival_id: null,
      ticket_status: null, ticket_url: null, age_policy: null,
      featured_blurb: null, tags: null, genres: null,
      place: {
        id: 1, name: "V", slug: "v", neighborhood: null,
        image_url: null, hero_image_url: null, short_description: null,
        music_programming_style: null, music_venue_formats: [], capacity: null,
      },
      event_artists: [
        { artist_id: "a", name: "Support", is_headliner: false, billing_order: 2, artist: null },
        { artist_id: "b", name: "Headliner", is_headliner: true, billing_order: 1, artist: null },
      ],
    });
    expect(payload.artists[0].name).toBe("Headliner");
    expect(payload.artists[1].name).toBe("Support");
  });
});
```

- [ ] **Step 3: Replace inlined copies in six loaders with `import { buildShowPayload } from "./build-show-payload"`**

In each of: `this-week-loader.ts`, `tonight-loader.ts`, `by-venue-loader.ts`, `by-show-loader.ts`, `on-sale-loader.ts` — remove the inline `MusicShowPayload` construction block and call `buildShowPayload(row)` instead.

- [ ] **Step 4: Run full test suite**

```bash
cd /Users/coach/Projects/LostCity/web && npx vitest run lib/music app/api/music
```

Expected: all tests still pass.

- [ ] **Step 5: Commit**

```bash
git add web/lib/music/build-show-payload.ts web/lib/music/build-show-payload.test.ts \
        web/lib/music/*-loader.ts
git commit -m "refactor(music): extract buildShowPayload helper, DRY the six loaders"
```

---

## Task 18: Doors_time crawler extension — Tier-1 venues

**Files:**
- Modify: `crawlers/sources/terminal_west.py`
- Modify: `crawlers/sources/variety_playhouse.py` (or equivalent)
- Modify: `crawlers/sources/tabernacle_atlanta.py`
- Modify: `crawlers/sources/the_eastern.py`
- Modify: `crawlers/sources/city_winery_atlanta.py`
- Modify: `crawlers/sources/eddies_attic.py`
- Modify: `crawlers/sources/red_light_cafe.py`
- Modify: `crawlers/sources/five_two_nine.py`
- Modify: `crawlers/sources/the_earl.py`
- Modify: `crawlers/sources/center_stage_atlanta.py`
- Modify: `crawlers/sources/masquerade_atlanta.py`
- Modify: `crawlers/sources/buckhead_theatre.py`

**Context:** Spec §12 risk #2 — `doors_time` is at 1% fill, biggest gap. Target 40%+ on these 11 venues before Plan 2 (feed widget) ships. Pattern: most crawlers parse HTML with "Doors: X PM" or "Doors open at X" text. A shared utility (`crawlers/extractors/doors_time.py`) makes this one-and-done.

- [ ] **Step 1: Create shared extractor**

```python
# crawlers/extractors/doors_time.py
"""
Extract doors_time from free-form text using common music venue patterns.
Returns HH:MM (24h) or None.
"""
import re
from typing import Optional

# Ordered by specificity.
DOORS_PATTERNS = [
    re.compile(r"doors?\s*(?:open)?\s*(?:at)?\s*[:\-]?\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)", re.IGNORECASE),
    re.compile(r"doors?\s*[:\-]\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)", re.IGNORECASE),
    re.compile(r"(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\s*doors?", re.IGNORECASE),
]


def extract_doors_time(text: Optional[str]) -> Optional[str]:
    if not text:
        return None
    for pattern in DOORS_PATTERNS:
        match = pattern.search(text)
        if match:
            hour = int(match.group(1))
            minute = int(match.group(2) or 0)
            period = match.group(3).lower().replace(".", "")
            if 1 <= hour <= 12 and 0 <= minute <= 59:
                hour24 = hour % 12
                if period.startswith("p"):
                    hour24 += 12
                return f"{hour24:02d}:{minute:02d}"
    return None
```

- [ ] **Step 2: Test the extractor**

```python
# crawlers/tests/test_doors_time.py
from crawlers.extractors.doors_time import extract_doors_time


def test_doors_open_at_7pm():
    assert extract_doors_time("Doors open at 7 PM") == "19:00"
    assert extract_doors_time("doors: 8:30 pm") == "20:30"
    assert extract_doors_time("DOORS 7PM / SHOW 8PM") == "19:00"
    assert extract_doors_time("7:00 PM Doors") == "19:00"


def test_no_doors_info():
    assert extract_doors_time("Show at 8 pm") is None
    assert extract_doors_time(None) is None
    assert extract_doors_time("") is None


def test_am_doors():
    assert extract_doors_time("Doors at 11 AM") == "11:00"
```

```bash
cd /Users/coach/Projects/LostCity && pytest crawlers/tests/test_doors_time.py -v
```

- [ ] **Step 3: Integrate into each Tier-1 venue crawler**

For each of the 11 crawlers listed at the top of this task: find where an event dict is built, add:

```python
from crawlers.extractors.doors_time import extract_doors_time

# In the event-build block:
doors = extract_doors_time(raw_event_description or raw_event_subtitle or "")
if doors:
    event["doors_time"] = doors
```

Each crawler has its own description field; grep first:

```bash
grep -n "description\|subtitle\|body" crawlers/sources/terminal_west.py
# Pick the best free-text field; parse it through extract_doors_time.
```

- [ ] **Step 4: Run each crawler once (dry run or limited scope) to verify uplift**

```bash
cd /Users/coach/Projects/LostCity
python -m crawlers.main --source terminal_west --limit 10 --dry-run
# Inspect the printed events; confirm doors_time populated where text mentions doors.
```

Repeat for the other 10. For any venue where the text pattern is substantially different (e.g., Eddie's Attic listings use a `<span class="doors">7:30PM</span>` HTML element, not free text), parse that element directly rather than run the free-text extractor — add a venue-specific branch but still call `extract_doors_time` on the extracted string.

- [ ] **Step 5: Check fill rate after a real crawler run**

```bash
psql "$(npx supabase status -o json | jq -r '.DB_URL')" -c "
  SELECT p.slug, count(*) AS events,
         count(e.doors_time) AS with_doors,
         (count(e.doors_time)::float / count(*) * 100)::int AS pct_fill
  FROM events e JOIN places p ON p.id = e.place_id
  WHERE p.slug IN ('terminal-west','variety-playhouse','tabernacle-atlanta','the-eastern',
                   'city-winery-atlanta','eddies-attic','red-light-cafe','529',
                   'the-earl','center-stage-atlanta','buckhead-theatre')
    AND e.category_id = 'music'
    AND e.start_date >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY p.slug ORDER BY pct_fill DESC;
"
```

Expected: Tier-1 venues at 40%+ fill. If a venue is below 20%, that crawler needs another pass. **Gate:** Plan 2 cannot ship until average fill across these 11 venues is >= 40%.

- [ ] **Step 6: Commit**

```bash
git add crawlers/extractors/doors_time.py crawlers/tests/test_doors_time.py crawlers/sources/*.py
git commit -m "feat(crawl): extract doors_time across Tier-1 music venues"
```

---

## Task 19: Ghost-venue runtime guard

**Files:**
- Modify: `web/lib/music/classification.ts`
- Modify: `web/lib/music/classification.test.ts`

**Context:** Spec §12 risk #3. A seeded tier venue with zero recent events must not render as an empty block on the explore page. Add a `isGhostVenue(capacityBand, recentEventCount)` helper and a `filterGhosts` wrapper the loaders use when grouping.

- [ ] **Step 1: Test**

Append to `web/lib/music/classification.test.ts`:

```typescript
import { filterGhostVenues, GHOST_VENUE_LOOKBACK_DAYS } from "./classification";

describe("filterGhostVenues", () => {
  const group = (slug: string, count: number) => ({
    venue: { slug } as never,
    shows: Array(count).fill(null) as never,
  });

  it("keeps venues with events", () => {
    const result = filterGhostVenues([group("eddies-attic", 3)]);
    expect(result).toHaveLength(1);
  });

  it("drops venues with zero shows in window", () => {
    const result = filterGhostVenues([group("ghost", 0)]);
    expect(result).toHaveLength(0);
  });

  it("keeps pinned venues even when zero-show (user intent wins)", () => {
    const result = filterGhostVenues([group("ghost", 0)], { pinned: new Set(["ghost"]) });
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Implement**

```typescript
// in web/lib/music/classification.ts, append:
export function filterGhostVenues<T extends { venue: { slug: string }; shows: unknown[] }>(
  groups: T[],
  opts: { pinned?: Set<string> } = {},
): T[] {
  return groups.filter((g) => g.shows.length > 0 || opts.pinned?.has(g.venue.slug));
}
```

- [ ] **Step 3: Integrate into `by-venue-loader.ts`**

Wrap each group array (editorial, marquee, additional) in `filterGhostVenues(...)`; pass `pinned: new Set(opts.pinned_slugs ?? [])` through to preserve pinned-even-if-empty behavior.

- [ ] **Step 4: Run suite + commit**

```bash
cd /Users/coach/Projects/LostCity/web && npx vitest run lib/music
git add web/lib/music/classification.ts web/lib/music/classification.test.ts web/lib/music/by-venue-loader.ts
git commit -m "feat(music): filterGhostVenues prevents empty venue blocks on explore page"
```

---

## Task 20: Integration test — end-to-end portal isolation

**Files:**
- Create: `web/app/api/music/_integration.test.ts`

**Context:** Spec §10 bullet 5. All seven routes must return only portal-scoped data. Regression test that a non-Atlanta portal sees different (or empty) results.

- [ ] **Step 1: Test**

```typescript
// web/app/api/music/_integration.test.ts
import { describe, expect, it } from "vitest";

const routes = [
  "/api/music/this-week",
  "/api/music/tonight",
  "/api/music/by-venue",
  "/api/music/by-show",
  "/api/music/residencies",
  "/api/music/festivals-horizon",
  "/api/music/on-sale",
];

describe("Music API portal isolation", () => {
  it.each(routes)("%s rejects missing portal", async (path) => {
    const res = await fetch(`http://localhost:3000${path}`);
    expect(res.status).toBe(400);
  });

  it.each(routes)("%s returns OK for a known portal", async (path) => {
    const res = await fetch(`http://localhost:3000${path}?portal=atlanta`);
    expect(res.status).toBe(200);
  });

  it.each(routes)("%s returns empty for a nonexistent portal without erroring", async (path) => {
    const res = await fetch(`http://localhost:3000${path}?portal=nonexistent-portal-xyz`);
    expect(res.status).toBe(200);
    const body = await res.json();
    // Every route returns an empty collection; key varies.
    const collections = Object.values(body).filter(Array.isArray);
    expect(collections.every((c) => (c as unknown[]).length === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run with dev server up**

```bash
cd /Users/coach/Projects/LostCity/web && npm run dev &
sleep 5
npx vitest run app/api/music/_integration.test.ts
kill %1
```

- [ ] **Step 3: Commit**

```bash
git add web/app/api/music/_integration.test.ts
git commit -m "test(music): portal-isolation regression for all 7 routes"
```

---

## Completion Checklist

Run before declaring Plan 1 done:

- [ ] All tests green: `cd web && npx vitest run lib/music app/api/music && cd .. && pytest crawlers/tests/test_doors_time.py`
- [ ] TypeScript clean: `cd web && npx tsc --noEmit`
- [ ] Lint clean: `cd web && npm run lint`
- [ ] Doors_time fill rate query (Task 18 Step 5) shows average >= 40% on Tier-1 venues
- [ ] Ghost-venue query shows zero seeded venues with 0 events in last 14 days
- [ ] Dedupe query shows no active duplicate place-name groups
- [ ] All seven API routes return valid payloads for `portal=atlanta`
- [ ] Integration test (Task 20) passes

---

## Self-Review Notes

- Spec §2 Phase 1 data hygiene → Tasks 3 (dedupe) + 18 (doors_time) + 4 (tier seed with ghost-venue policy) + 5 (residency reclassification) ✓
- Spec §3 venue tiering seed → Task 4 ✓
- Spec §5 signal vocabulary → `MusicShowPayload` covers all fields ✓
- Spec §6 cascade → Task 10 cascade ranker ✓
- Spec §7.4 By Show grouping → Task 13 ✓
- Spec §7.5 Residencies data → Tasks 5 + 14 ✓
- Spec §8.1/8.2/8.3 new fields → Tasks 1 + 2 ✓
- Spec §10 portal isolation → Task 20 integration test ✓
- Spec §12 risks #1-8 → each addressed in a corresponding task or explicitly cut (press quotes)
