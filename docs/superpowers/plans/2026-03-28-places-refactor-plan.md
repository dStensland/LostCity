# Places Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename venues → places across the entire platform (database, API, types, components, crawlers) with zero downtime via phased migration.

**Architecture:** Code migration first, table rename last. The DB table stays as `venues` throughout the code migration. The application layer (types, components, API routes) progressively adopts "places" terminology. Extension tables (`place_profile`, `place_vertical_details`) are additive. PostGIS added. The final table rename is a mechanical find-replace once all code semantically uses "places."

**Tech Stack:** PostgreSQL 15 (Supabase), PostGIS, Next.js 16, TypeScript, Python crawlers

**Spec:** `docs/superpowers/specs/2026-03-28-places-refactor-design.md`

---

## Critical Design Decision: Why Code First, Rename Last

PostgREST (used by Supabase) resolves FK joins via `pg_constraint` on real tables. Views do NOT have FK constraints. If we rename `venues` → `places` and create a `venues` view, all 30+ files using `venue:venues(id, name, ...)` join syntax break because PostgREST cannot resolve FKs through views.

**Solution:** Keep `venues` as the real table throughout the code migration. The application layer says "Place" everywhere (types, components, routes), but Supabase query strings internally reference `venues` until the final rename. The last deploy is a mechanical string replacement: `.from("venues")` → `.from("places")`, `venue:venues(...)` → `place:places(...)`.

---

## Deploy Sequence Overview

