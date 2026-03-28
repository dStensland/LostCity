# Places Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename venues → places across the entire platform (database, API, types, components, crawlers) with zero downtime via phased migration.

**Architecture:** `ALTER TABLE venues RENAME TO places` + backward-compatible views → incremental code migration per module → drop views. Two extension tables (`place_profile`, `place_vertical_details`) replace the kitchen-sink columns. PostGIS added for spatial queries. `place_candidates` staging table for dedup improvement.

**Tech Stack:** PostgreSQL 15 (Supabase), PostGIS, Next.js 16, TypeScript, Python crawlers

**Spec:** `docs/superpowers/specs/2026-03-28-places-refactor-design.md`

---

## Critical Warnings

These were discovered during architecture review and MUST be followed:

1. **Migrations 1c + 1d must be ONE SQL file.** Supabase runs each migration independently — no transaction boundary between files. If `events.venue_id` is renamed to `place_id` in one file and `refresh_feed_events_ready` is updated in the next, there's a window where the feed refresh fails.

2. **`feed_events_ready` output column names stay as `venue_*` initially.** The refresh function reads from `places` / `e.place_id` internally, but still outputs `venue_id`, `venue_name`, etc. This decouples the database-internal change from the API surface. Column renames happen in Deploy 8 after all TypeScript consumers are migrated.

3. **The `venues` view must alias renamed columns.** `CREATE VIEW venues AS SELECT *, place_type AS venue_type FROM places` — NOT `SELECT *`. Without the alias, any code doing `.eq("venue_type", ...)` against the view fails silently.

4. **Deploy crawler changes on a Monday morning** after a full weekend crawl completes. Verify all cron crawls succeed over 24h before proceeding.

5. **CRITICAL: PostgREST FK joins through views.** 30+ files use `venue:venues(id, name, ...)` Supabase join syntax on the `events` table. After Deploy 1, the FK becomes `events.place_id -> places.id` and `venues` is a view, not the FK target. PostgREST resolves joins via FK metadata — it may NOT follow views. **Before Deploy 1, validate locally** that `supabase.from("events").select("*, venue:venues(id, name)")` works against the view. If it does NOT work, all join-based queries must be updated in Deploy 1 (moving them to Tasks 4-7 is not safe). Fallback: update joins to `place:places(id, name)` in the same deploy, or use explicit FK hints `venue:venues!place_id(...)`.

6. **Writable views needed for `venue_occasions` and `venue_specials` too.** Crawlers INSERT into these tables. The backward-compatible views MUST have INSTEAD OF INSERT/UPDATE/DELETE triggers, not just the main `venues` view. Without triggers, crawler writes to these views fail silently on Deploy 1.

---

## Deploy Sequence Overview