| Deploy | Name | Scope | Risk | Parallel? |
|--------|------|-------|------|-----------|
| 1 | Schema: Additive | PostGIS + extension tables + candidates + RLS | LOW | No |
| 2 | Types Foundation | `Place` types wrapping venue DB response | LOW | No |
| 3 | Component Renames | All 27 Venue*.tsx → Place*.tsx | MED | Yes (with 4, 5) |
| 4 | Search + Lib Migration | Search/spot/tag/feature lib files | MED | Yes (with 3, 5) |
| 5 | Destinations + Explore | Destination/yonder/explore modules | MED | Yes (with 3, 4) |
| 6 | API Routes | /api/venues/* → /api/places/* | MED | No |
| 7 | Feed Pipeline | CityPulse, portal-feed-loader, sections | HIGH | No |
| 8 | Crawler Abstraction | Core DB modules + pipeline | HIGH | No |
| 9 | Crawler Bulk Rename | 1,052 source files | HIGH | No |
| 10 | **Final Table Rename** | `ALTER TABLE venues RENAME TO places` + all query string updates | CRITICAL | No |
| 11 | Cleanup | Drop deprecated columns, old routes, aliases | LOW | No |

---

## Task 1: Schema — Additive Changes (No Rename)

**Goal:** Add PostGIS, create extension tables, create candidates table, add RLS. The `venues` table stays as `venues`. Everything is additive — zero breaking changes.

**Files:**
- Create: `supabase/migrations/YYYYMMDD_places_postgis.sql`
- Create: `supabase/migrations/YYYYMMDD_places_extension_tables.sql`
- Create: `supabase/migrations/YYYYMMDD_places_data_backfill.sql`

### Migration 1a: PostGIS + coordinate validation + RLS

- [ ] **Step 1: Write migration**

```sql
-- Add PostGIS generated column to venues
ALTER TABLE venues ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS google_place_id TEXT;

ALTER TABLE venues ADD COLUMN IF NOT EXISTS location GEOGRAPHY(POINT, 4326)
  GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
  ) STORED;

-- Coordinate validation
ALTER TABLE venues ADD CONSTRAINT valid_coordinates CHECK (
  (lat IS NULL AND lng IS NULL) OR
  (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180)
);

-- Spatial index (partial — skip NULLs)
CREATE INDEX IF NOT EXISTS idx_venues_location ON venues USING GIST (location)
  WHERE location IS NOT NULL;

-- Enable RLS on venues (currently has none)
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "venues_read" ON venues FOR SELECT USING (true);
CREATE POLICY "venues_write" ON venues FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

- [ ] **Step 2: Test locally** — `supabase db reset` (or verify against staging)
- [ ] **Step 3: Verify** — `SELECT location FROM venues WHERE lat IS NOT NULL LIMIT 5;` returns geography data

### Migration 1b: Extension tables

- [ ] **Step 4: Write `place_profile` table**

```sql
CREATE TABLE place_profile (
  place_id                  INTEGER PRIMARY KEY REFERENCES venues(id) ON DELETE CASCADE,
  description               TEXT,
  short_description         TEXT,
  hero_image_url            TEXT,
  gallery_urls              TEXT[],
  featured                  BOOLEAN DEFAULT false,
  explore_category          TEXT,
  explore_blurb             TEXT,
  parking_type              TEXT CHECK (parking_type IN (
                              'free_lot', 'paid_lot', 'street', 'garage', 'none')),
  parking                   TEXT,
  transit_accessible        BOOLEAN,
  transit_notes             TEXT,
  capacity                  INTEGER,
  planning_notes            TEXT,
  planning_last_verified_at TIMESTAMPTZ,
  wheelchair_accessible     BOOLEAN,
  family_suitability        TEXT CHECK (family_suitability IN ('yes', 'no', 'caution')),
  age_min                   INTEGER,
  age_max                   INTEGER,
  sensory_notes             TEXT,
  accessibility_notes       TEXT,
  library_pass              JSONB,
  last_verified_at          TIMESTAMPTZ,
  updated_at                TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE place_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profile_read" ON place_profile FOR SELECT USING (true);
CREATE POLICY "profile_write" ON place_profile FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

- [ ] **Step 5: Write `place_vertical_details` table**

```sql
CREATE TABLE place_vertical_details (
  place_id    INTEGER PRIMARY KEY REFERENCES venues(id) ON DELETE CASCADE,
  dining      JSONB,
  outdoor     JSONB,
  civic       JSONB,
  google      JSONB,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_place_vertical_dining ON place_vertical_details
  USING GIN (dining) WHERE dining IS NOT NULL;
CREATE INDEX idx_place_vertical_outdoor ON place_vertical_details
  USING GIN (outdoor) WHERE outdoor IS NOT NULL;

ALTER TABLE place_vertical_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vertical_read" ON place_vertical_details FOR SELECT USING (true);
CREATE POLICY "vertical_write" ON place_vertical_details FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

- [ ] **Step 6: Write `place_candidates` table**

```sql
CREATE TABLE place_candidates (
  id                      SERIAL PRIMARY KEY,
  raw_name                TEXT NOT NULL,
  raw_address             TEXT,
  lat                     DECIMAL(10, 8),
  lng                     DECIMAL(11, 8),
  source_id               INTEGER REFERENCES sources(id),
  discovered_by_portal_id INTEGER REFERENCES portals(id),
  matched_venue_id        INTEGER REFERENCES venues(id),
  match_confidence        DECIMAL(3, 2),
  match_method            TEXT,
  status                  TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'confirmed', 'rejected', 'merged')),
  promoted_to_venue_id    INTEGER REFERENCES venues(id),
  reviewed_by             UUID REFERENCES auth.users(id),
  reviewed_at             TIMESTAMPTZ,
  raw_data                JSONB,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_candidate_coordinates CHECK (
    (lat IS NULL AND lng IS NULL) OR
    (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180)
  )
);

CREATE INDEX idx_place_candidates_status ON place_candidates (status) WHERE status = 'pending';
CREATE INDEX idx_place_candidates_source ON place_candidates (source_id);

ALTER TABLE place_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "candidates_read" ON place_candidates FOR SELECT
  USING (auth.role() = 'service_role' OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ));
CREATE POLICY "candidates_write" ON place_candidates FOR ALL
  USING (auth.role() = 'service_role' OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ))
  WITH CHECK (auth.role() = 'service_role' OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ));
```

- [ ] **Step 7: Write `merge_places` function**

```sql
CREATE OR REPLACE FUNCTION merge_venues(p_keep_id INTEGER, p_remove_id INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE events SET venue_id = p_keep_id WHERE venue_id = p_remove_id;
  UPDATE venue_occasions SET venue_id = p_keep_id WHERE venue_id = p_remove_id
    ON CONFLICT (venue_id, occasion) DO NOTHING;
  UPDATE venue_specials SET venue_id = p_keep_id WHERE venue_id = p_remove_id;
  UPDATE editorial_mentions SET venue_id = p_keep_id WHERE venue_id = p_remove_id
    ON CONFLICT (article_url, venue_id) DO NOTHING;
  UPDATE programs SET venue_id = p_keep_id WHERE venue_id = p_remove_id;
  UPDATE exhibitions SET venue_id = p_keep_id WHERE venue_id = p_remove_id;
  UPDATE open_calls SET venue_id = p_keep_id WHERE venue_id = p_remove_id;
  UPDATE walkable_neighbors SET venue_id = p_keep_id WHERE venue_id = p_remove_id;
  UPDATE walkable_neighbors SET neighbor_id = p_keep_id WHERE neighbor_id = p_remove_id;
  -- Merge aliases
  UPDATE venues SET aliases = (
    SELECT array_agg(DISTINCT a) FROM (
      SELECT unnest(aliases) AS a FROM venues WHERE id IN (p_keep_id, p_remove_id)
    ) sub
  ) WHERE id = p_keep_id;
  -- Soft-delete duplicate
  UPDATE venues SET active = false WHERE id = p_remove_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Note: Named `merge_venues` while table is still `venues`. Renamed to `merge_places` in Deploy 10.

### Migration 1c: Data backfill

- [ ] **Step 8: Backfill extension tables from existing venue columns**

```sql
-- Backfill place_vertical_details.outdoor from venue_destination_details
INSERT INTO place_vertical_details (place_id, outdoor, updated_at)
SELECT venue_id, jsonb_build_object(
  'destination_type', destination_type,
  'commitment_tier', commitment_tier,
  'primary_activity', primary_activity,
  'drive_time_minutes', drive_time_minutes,
  'difficulty_level', difficulty_level,
  'trail_length_miles', trail_length_miles,
  'elevation_gain_ft', elevation_gain_ft,
  'surface_type', surface_type,
  'best_seasons', best_seasons,
  'weather_fit_tags', weather_fit_tags,
  'practical_notes', practical_notes,
  'conditions_notes', conditions_notes,
  'best_time_of_day', best_time_of_day,
  'dog_friendly', dog_friendly,
  'reservation_required', reservation_required,
  'permit_required', permit_required,
  'fee_note', fee_note,
  'seasonal_hazards', seasonal_hazards
), updated_at
FROM venue_destination_details;

-- Backfill place_vertical_details.dining from venues base table
INSERT INTO place_vertical_details (place_id, dining)
SELECT id, jsonb_build_object(
  'menu_url', menu_url,
  'reservation_url', reservation_url,
  'service_style', service_style,
  'meal_duration_min_minutes', meal_duration_min_minutes,
  'meal_duration_max_minutes', meal_duration_max_minutes,
  'walk_in_wait_minutes', walk_in_wait_minutes,
  'payment_buffer_minutes', payment_buffer_minutes,
  'accepts_reservations', accepts_reservations,
  'reservation_recommended', reservation_recommended
)
FROM venues
WHERE menu_url IS NOT NULL OR service_style IS NOT NULL
  OR accepts_reservations IS NOT NULL
ON CONFLICT (place_id) DO UPDATE SET
  dining = EXCLUDED.dining;

-- Backfill place_profile
INSERT INTO place_profile (
  place_id, description, short_description, hero_image_url, featured,
  explore_category, explore_blurb, planning_notes, planning_last_verified_at,
  library_pass, last_verified_at
)
SELECT
  id, description, short_description, hero_image_url, featured,
  explore_category, explore_blurb, planning_notes, planning_last_verified_at,
  library_pass, last_verified_at
FROM venues
WHERE description IS NOT NULL OR hero_image_url IS NOT NULL
  OR featured = true OR planning_notes IS NOT NULL
  OR explore_category IS NOT NULL OR library_pass IS NOT NULL;
```

- [ ] **Step 9: Run full test suite**

```bash
cd /Users/coach/Projects/LostCity/web && npx vitest run
cd /Users/coach/Projects/LostCity/crawlers && python -m pytest
```

Expected: All pass. These migrations are purely additive.

- [ ] **Step 10: Commit**

```bash
git add supabase/migrations/YYYYMMDD_places_*.sql
git commit -m "feat(schema): add PostGIS, extension tables, place_candidates for places refactor

Additive-only changes — no renames, no breaking changes.
- PostGIS geography column on venues (generated from lat/lng)
- place_profile table (1:1 enrichment)
- place_vertical_details table (JSONB per vertical)
- place_candidates staging table for dedup
- merge_venues function
- RLS on venues table
- Coordinate validation constraint"
```

### Rollback for Task 1

All additive — rollback is simply:
```sql
DROP TABLE IF EXISTS place_candidates CASCADE;
DROP TABLE IF EXISTS place_vertical_details CASCADE;
DROP TABLE IF EXISTS place_profile CASCADE;
DROP FUNCTION IF EXISTS merge_venues(INTEGER, INTEGER);
ALTER TABLE venues DROP COLUMN IF EXISTS location;
ALTER TABLE venues DROP COLUMN IF EXISTS phone;
ALTER TABLE venues DROP COLUMN IF EXISTS google_place_id;
ALTER TABLE venues DROP CONSTRAINT IF EXISTS valid_coordinates;
```

---

## Task 2: Types Foundation

**Goal:** Create `Place` TypeScript types that all subsequent code depends on. Types use "Place" naming but map to the `venues` table response.

**Files:**
- Create: `web/lib/types/places.ts`
- Modify: `web/lib/types.ts` — add re-exports + backward-compatible aliases

- [ ] **Step 1: Create `web/lib/types/places.ts`**

Write the full type file as specified in the design spec TypeScript Types section. Types say `Place`, `PlaceCard`, `PlaceProfile`, etc. but the field names match the DB columns (`venue_type` until the final rename, then `place_type`).

Note: During the migration period, the DB still returns `venue_type`, `venue_id`, etc. The types should handle this with a mapping:

```typescript
/** Base place — maps to `venues` table (renamed to `places` in final deploy) */
export interface Place {
  id: number;
  slug: string;
  name: string;
  aliases: string[] | null;
  address: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  place_type: string;           // mapped from venue_type in queries
  indoor_outdoor: 'indoor' | 'outdoor' | 'both' | null;
  location_designator: string;
  website: string | null;
  phone: string | null;
  image_url: string | null;
  hours: Record<string, unknown> | null;
  owner_portal_id: number | null;
  google_place_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Minimal card type */
export type PlaceCard = Pick<Place,
  'id' | 'slug' | 'name' | 'neighborhood' | 'place_type' |
  'image_url' | 'hours' | 'lat' | 'lng'
>;

// ... PlaceProfile, PlaceDiningDetails, PlaceOutdoorDetails, PlaceDetail
// (as defined in design spec)
```

- [ ] **Step 2: Add mapping utility**

```typescript
// web/lib/utils/place-mapping.ts

/** Maps a venue DB row to Place type during migration period */
export function mapVenueToPlace(row: any): Place {
  return {
    ...row,
    place_type: row.venue_type ?? row.place_type,
    is_active: row.active ?? row.is_active ?? true,
  };
}

/** Maps a venue DB row to PlaceCard */
export function mapVenueToPlaceCard(row: any): PlaceCard {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    neighborhood: row.neighborhood,
    place_type: row.venue_type ?? row.place_type,
    image_url: row.image_url,
    hours: row.hours,
    lat: row.lat,
    lng: row.lng,
  };
}
```

- [ ] **Step 3: Add backward-compatible aliases in `web/lib/types.ts`**

```typescript
export type { Place, PlaceCard, PlaceProfile } from './types/places';
// Backward compat — remove in final cleanup
export type Venue = Place;
export type VenueCard = PlaceCard;
```

- [ ] **Step 4: Build check**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

---

## Tasks 3-5: Parallel Code Migration

These three can be done by separate agents simultaneously since they touch different files.

### Task 3: Component Renames

**Goal:** Rename all Venue*.tsx files to Place*.tsx and update all imports.

**Files to rename:** All 27+ components with "Venue" in filename (see full list in spec).

**Pattern per component:**
- [ ] `git mv VenueCard.tsx PlaceCard.tsx`
- [ ] Rename component function/export inside file
- [ ] Rename props interface (`VenueCardProps` → `PlaceCardProps`)
- [ ] Update all imports across the codebase
- [ ] `npx tsc --noEmit` after each batch
- [ ] Commit after each logical group (leaf components, then widely-imported, then complex)

**Order:** Leaf → widely imported → complex (see spec for grouping).

**Important:** Internal Supabase queries in these components still reference `venues` table. Only the component names, prop types, and file names change.

### Task 4: Search + Lib File Migration

**Goal:** Rename venue-named lib files and update types/exports to use Place naming.

**Files to rename:**
- `web/lib/venue-tags.ts` → `web/lib/place-tags.ts`
- `web/lib/venue-tags-config.ts` → `web/lib/place-tags-config.ts`
- `web/lib/venue-features.ts` → `web/lib/place-features.ts`
- `web/lib/venue-features.test.ts` → `web/lib/place-features.test.ts`
- `web/lib/venue-highlights.ts` → `web/lib/place-highlights.ts`
- `web/lib/venue-auto-approve.ts` → `web/lib/place-auto-approve.ts`
- `web/lib/hooks/useVenueDiscovery.ts` → `web/lib/hooks/usePlaceDiscovery.ts`
- `web/lib/types/venue-destinations.ts` → `web/lib/types/place-destinations.ts`

**Files to modify (types/exports only, NOT Supabase queries):**
- `web/lib/search.ts` — export types as Place*
- `web/lib/unified-search.ts` — export types as Place*
- `web/lib/search-ranking.ts` — update type names
- `web/lib/search-preview.ts` — update type names
- `web/lib/spots.ts` — update type names
- `web/lib/spot-detail.ts` — update type names

**Important:** Supabase query strings (`.from("venues")`, `venue:venues(...)`) do NOT change yet. Only TypeScript type names, function names, and file names change.

### Task 5: Destinations + Explore Migration

**Goal:** Update destination/explore modules to use Place types.

**Files:**
- Modify: `web/lib/city-pulse/pipeline/fetch-destinations.ts` — types only
- Modify: `web/lib/forth-data.ts` — types only
- Modify: `web/lib/yonder-destination-nodes.ts` — types only
- Modify: `web/lib/yonder-provider-inventory.ts` — types only
- Modify: `web/lib/explore-tracks.ts` — types only

**Same pattern:** Type names change, Supabase query strings stay as `venues`.

---

## Task 6: API Route Migration

**Goal:** Move all /api/venues/* routes to /api/places/*. Create 308 redirects at old paths.

**Files:**
- Move: `web/app/api/venues/search/` → `web/app/api/places/search/`
- Move: `web/app/api/venues/[id]/events/` → `web/app/api/places/[id]/events/`
- Move: `web/app/api/venues/[id]/tags/` → `web/app/api/places/[id]/tags/`
- Move: `web/app/api/venues/by-slug/[slug]/edit/` → `web/app/api/places/by-slug/[slug]/edit/`
- Move: `web/app/api/venues/by-slug/[slug]/submit-event/` → `web/app/api/places/by-slug/[slug]/submit-event/`
- Move: `web/app/api/venues/claim/` → `web/app/api/places/claim/`
- Create: 308 redirect stubs at all old paths

**Important:** Internal Supabase queries still say `.from("venues")`. Only the route paths change. Add mandatory `city` parameter to search endpoint while moving it.

Per route:
- [ ] Move route file to new path
- [ ] Update response type names to Place*
- [ ] Create 308 redirect at old path
- [ ] Update client-side fetch URLs across components
- [ ] `npx tsc --noEmit`
- [ ] Commit

---

## Task 7: Feed Pipeline Migration

**Goal:** Update CityPulse feed pipeline to use Place types.

**Files (complete list — grep for venue type references in `web/lib/city-pulse/`):**
- Modify: `web/lib/city-pulse/pipeline/fetch-feed-ready.ts`
- Modify: `web/lib/city-pulse/pipeline/fetch-events.ts`
- Modify: `web/lib/city-pulse/pipeline/fetch-counts.ts`
- Modify: `web/lib/city-pulse/pipeline/build-sections.ts`
- Modify: `web/lib/city-pulse/scoring.ts`
- Modify: `web/lib/city-pulse/dashboard-cards.ts`
- Modify: `web/lib/city-pulse/quick-links.ts`
- Modify: `web/lib/city-pulse/curated-sections.ts`
- Modify: `web/lib/city-pulse/specials.ts`
- Modify: `web/lib/portal-feed-loader.ts`

**Pattern:** `FeedReadyRow` type maps `venue_*` DB columns to `place_*` TypeScript fields using the mapping utility from Task 2. Supabase query strings stay as `venue_*`.

```typescript
// In fetch-feed-ready.ts
// DB returns venue_id, venue_name, etc. — we map to Place naming
const row = mapFeedRowToPlace(rawRow);
// row.place_id, row.place_name, etc.
```

- [ ] Migrate each file (types only, not query strings)
- [ ] `npx tsc --noEmit` after each
- [ ] `npx vitest run`
- [ ] Commit

---

## Task 8: Crawler Abstraction Layer

**Goal:** Rename core crawler DB modules. Keep backward-compatible aliases.

**Files:**
- Rename: `crawlers/db/venues.py` → `crawlers/db/places.py`
- Rename: `crawlers/db/venue_validation.py` → `crawlers/db/place_validation.py`
- Rename: `crawlers/db/venue_occasions.py` → `crawlers/db/place_occasions.py`
- Rename: `crawlers/db/venue_specials.py` → `crawlers/db/place_specials.py`
- Rename: `crawlers/db/destination_details.py` → `crawlers/db/place_vertical.py`
- Rename: `crawlers/venue_enrich.py` → `crawlers/place_enrich.py`
- Rename: `crawlers/scrape_venue_specials.py` → `crawlers/scrape_place_specials.py`
- Rename: `crawlers/scrape_venue_hours.py` → `crawlers/scrape_place_hours.py`
- Modify: `crawlers/db/__init__.py` — update imports, add backward compat aliases
- Modify: `crawlers/db/events.py` — update imports
- Modify: `crawlers/pipeline_main.py` — update imports

**Important:** SQL queries inside these files still reference `venues` table. Only Python module names, function names, and variable names change.

In `crawlers/db/__init__.py`:
```python
from .places import get_or_create_place
get_or_create_venue = get_or_create_place  # backward compat
```

- [ ] Rename files with `git mv`
- [ ] Update internal imports
- [ ] Run: `python -m pytest`
- [ ] **Deploy on Monday morning, monitor 24h of cron crawls**
- [ ] Commit

---

## Task 9: Crawler Source Bulk Rename

**Goal:** Mechanical rename of function calls in 1,052 source files.

**Depends on:** Task 8 stable in production for 24h.

Replacements:
- `get_or_create_venue` → `get_or_create_place`
- `VENUE_DATA` → `PLACE_DATA`
- `venue_data` → `place_data`

**Note:** `"venue_id"` and `"venue_name_hint"` in event dicts do NOT change yet — these are DB column names and the table is still `venues`.

- [ ] Write migration script
- [ ] Run, review diff
- [ ] Run: `python -m pytest`
- [ ] Deploy on Monday, monitor 24h
- [ ] Commit

---

## Task 10: Final Table Rename (CRITICAL)

**Goal:** Rename the actual database table `venues` → `places` and update ALL query strings.

**Preconditions:** All code semantically uses "Place" naming. Only Supabase query strings still say `venues`.

**This is the only dangerous deploy.** It must be atomic: schema migration + code changes deploy together.

### Migration: The Rename

```sql
-- 1. Rename Google places table to clear the name
ALTER TABLE IF EXISTS places RENAME TO google_places_legacy;
ALTER TABLE IF EXISTS place_user_signals RENAME TO google_place_user_signals;
DROP MATERIALIZED VIEW IF EXISTS hospital_nearby_places;

-- 2. Rename venues → places
ALTER TABLE venues RENAME TO places;

-- 3. Rename columns
ALTER TABLE places RENAME COLUMN venue_type TO place_type;
ALTER TABLE places RENAME COLUMN active TO is_active;

-- 4. Convert indoor_outdoor ENUM to TEXT
ALTER TABLE places ALTER COLUMN indoor_outdoor TYPE TEXT USING indoor_outdoor::TEXT;
DROP TYPE IF EXISTS venue_environment;
ALTER TABLE places ADD CONSTRAINT chk_indoor_outdoor
  CHECK (indoor_outdoor IS NULL OR indoor_outdoor IN ('indoor', 'outdoor', 'both'));

-- 5. Rename FK columns on dependent tables
ALTER TABLE events RENAME COLUMN venue_id TO place_id;
ALTER TABLE editorial_mentions RENAME COLUMN venue_id TO place_id;
ALTER TABLE programs RENAME COLUMN venue_id TO place_id;
ALTER TABLE exhibitions RENAME COLUMN venue_id TO place_id;
ALTER TABLE open_calls RENAME COLUMN venue_id TO place_id;
ALTER TABLE places RENAME COLUMN parent_venue_id TO parent_place_id;

-- 6. Rename related tables
ALTER TABLE venue_occasions RENAME TO place_occasions;
ALTER TABLE place_occasions RENAME COLUMN venue_id TO place_id;
ALTER TABLE venue_specials RENAME TO place_specials;
ALTER TABLE place_specials RENAME COLUMN venue_id TO place_id;
ALTER TABLE venue_claims RENAME TO place_claims;
ALTER TABLE place_claims RENAME COLUMN venue_id TO place_id;
ALTER TABLE venue_tags RENAME TO place_tags;
ALTER TABLE place_tags RENAME COLUMN venue_id TO place_id;
ALTER TABLE venue_tag_summary RENAME TO place_tag_summary;
ALTER TABLE place_tag_summary RENAME COLUMN venue_id TO place_id;
ALTER TABLE venue_inventory_snapshots RENAME TO place_inventory_snapshots;
ALTER TABLE place_inventory_snapshots RENAME COLUMN venue_id TO place_id;
ALTER TABLE venue_features RENAME COLUMN venue_id TO place_id;
ALTER TABLE venue_highlights RENAME COLUMN venue_id TO place_id;
ALTER TABLE walkable_neighbors RENAME COLUMN venue_id TO place_id;
ALTER TABLE walkable_neighbors RENAME COLUMN neighbor_id TO neighbor_place_id;