| Deploy | Name | Scope | Risk | Parallel? |
|--------|------|-------|------|-----------|
| 1 | Schema PR1 | Migrations 1a + 1b + 1c/1d-combined | CRITICAL | No |
| 2 | Schema PR2 | Migrations 1e + 1f (extension tables + data backfill) | LOW | No |
| 3 | Types Foundation | `Place` types, regenerate database types | LOW | No |
| 4 | Search Migration | Search modules + search API routes | MED | Yes (with 5, 6) |
| 5 | Component Renames | All 27 Venue*.tsx → Place*.tsx files | MED | Yes (with 4, 6) |
| 6 | Destinations Migration | Destinations + yonder + forth modules | MED | Yes (with 4, 5) |
| 7 | Feed Pipeline | City-pulse, portal-feed-loader, feed sections | HIGH | No |
| 8 | Feed Column Rename | Rename feed_events_ready venue_* → place_* | MED | No |
| 9 | API Route Migration | All /api/venues/* → /api/places/*, 308 redirects | MED | No |
| 10 | Crawler Abstraction | Core crawler DB modules + pipeline | HIGH | No |
| 11 | Crawler Bulk Rename | 1,052 source files mechanical rename | HIGH | No |
| 12 | Cleanup | Drop views, drop legacy tables, remove aliases | LOW | No |

---

## Task 1: Schema PR1 — Core Table Rename + Views

**Goal:** Rename `venues` → `places` in the database with full backward compatibility. Zero application code changes.

**Files:**
- Create: `supabase/migrations/YYYYMMDD_places_rename_1a_google.sql`
- Create: `supabase/migrations/YYYYMMDD_places_rename_1b_core.sql`
- Create: `supabase/migrations/YYYYMMDD_places_rename_1cd_fks_and_feed.sql`

### Sub-task 1a: Rename Google `places` table to clear the name

- [ ] **Step 1: Write migration 1a**

```sql
-- Migration: places_rename_1a_google
-- Purpose: Clear the `places` name for the unified table

-- Rename the Google Places table
ALTER TABLE IF EXISTS places RENAME TO google_places_legacy;

-- Update dependent objects
ALTER TABLE IF EXISTS place_user_signals RENAME TO google_place_user_signals;

-- Drop materialized view (will be recreated against unified places table)
DROP MATERIALIZED VIEW IF EXISTS hospital_nearby_places;

-- Rename the get_nearby_places function to avoid collision
ALTER FUNCTION IF EXISTS get_nearby_places(FLOAT, FLOAT, INT, TEXT) RENAME TO get_nearby_google_places_legacy;
```

- [ ] **Step 2: Test locally with `supabase db reset`**

Run: `cd /Users/coach/Projects/LostCity && supabase db reset`
Expected: Migration applies cleanly, no errors.

- [ ] **Step 3: Verify backward compatibility**

Run: `supabase db test` or connect to local DB and verify:
```sql
SELECT count(*) FROM google_places_legacy;  -- should return data
SELECT count(*) FROM google_place_user_signals;  -- should return data
```

### Sub-task 1b: Rename `venues` → `places` + backward-compatible view

- [ ] **Step 4: Write migration 1b**

```sql
-- Migration: places_rename_1b_core
-- Purpose: Rename venues -> places, add PostGIS, create backward-compatible view

-- 1. Rename core table
ALTER TABLE venues RENAME TO places;

-- 2. Rename key columns
ALTER TABLE places RENAME COLUMN venue_type TO place_type;

-- 3. Convert indoor_outdoor from ENUM to TEXT
ALTER TABLE places ALTER COLUMN indoor_outdoor TYPE TEXT USING indoor_outdoor::TEXT;
DROP TYPE IF EXISTS venue_environment;
ALTER TABLE places ADD CONSTRAINT chk_indoor_outdoor
  CHECK (indoor_outdoor IS NULL OR indoor_outdoor IN ('indoor', 'outdoor', 'both'));

-- 4. Backfill NULL place_type
UPDATE places SET place_type = 'other' WHERE place_type IS NULL;

-- 5. Add new columns
ALTER TABLE places ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE places ADD COLUMN IF NOT EXISTS google_place_id TEXT;

-- 6. Add PostGIS generated column
ALTER TABLE places ADD COLUMN IF NOT EXISTS location GEOGRAPHY(POINT, 4326)
  GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
  ) STORED;

-- 7. Coordinate validation
ALTER TABLE places ADD CONSTRAINT valid_coordinates CHECK (
  (lat IS NULL AND lng IS NULL) OR
  (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180)
);

-- 8. Spatial index (partial)
CREATE INDEX IF NOT EXISTS idx_places_location ON places USING GIST (location)
  WHERE location IS NOT NULL;

-- 9. Backward-compatible view with column aliases
-- CRITICAL: Must alias renamed columns so existing code still works
CREATE VIEW venues AS
SELECT *,
  place_type AS venue_type  -- alias for code that references venue_type
FROM places;

-- 10. INSTEAD OF triggers for writable view
CREATE OR REPLACE FUNCTION venues_view_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO places (
    id, slug, name, aliases, address, neighborhood, city, state, zip,
    lat, lng, place_type, indoor_outdoor, location_designator,
    website, image_url, active, created_at, updated_at
  ) VALUES (
    NEW.id, NEW.slug, NEW.name, NEW.aliases, NEW.address, NEW.neighborhood,
    NEW.city, NEW.state, NEW.zip, NEW.lat, NEW.lng,
    COALESCE(NEW.place_type, NEW.venue_type),  -- accept either column name
    NEW.indoor_outdoor, NEW.location_designator, NEW.website,
    NEW.image_url, NEW.active, COALESCE(NEW.created_at, NOW()),
    COALESCE(NEW.updated_at, NOW())
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION venues_view_update() RETURNS TRIGGER AS $$
BEGIN
  UPDATE places SET
    name = NEW.name, slug = NEW.slug, aliases = NEW.aliases,
    address = NEW.address, neighborhood = NEW.neighborhood,
    city = NEW.city, state = NEW.state, zip = NEW.zip,
    lat = NEW.lat, lng = NEW.lng,
    place_type = COALESCE(NEW.place_type, NEW.venue_type),
    indoor_outdoor = NEW.indoor_outdoor, website = NEW.website,
    image_url = NEW.image_url, active = NEW.active,
    updated_at = COALESCE(NEW.updated_at, NOW())
  WHERE id = OLD.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION venues_view_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM places WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER venues_insert INSTEAD OF INSERT ON venues
  FOR EACH ROW EXECUTE FUNCTION venues_view_insert();
CREATE TRIGGER venues_update INSTEAD OF UPDATE ON venues
  FOR EACH ROW EXECUTE FUNCTION venues_view_update();
CREATE TRIGGER venues_delete INSTEAD OF DELETE ON venues
  FOR EACH ROW EXECUTE FUNCTION venues_view_delete();

-- 11. Enable RLS
ALTER TABLE places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "places_read" ON places FOR SELECT USING (true);
CREATE POLICY "places_write" ON places FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

- [ ] **Step 5: Test migration locally**

Run: `supabase db reset`
Expected: Clean apply. Then verify:
```sql
-- Both should work
SELECT id, name, place_type FROM places LIMIT 5;
SELECT id, name, venue_type FROM venues LIMIT 5;
-- Writes through view should work
UPDATE venues SET name = name WHERE id = 1;
```

### Sub-task 1c/1d: FK renames + feed function update (SINGLE FILE)

- [ ] **Step 6: Write combined migration 1c/1d**

This is the critical migration. All FK renames + feed function update in ONE file.

```sql
-- Migration: places_rename_1cd_fks_and_feed
-- CRITICAL: This must be a single file. See plan warnings.

-- === 1c: Rename related tables + FK columns ===

-- Related tables with backward-compatible views
ALTER TABLE venue_destination_details RENAME TO place_outdoor_details_legacy;
CREATE VIEW venue_destination_details AS SELECT * FROM place_outdoor_details_legacy;

ALTER TABLE venue_occasions RENAME TO place_occasions;
ALTER TABLE place_occasions RENAME COLUMN venue_id TO place_id;
-- Writable backward-compatible view (crawlers INSERT into this)
CREATE VIEW venue_occasions AS SELECT place_id AS venue_id, * FROM place_occasions;
CREATE OR REPLACE FUNCTION venue_occasions_view_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO place_occasions (place_id, occasion, confidence, source, created_at)
  VALUES (COALESCE(NEW.place_id, NEW.venue_id), NEW.occasion, NEW.confidence, NEW.source, COALESCE(NEW.created_at, NOW()));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER venue_occasions_insert INSTEAD OF INSERT ON venue_occasions
  FOR EACH ROW EXECUTE FUNCTION venue_occasions_view_insert();
CREATE OR REPLACE FUNCTION venue_occasions_view_delete() RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM place_occasions WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER venue_occasions_delete INSTEAD OF DELETE ON venue_occasions
  FOR EACH ROW EXECUTE FUNCTION venue_occasions_view_delete();

ALTER TABLE venue_specials RENAME TO place_specials;
ALTER TABLE place_specials RENAME COLUMN venue_id TO place_id;
-- Writable backward-compatible view (crawlers INSERT into this)
CREATE VIEW venue_specials AS SELECT place_id AS venue_id, * FROM place_specials;
CREATE OR REPLACE FUNCTION venue_specials_view_insert() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO place_specials (place_id, title, type, description, days_of_week, time_start, time_end, start_date, end_date, image_url, price_note, confidence, source_url, is_active, created_at, updated_at)
  VALUES (COALESCE(NEW.place_id, NEW.venue_id), NEW.title, NEW.type, NEW.description, NEW.days_of_week, NEW.time_start, NEW.time_end, NEW.start_date, NEW.end_date, NEW.image_url, NEW.price_note, NEW.confidence, NEW.source_url, COALESCE(NEW.is_active, true), COALESCE(NEW.created_at, NOW()), COALESCE(NEW.updated_at, NOW()));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER venue_specials_insert INSTEAD OF INSERT ON venue_specials
  FOR EACH ROW EXECUTE FUNCTION venue_specials_view_insert();

-- Core FK renames
ALTER TABLE events RENAME COLUMN venue_id TO place_id;
ALTER TABLE editorial_mentions RENAME COLUMN venue_id TO place_id;
ALTER TABLE programs RENAME COLUMN venue_id TO place_id;
ALTER TABLE exhibitions RENAME COLUMN venue_id TO place_id;
ALTER TABLE open_calls RENAME COLUMN venue_id TO place_id;
ALTER TABLE places RENAME COLUMN parent_venue_id TO parent_place_id;

-- Venue management tables
ALTER TABLE venue_claims RENAME TO place_claims;
ALTER TABLE place_claims RENAME COLUMN venue_id TO place_id;
ALTER TABLE venue_inventory_snapshots RENAME TO place_inventory_snapshots;
ALTER TABLE place_inventory_snapshots RENAME COLUMN venue_id TO place_id;

-- Tags
ALTER TABLE venue_tags RENAME TO place_tags;
ALTER TABLE place_tags RENAME COLUMN venue_id TO place_id;
ALTER TABLE venue_tag_summary RENAME TO place_tag_summary;
ALTER TABLE place_tag_summary RENAME COLUMN venue_id TO place_id;

-- Features / highlights
ALTER TABLE venue_features RENAME COLUMN venue_id TO place_id;
ALTER TABLE venue_highlights RENAME COLUMN venue_id TO place_id;

-- Walkable neighbors
ALTER TABLE walkable_neighbors RENAME COLUMN venue_id TO place_id;
ALTER TABLE walkable_neighbors RENAME COLUMN neighbor_id TO neighbor_place_id;

-- === 1d: Update feed_events_ready refresh function ===
-- IMPORTANT: Still outputs venue_* column names for backward compat.
-- The function READS from `places` and `e.place_id` internally,
-- but the OUTPUT columns stay as venue_id, venue_name, etc.

CREATE OR REPLACE FUNCTION refresh_feed_events_ready()
RETURNS void AS $$
BEGIN
  -- Truncate and repopulate
  TRUNCATE feed_events_ready;

  INSERT INTO feed_events_ready (
    event_id, portal_id, title, start_date, start_time, end_date, end_time,
    is_all_day, is_free, price_min, price_max, category, genres,
    image_url, featured_blurb, tags, festival_id, is_tentpole, is_featured,
    series_id, is_recurring, source_id, organization_id, importance, data_quality,
    venue_id, venue_name, venue_slug, venue_neighborhood, venue_city,
    venue_type, venue_image_url, venue_active,
    series_name, series_type, series_slug, refreshed_at
  )
  SELECT
    e.id, psa.portal_id, e.title, e.start_date, e.start_time, e.end_date, e.end_time,
    e.is_all_day, e.is_free, e.price_min, e.price_max, e.category, e.genres,
    e.image_url, e.featured_blurb, e.tags, e.festival_id, e.is_tentpole, e.is_featured,
    e.series_id, (e.series_id IS NOT NULL), e.source_id, e.organization_id,
    e.importance, e.data_quality,
    -- Read from places table + place_id, but OUTPUT as venue_* column names
    e.place_id,           -- maps to venue_id output column
    p.name,               -- maps to venue_name
    p.slug,               -- maps to venue_slug
    p.neighborhood,       -- maps to venue_neighborhood
    p.city,               -- maps to venue_city
    p.place_type,         -- maps to venue_type
    p.image_url,          -- maps to venue_image_url
    p.active,             -- maps to venue_active
    s.name, s.type, s.slug, NOW()
  FROM events e
  JOIN portal_source_access psa ON psa.source_id = e.source_id
  LEFT JOIN places p ON p.id = e.place_id
  LEFT JOIN event_series s ON s.id = e.series_id
  WHERE e.start_date >= CURRENT_DATE - interval '1 day'
    AND e.canonical_event_id IS NULL
    AND (p.active IS NULL OR p.active = true);

  -- ... (rest of the function body — update all venue references to places)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update search RPC
CREATE OR REPLACE FUNCTION search_places_ranked(
    p_query TEXT,
    p_city TEXT DEFAULT NULL,  -- optional during migration, required in Phase 4
    p_limit INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0,
    p_neighborhoods TEXT[] DEFAULT NULL,
    p_spot_types TEXT[] DEFAULT NULL,
    p_vibes TEXT[] DEFAULT NULL
)
RETURNS TABLE(
    id INTEGER, name TEXT, slug TEXT, address TEXT, neighborhood TEXT,
    spot_type TEXT, spot_types TEXT[], vibes TEXT[], description TEXT,
    short_description TEXT, lat DECIMAL, lng DECIMAL, image_url TEXT,
    website TEXT, ts_rank REAL, similarity_score REAL, combined_score REAL,
    featured BOOLEAN, explore_featured BOOLEAN, data_quality INTEGER,
    is_event_venue BOOLEAN
) AS $$
BEGIN
  -- Same body as search_venues_ranked but queries `places` table
  -- and uses `place_type` column instead of `venue_type`
  -- Full implementation needed at migration time
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Keep old function as wrapper
CREATE OR REPLACE FUNCTION search_venues_ranked(
    p_query TEXT, p_limit INTEGER DEFAULT 10, p_offset INTEGER DEFAULT 0,
    p_neighborhoods TEXT[] DEFAULT NULL, p_spot_types TEXT[] DEFAULT NULL,
    p_vibes TEXT[] DEFAULT NULL, p_city TEXT DEFAULT NULL
)
RETURNS TABLE(
    id INTEGER, name TEXT, slug TEXT, address TEXT, neighborhood TEXT,
    spot_type TEXT, spot_types TEXT[], vibes TEXT[], description TEXT,
    short_description TEXT, lat DECIMAL, lng DECIMAL, image_url TEXT,
    website TEXT, ts_rank REAL, similarity_score REAL, combined_score REAL,
    featured BOOLEAN, explore_featured BOOLEAN, data_quality INTEGER,
    is_event_venue BOOLEAN
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM search_places_ranked(
    p_query, p_city, p_limit, p_offset, p_neighborhoods, p_spot_types, p_vibes
  );
END;
$$ LANGUAGE plpgsql;
```

- [ ] **Step 7: Test migration locally**

Run: `supabase db reset`
Expected: All migrations apply. Verify:
```sql
-- Events should have place_id
SELECT place_id FROM events LIMIT 1;
-- Feed refresh should work
SELECT refresh_feed_events_ready();
-- Feed should have data
SELECT venue_id, venue_name FROM feed_events_ready LIMIT 5;
-- Search should work through both functions
SELECT * FROM search_venues_ranked('high museum', 5);
SELECT * FROM search_places_ranked('high museum', 'Atlanta', 5);
```

- [ ] **Step 8: Run full test suite**

Run: `cd /Users/coach/Projects/LostCity/web && npx vitest run`
Expected: All tests pass (backward-compatible views mean zero code breakage).

Run: `cd /Users/coach/Projects/LostCity/crawlers && python -m pytest`
Expected: All tests pass.

- [ ] **Step 9: Commit Schema PR1**

```bash
git add supabase/migrations/YYYYMMDD_places_rename_*.sql
git commit -m "feat(schema): rename venues → places with backward-compatible views

- Rename Google places → google_places_legacy (clear name)
- ALTER TABLE venues RENAME TO places
- Add PostGIS geography column (generated from lat/lng)
- Writable venues view with INSTEAD OF triggers
- Rename all FK columns (events.place_id, etc.)
- Update refresh_feed_events_ready to read from places
- Add search_places_ranked RPC (search_venues_ranked kept as wrapper)
- Enable RLS on places table"
```

- [ ] **Step 10: CRITICAL — Validate PostgREST FK joins through views**

Before deploying, test locally that Supabase PostgREST resolves FK joins through the `venues` view:

```bash
# Start local Supabase
supabase start

# Test join syntax against the view
curl 'http://localhost:54321/rest/v1/events?select=id,title,venue:venues(id,name)&limit=1' \
  -H "apikey: $SUPABASE_ANON_KEY"
```

**If this returns an error** ("could not find a relationship between 'events' and 'venues'"):
- The backward-compatible view approach is NOT sufficient for FK joins
- STOP deployment — all join-based queries (~30 files) must be updated to `place:places(id,name)` before Deploy 1
- This converts Deploy 1 from "zero code changes" to "schema + code migration" and increases risk significantly
- Consult with team before proceeding

**If this returns valid data**, the join resolves through the view and Deploy 1 is safe.

Also test crawler write-through-view:
```bash
# Test write to venues view
curl -X POST 'http://localhost:54321/rest/v1/venues' \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Place","slug":"test-place-validation","city":"Atlanta","state":"GA"}'

# Test write to venue_occasions view
curl -X POST 'http://localhost:54321/rest/v1/venue_occasions' \
  -H "apikey: $SUPABASE_SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"venue_id":1,"occasion":"date_night","confidence":1.0,"source":"manual"}'

# Cleanup test data
curl -X DELETE 'http://localhost:54321/rest/v1/venues?slug=eq.test-place-validation' \
  -H "apikey: $SUPABASE_SERVICE_KEY"
```

- [ ] **Step 11: Deploy and verify for 24h**

Deploy to Supabase. Monitor:
- Feed loads correctly on all portals
- Search works
- Crawlers complete without errors
- No 500 errors in Vercel logs
- PostgREST joins resolve correctly (check event detail pages)

**DO NOT proceed to Task 2 until Task 1 has been stable in production for 24 hours.**

### Rollback Strategy for Task 1

If issues are found after deploy:

```sql
-- Revert: Full rollback migration (keep ready but only run if needed)
-- 1. Drop views and triggers
DROP VIEW IF EXISTS venues CASCADE;
DROP VIEW IF EXISTS venue_occasions CASCADE;
DROP VIEW IF EXISTS venue_specials CASCADE;
DROP VIEW IF EXISTS venue_destination_details CASCADE;

-- 2. Reverse FK column renames
ALTER TABLE events RENAME COLUMN place_id TO venue_id;
ALTER TABLE editorial_mentions RENAME COLUMN place_id TO venue_id;
ALTER TABLE programs RENAME COLUMN place_id TO venue_id;
ALTER TABLE exhibitions RENAME COLUMN place_id TO venue_id;
ALTER TABLE open_calls RENAME COLUMN place_id TO venue_id;
-- (repeat for all renamed columns)

-- 3. Reverse table renames
ALTER TABLE place_occasions RENAME TO venue_occasions;
ALTER TABLE place_specials RENAME TO venue_specials;
ALTER TABLE places RENAME TO venues;
ALTER TABLE google_places_legacy RENAME TO places;

-- 4. Restore original column names
ALTER TABLE venues RENAME COLUMN place_type TO venue_type;
-- ... etc

-- 5. Restore feed function to original version
-- (restore from git history)
```

For code deploys (Tasks 3-9): `git revert <commit>` is sufficient — backward-compatible views mean old code works.
For crawler deploys (Tasks 10-11): `git revert` + verify cron crawls resume successfully.

---

## Task 2: Schema PR2 — Extension Tables + Data Migration

**Goal:** Create `place_profile`, `place_vertical_details`, `place_candidates` tables and backfill data.

**Files:**
- Create: `supabase/migrations/YYYYMMDD_places_extension_tables.sql`
- Create: `supabase/migrations/YYYYMMDD_places_data_backfill.sql`

- [ ] **Step 1: Write extension tables migration**

Create `place_profile`, `place_vertical_details`, `place_candidates` as specified in the design spec (Section "Extension Table: `place_profile`" and "Extension Table: `place_vertical_details`" and "New Table: `place_candidates`").

Include RLS policies for all three tables.

- [ ] **Step 2: Write data backfill migration**

Backfill `place_vertical_details.outdoor` from `place_outdoor_details_legacy` (formerly `venue_destination_details`).
Backfill `place_vertical_details.dining` from dining columns on `places` base table.
Backfill `place_profile` from profile-level columns (description, hero_image_url, featured, planning_notes, etc.).

- [ ] **Step 3: Write `merge_places` function**

```sql
-- As specified in design spec — re-parents all FKs and soft-deletes duplicate
CREATE OR REPLACE FUNCTION merge_places(p_keep_id INTEGER, p_remove_id INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE events SET place_id = p_keep_id WHERE place_id = p_remove_id;
  UPDATE place_occasions SET place_id = p_keep_id WHERE place_id = p_remove_id
    ON CONFLICT (place_id, occasion) DO NOTHING;
  UPDATE place_specials SET place_id = p_keep_id WHERE place_id = p_remove_id;
  UPDATE editorial_mentions SET place_id = p_keep_id WHERE place_id = p_remove_id
    ON CONFLICT (article_url, place_id) DO NOTHING;
  UPDATE programs SET place_id = p_keep_id WHERE place_id = p_remove_id;
  UPDATE exhibitions SET place_id = p_keep_id WHERE place_id = p_remove_id;
  UPDATE open_calls SET place_id = p_keep_id WHERE place_id = p_remove_id;
  UPDATE walkable_neighbors SET place_id = p_keep_id WHERE place_id = p_remove_id;
  UPDATE walkable_neighbors SET neighbor_place_id = p_keep_id WHERE neighbor_place_id = p_remove_id;
  -- Merge aliases
  UPDATE places SET aliases = (
    SELECT array_agg(DISTINCT a) FROM (
      SELECT unnest(aliases) AS a FROM places WHERE id IN (p_keep_id, p_remove_id)
    ) sub
  ) WHERE id = p_keep_id;
  -- Soft-delete duplicate
  UPDATE places SET active = false WHERE id = p_remove_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

- [ ] **Step 4: Update `search_vector` tsvector trigger**

The trigger/function that maintains `search_vector` must reference `places` instead of `venues`.

- [ ] **Step 5: Create `get_nearby_places` function against unified table**

Replace the legacy Google-only function with one that queries the unified `places` table with the PostGIS `location` column. Include mandatory radius cap (50km) and city filtering.

- [ ] **Step 6: Recreate `hospital_nearby_places` materialized view**

Against the unified `places` table instead of `google_places_legacy`.

- [ ] **Step 7: Test locally**

Run: `supabase db reset`
Verify: Extension tables populated, data matches source, `merge_places` works, search_vector triggers fire.

- [ ] **Step 8: Commit and deploy**

---

## Task 3: Types Foundation

**Goal:** Create TypeScript `Place` types that all subsequent code migration depends on.

**Files:**
- Create: `web/lib/types/places.ts`
- Modify: `web/lib/types.ts` (add re-export)
- Run: `supabase gen types typescript` to regenerate database types

- [ ] **Step 1: Regenerate database types**

Run: `cd /Users/coach/Projects/LostCity && supabase gen types typescript --local > web/lib/supabase/database.types.ts`

This will produce types with `places` instead of `venues`, `place_id` instead of `venue_id`, etc.

- [ ] **Step 2: Create `web/lib/types/places.ts`**

Write the full `Place`, `PlaceCard`, `PlaceProfile`, `PlaceDiningDetails`, `PlaceOutdoorDetails`, `PlaceDetail` interfaces as specified in the design spec TypeScript Types section.

- [ ] **Step 3: Add backward-compatible type aliases**

In `web/lib/types.ts`, add:
```typescript
// Backward compatibility — remove in Phase 4
export type Venue = Place;
export type VenueCard = PlaceCard;
```

- [ ] **Step 4: Build check**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit`
Expected: PASS. The type aliases mean no existing code breaks.

- [ ] **Step 5: Commit**

---

## Tasks 4-6: Parallel Code Migration (can be done by separate agents)

### Task 4: Search Migration

**Goal:** Migrate search modules to use `places` table and `Place` types.

**Files:**
- Modify: `web/lib/search.ts` — update `.from("venues")` → `.from("places")`, `venue_id` → `place_id`
- Modify: `web/lib/unified-search.ts` — update `search_venues_ranked` → `search_places_ranked`
- Modify: `web/lib/search-ranking.ts` — update venue references
- Modify: `web/lib/search-suggestions.ts` — update venue references
- Modify: `web/lib/search-preview.ts` — update `.from("venues")`
- Modify: `web/lib/instant-search-service.ts` — update venue result types
- Modify: `web/lib/search-suggestion-results.ts` — update venue types
- Modify: `web/lib/spots.ts` — update `.from("venues")` → `.from("places")`
- Modify: `web/lib/spot-detail.ts` — update venue queries
- Rename: `web/lib/venue-tags.ts` → `web/lib/place-tags.ts`
- Rename: `web/lib/venue-tags-config.ts` → `web/lib/place-tags-config.ts`
- Rename: `web/lib/venue-features.ts` → `web/lib/place-features.ts`
- Rename: `web/lib/venue-features.test.ts` → `web/lib/place-features.test.ts`
- Rename: `web/lib/venue-highlights.ts` → `web/lib/place-highlights.ts`
- Rename: `web/lib/venue-auto-approve.ts` → `web/lib/place-auto-approve.ts`
- Rename: `web/lib/hooks/useVenueDiscovery.ts` → `web/lib/hooks/usePlaceDiscovery.ts`
- Rename: `web/lib/types/venue-destinations.ts` → `web/lib/types/place-destinations.ts`
- Move: `web/app/api/venues/search/route.ts` → `web/app/api/places/search/route.ts`
- Create: `web/app/api/venues/search/route.ts` (308 redirect to /api/places/search)

**Pattern for each file:**
- [ ] Read the file
- [ ] Replace `.from("venues")` → `.from("places")`
- [ ] Replace `venue_id` → `place_id` in select strings and filter params
- [ ] Replace `venue_type` → `place_type` in select strings
- [ ] Replace `VenueX` types → `PlaceX` types in imports
- [ ] Update function names (e.g., `searchVenues` → `searchPlaces`)
- [ ] Run `npx tsc --noEmit` after each file
- [ ] Run `npx vitest run` after each file
- [ ] Commit after each logical group

**Mandatory city filtering:** While migrating `/api/places/search`, add the required `city` parameter. Derive it from portal context server-side when not provided by client.

### Task 5: Component Renames

**Goal:** Rename all 27 Venue*.tsx files to Place*.tsx and update all imports.

**Files:** See the complete component rename table in the design spec.

**Pattern for each component:**
- [ ] Rename file (e.g., `VenueCard.tsx` → `PlaceCard.tsx`)
- [ ] Update component name inside the file
- [ ] Update all props interfaces (`VenueCardProps` → `PlaceCardProps`)
- [ ] Update all imports of this component across the codebase

Use `git mv` for renames to preserve history.

**Order:** Start with leaf components (no internal venue-component imports), then work up:
1. `VenueTagBadges`, `VenueVibes`, `VenueIcon` (leaf)
2. `VenueTagList`, `VenueShowtimes`, `VenueEventsByDay` (leaf)
3. `VenueCard`, `VenueAutocomplete` (widely imported)
4. `VenueDetailView`, `VenueFilterBar`, `VenueListView` (complex, many imports)
5. `SubmitVenueModal`, `QuickAddVenue` (forms)
6. Portal-specific: `VenueDetailModal`, `HotelVenueCard`

After each rename batch:
- [ ] Run `npx tsc --noEmit`
- [ ] Run `npx vitest run`
- [ ] Commit

### Task 6: Destinations Migration

**Goal:** Migrate destination/explore modules to use `places` and new extension tables.

**Files:**
- Modify: `web/lib/city-pulse/pipeline/fetch-destinations.ts` — `venue_occasions` → `place_occasions`, `venue_id` → `place_id`
- Modify: `web/lib/forth-data.ts` — venue references
- Modify: `web/lib/yonder-destination-nodes.ts` — venue references
- Modify: `web/lib/yonder-provider-inventory.ts` — venue references
- Modify: `web/lib/types/venue-destinations.ts` → rename to `place-destinations.ts`
- Modify: `web/app/api/portals/[slug]/destinations/route.ts`
- Modify: `web/app/api/portals/[slug]/yonder/destinations/route.ts`

Same pattern as Task 4: read, replace, type-check, test, commit.

---

## Task 7: Feed Pipeline Migration

**Goal:** Migrate the CityPulse feed pipeline to use `place_id` and `Place` types.

**Depends on:** Tasks 3-6 complete.

**Files:**
- Modify: `web/lib/city-pulse/pipeline/fetch-feed-ready.ts` — `FeedReadyRow` type still uses `venue_*` column names (the DB columns haven't been renamed yet). Update TypeScript types to add `place_*` aliases while keeping `venue_*` for now.
- Modify: `web/lib/city-pulse/pipeline/fetch-events.ts` — venue references
- Modify: `web/lib/portal-feed-loader.ts` — 10+ venue_id references, venue_ids filter
- Modify: All section builders in `web/lib/city-pulse/sections/` that reference venue columns

**Files (complete list — grep for `venue` in `web/lib/city-pulse/`):**
- Modify: `web/lib/city-pulse/pipeline/fetch-feed-ready.ts`
- Modify: `web/lib/city-pulse/pipeline/fetch-events.ts`
- Modify: `web/lib/city-pulse/pipeline/fetch-counts.ts`
- Modify: `web/lib/city-pulse/pipeline/build-sections.ts`
- Modify: `web/lib/city-pulse/scoring.ts`
- Modify: `web/lib/city-pulse/dashboard-cards.ts`
- Modify: `web/lib/city-pulse/quick-links.ts`
- Modify: `web/lib/city-pulse/curated-sections.ts`
- Modify: `web/lib/city-pulse/weather-mapping.ts`
- Modify: `web/lib/city-pulse/specials.ts`
- Modify: `web/lib/portal-feed-loader.ts` — 10+ venue_id references
- Modify: All section builders in `web/lib/city-pulse/sections/` that reference venue columns

**Critical:** The `feed_events_ready` DB columns are still `venue_*` at this point. The TypeScript code must read `venue_*` columns from the DB but expose them as `place_*` in the type system. Use a mapping layer:

```typescript
// In fetch-feed-ready.ts
type FeedReadyRow = {
  // DB still says venue_*, we alias to place_*
  place_id: number;       // reads from venue_id column
  place_name: string;     // reads from venue_name column
  // ... etc
};

function mapFeedRow(row: any): FeedReadyRow {
  return {
    ...row,
    place_id: row.venue_id,
    place_name: row.venue_name,
    // ... etc
  };
}
```

- [ ] Migrate each file
- [ ] Run `npx tsc --noEmit` after each
- [ ] Run full test suite
- [ ] Commit

---

## Task 8: Feed Column Rename

**Goal:** Now that all TypeScript consumers use `place_*`, rename the `feed_events_ready` output columns.

**Depends on:** Task 7 complete and deployed.

**Files:**
- Create: `supabase/migrations/YYYYMMDD_feed_events_ready_place_columns.sql`
- Modify: `web/lib/city-pulse/pipeline/fetch-feed-ready.ts` — remove the mapping layer, read `place_*` directly

- [ ] **Step 1: Write migration**

```sql
ALTER TABLE feed_events_ready RENAME COLUMN venue_id TO place_id;
ALTER TABLE feed_events_ready RENAME COLUMN venue_name TO place_name;
ALTER TABLE feed_events_ready RENAME COLUMN venue_slug TO place_slug;
ALTER TABLE feed_events_ready RENAME COLUMN venue_neighborhood TO place_neighborhood;
ALTER TABLE feed_events_ready RENAME COLUMN venue_city TO place_city;
ALTER TABLE feed_events_ready RENAME COLUMN venue_type TO place_type;
ALTER TABLE feed_events_ready RENAME COLUMN venue_image_url TO place_image_url;
ALTER TABLE feed_events_ready RENAME COLUMN venue_active TO place_active;

-- Update refresh function to output place_* column names
CREATE OR REPLACE FUNCTION refresh_feed_events_ready() ...
  -- Same as Task 1 version but now outputs place_id, place_name, etc.
```

- [ ] **Step 2: Update TypeScript to remove mapping layer**

Remove the `mapFeedRow` adapter from Task 7. Read `place_*` columns directly.

- [ ] **Step 3: Deploy migration + code change together**

This is an atomic pair: the migration and the TypeScript update must deploy together.

- [ ] **Step 4: Verify feed loads on all portals**

---

## Task 9: API Route Migration

**Goal:** Move all venue API routes to /api/places/*, create 308 redirects.

**Files:**
- Move: `web/app/api/venues/*` → `web/app/api/places/*` (directory rename)
- Move: `web/app/api/spots/*` → integrate into `web/app/api/places/*`
- Create: Redirect stubs at old paths

For each route:
- [ ] Move the route file to new path
- [ ] Update internal queries (`.from("venues")` → `.from("places")`)
- [ ] Update response types
- [ ] Create 308 redirect at old path:

```typescript
// web/app/api/venues/search/route.ts (redirect stub)
import { NextResponse } from 'next/server';
export async function GET(request: Request) {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace('/api/venues/', '/api/places/');
  return NextResponse.redirect(url, 308);
}
```

- [ ] Run full test suite
- [ ] Commit

---

## Task 10: Crawler Abstraction Layer

**Goal:** Rename core crawler DB modules. Keep backward-compatible aliases.

**Files:**
- Rename: `crawlers/db/venues.py` → `crawlers/db/places.py`
- Rename: `crawlers/db/venue_validation.py` → `crawlers/db/place_validation.py`
- Rename: `crawlers/db/venue_occasions.py` → `crawlers/db/place_occasions.py`
- Rename: `crawlers/db/venue_specials.py` → `crawlers/db/place_specials.py`
- Rename: `crawlers/db/destination_details.py` → `crawlers/db/place_vertical.py`
- Modify: `crawlers/db/__init__.py` — update imports, add backward-compatible aliases
- Modify: `crawlers/db/events.py` — update imports
- Modify: `crawlers/pipeline_main.py` — update imports

**Critical:** In `crawlers/db/__init__.py`, re-export old names as aliases:
```python
from .places import get_or_create_place
# Backward compat — remove in Phase 4
get_or_create_venue = get_or_create_place
```

In `crawlers/db/places.py`, update `get_or_create_place()` to:
- Query `.from("places")` instead of `.from("venues")`
- Accept both `venue_id` and `place_id` in event data dicts
- Write to `place_id` column on events

- [ ] Rename files with `git mv`
- [ ] Update imports in `__init__.py`, `events.py`, `pipeline_main.py`
- [ ] Run: `cd /Users/coach/Projects/LostCity/crawlers && python -m pytest`
- [ ] Deploy on a Monday morning
- [ ] Monitor 24h of cron crawls
- [ ] Commit

---

## Task 11: Crawler Source Bulk Rename

**Goal:** Mechanically rename venue references in 1,052 source crawler files.

**Depends on:** Task 10 stable in production for 24h.

This is a mechanical find-and-replace across all source files:
- `"venue_id"` → `"place_id"` in event dictionaries
- `"venue_name_hint"` → `"place_name_hint"`
- `get_or_create_venue` → `get_or_create_place`
- `VENUE_DATA` → `PLACE_DATA` (in constant names)

- [ ] **Step 1: Write a migration script**

```python
# scripts/rename_venue_to_place_in_crawlers.py
import os, re

SOURCE_DIR = "crawlers/sources"
REPLACEMENTS = [
    (r'"venue_id"', '"place_id"'),
    (r'"venue_name_hint"', '"place_name_hint"'),
    (r'get_or_create_venue', 'get_or_create_place'),
    (r'VENUE_DATA', 'PLACE_DATA'),
    (r'venue_data', 'place_data'),
]
# ... apply to all .py files in SOURCE_DIR
```

- [ ] **Step 2: Run script, review diff**
- [ ] **Step 3: Run full crawler test suite**
- [ ] **Step 4: Deploy on Monday, monitor 24h**
- [ ] **Step 5: Commit**

---

## Task 12: Cleanup (Phase 4)

**Goal:** Remove all backward-compatibility layers.

**Depends on:** All previous tasks complete and stable.

- [ ] **Step 1: Drop backward-compatible views**

```sql
DROP VIEW IF EXISTS venues CASCADE;
DROP VIEW IF EXISTS venue_occasions CASCADE;
DROP VIEW IF EXISTS venue_specials CASCADE;
DROP VIEW IF EXISTS venue_destination_details CASCADE;

-- Drop trigger functions
DROP FUNCTION IF EXISTS venues_view_insert();
DROP FUNCTION IF EXISTS venues_view_update();
DROP FUNCTION IF EXISTS venues_view_delete();

-- Drop old search wrapper
DROP FUNCTION IF EXISTS search_venues_ranked();
```

- [ ] **Step 2: Drop legacy tables**

```sql
DROP TABLE IF EXISTS place_outdoor_details_legacy;
DROP TABLE IF EXISTS google_places_legacy CASCADE;
DROP TABLE IF EXISTS google_place_user_signals;
```

- [ ] **Step 3: Remove TypeScript aliases**

Remove `Venue = Place` aliases from `web/lib/types.ts`.

- [ ] **Step 4: Remove crawler aliases**

Remove `get_or_create_venue = get_or_create_place` from `crawlers/db/__init__.py`.

- [ ] **Step 5: Remove API redirect stubs**

Delete all 308 redirect routes at `/api/venues/*` and `/api/spots/*`.

- [ ] **Step 6: Drop deprecated columns from places table**

```sql
-- Columns that were moved to extension tables and are no longer read
ALTER TABLE places DROP COLUMN IF EXISTS menu_url;
ALTER TABLE places DROP COLUMN IF EXISTS reservation_url;
ALTER TABLE places DROP COLUMN IF EXISTS service_style;
ALTER TABLE places DROP COLUMN IF EXISTS meal_duration_min_minutes;
ALTER TABLE places DROP COLUMN IF EXISTS meal_duration_max_minutes;
-- ... etc (full list from spec column disposition table)
```

- [ ] **Step 7: Add NOT NULL constraint on place_type**

```sql
ALTER TABLE places ALTER COLUMN place_type SET NOT NULL;
```

- [ ] **Step 8: Rename `active` → `is_active`**

Only now, after all consumers are migrated:
```sql
ALTER TABLE places RENAME COLUMN active TO is_active;
-- Update all RPC functions that reference `active`
```

- [ ] **Step 9: Final build + test verification**

Run: `npx tsc --noEmit && npx vitest run`
Run: `python -m pytest`
Expected: All pass with zero `venue` references remaining.

- [ ] **Step 10: Commit and celebrate**

---

## Verification Checklist (Run After Each Deploy)

```bash
# TypeScript builds clean
cd web && npx tsc --noEmit

# All web tests pass
npx vitest run

# All crawler tests pass
cd ../crawlers && python -m pytest

# No venue references remaining (run after Phase 4)
grep -r "venue_id" web/lib/ --include="*.ts" | grep -v node_modules | grep -v ".d.ts"
grep -r "from.*venues" web/app/api/ --include="*.ts"
grep -r "VenueCard\|VenueDetail\|VenueAutocomplete" web/components/ --include="*.tsx"
```