-- 7. Update place_candidates FKs (reference venues → places)
ALTER TABLE place_candidates RENAME COLUMN matched_venue_id TO matched_place_id;
ALTER TABLE place_candidates RENAME COLUMN promoted_to_venue_id TO promoted_to_place_id;

-- 8. Rename merge function
DROP FUNCTION IF EXISTS merge_venues(INTEGER, INTEGER);
-- Recreate as merge_places (same body but references places table)

-- 9. Update feed_events_ready columns
ALTER TABLE feed_events_ready RENAME COLUMN venue_id TO place_id;
ALTER TABLE feed_events_ready RENAME COLUMN venue_name TO place_name;
ALTER TABLE feed_events_ready RENAME COLUMN venue_slug TO place_slug;
ALTER TABLE feed_events_ready RENAME COLUMN venue_neighborhood TO place_neighborhood;
ALTER TABLE feed_events_ready RENAME COLUMN venue_city TO place_city;
ALTER TABLE feed_events_ready RENAME COLUMN venue_type TO place_type;
ALTER TABLE feed_events_ready RENAME COLUMN venue_image_url TO place_image_url;
ALTER TABLE feed_events_ready RENAME COLUMN venue_active TO place_active;

-- 10. Update refresh_feed_events_ready function to use new names
-- 11. Update search_venues_ranked → search_places_ranked
-- 12. Update search_vector trigger to reference places
-- 13. Recreate hospital_nearby_places materialized view against places
-- 14. Update RLS policy names
```

### Code: Mechanical string replacement

This is the bulk of the work — every Supabase query string across the codebase.

**TypeScript (web/):**
- `.from("venues")` → `.from("places")` (~42 files)
- `venue:venues(` → `place:places(` (~30 files)
- `venue_id` in select strings → `place_id`
- `venue_type` in select strings → `place_type`
- `venue_name` in select strings → `place_name`
- `venue_slug` in select strings → `place_slug`
- `venue_neighborhood` → `place_neighborhood`
- `venue_city` → `place_city`
- `venue_image_url` → `place_image_url`
- `venue_active` → `place_active` / `is_active`

**Python (crawlers/):**
- `.table("venues")` → `.table("places")`
- `"venue_id"` in dicts → `"place_id"`
- `"venue_name_hint"` → `"place_name_hint"`

**Feed pipeline:**
- Remove the mapping utility from Task 2 (no longer needed)
- Read `place_*` columns directly

- [ ] Write migration
- [ ] Run mechanical find-replace across web/ and crawlers/
- [ ] `npx tsc --noEmit`
- [ ] `npx vitest run`
- [ ] `python -m pytest`
- [ ] **Deploy migration + code together (atomic pair)**
- [ ] Monitor all portals, feeds, search, crawlers for 24h
- [ ] Commit

### Rollback for Task 10

```sql
-- Reverse everything (keep ready, only run if needed)
ALTER TABLE places RENAME TO venues;
ALTER TABLE venues RENAME COLUMN place_type TO venue_type;
ALTER TABLE venues RENAME COLUMN is_active TO active;
ALTER TABLE events RENAME COLUMN place_id TO venue_id;
-- ... (reverse all renames)
ALTER TABLE google_places_legacy RENAME TO places;
```
Code rollback: `git revert <commit>`

---

## Task 11: Cleanup

**Goal:** Remove deprecated columns, old routes, legacy tables, backward-compat aliases.

- [ ] Drop deprecated columns from `places` table (dining columns moved to vertical_details)
- [ ] Remove 308 redirect stubs at `/api/venues/*`
- [ ] Remove `Venue = Place` type aliases
- [ ] Remove `get_or_create_venue = get_or_create_place` Python alias
- [ ] Remove mapping utility (`place-mapping.ts`)
- [ ] Drop `google_places_legacy` table
- [ ] Drop `venue_destination_details` table (data in `place_vertical_details.outdoor`)
- [ ] Add NOT NULL constraint on `place_type`
- [ ] Final grep verification: zero `venue` references remaining

```bash
# Verification
grep -r "venue_id" web/lib/ --include="*.ts" | grep -v node_modules | grep -v ".d.ts"
grep -r '\.from.*venues' web/ --include="*.ts"
grep -r "VenueCard\|VenueDetail" web/components/ --include="*.tsx"
grep -r "venue_id" crawlers/ --include="*.py" | grep -v __pycache__
```

Expected: Zero matches.

---

## Verification Checklist (Run After Each Deploy)

```bash
# TypeScript builds clean
cd web && npx tsc --noEmit

# All web tests pass
npx vitest run

# All crawler tests pass
cd ../crawlers && python -m pytest
```
