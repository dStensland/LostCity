-- =============================================================================
-- Places Refactor Foundation — Task 1 of N
-- Purely additive: no renames, no drops, no breaking changes.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. PostGIS
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------------------------
-- 1. PostGIS geography column on venues
--    Migration 008 already adds this column + trigger + index in production.
--    We re-declare everything with IF NOT EXISTS / CREATE OR REPLACE so
--    this migration is safe to run on any DB that may or may not have run 008.
-- ---------------------------------------------------------------------------

-- Generated geography column (kept in sync by trigger below)
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS location geography(POINT, 4326);

-- Coordinate validation: only constrain when both values are present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'venues'::regclass
      AND conname = 'venues_lat_range_check'
  ) THEN
    ALTER TABLE venues
      ADD CONSTRAINT venues_lat_range_check
        CHECK (lat IS NULL OR (lat BETWEEN -90 AND 90));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'venues'::regclass
      AND conname = 'venues_lng_range_check'
  ) THEN
    ALTER TABLE venues
      ADD CONSTRAINT venues_lng_range_check
        CHECK (lng IS NULL OR (lng BETWEEN -180 AND 180));
  END IF;
END $$;

-- Trigger function: populate location from lat/lng on every write
CREATE OR REPLACE FUNCTION update_venue_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  ELSE
    NEW.location := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS venue_location_trigger ON venues;
CREATE TRIGGER venue_location_trigger
  BEFORE INSERT OR UPDATE OF lat, lng ON venues
  FOR EACH ROW EXECUTE FUNCTION update_venue_location();

-- Spatial index
CREATE INDEX IF NOT EXISTS idx_venues_location
  ON venues USING GIST(location);

-- Backfill any existing rows that have lat/lng but no location
UPDATE venues
SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
WHERE lat IS NOT NULL
  AND lng IS NOT NULL
  AND location IS NULL;

-- ---------------------------------------------------------------------------
-- 2. place_profile — 1:1 enrichment extension on venues
--    Slow-changing, human-curated or AI-enriched content.
--    PK is also FK → venues.id, so there is exactly one profile per venue.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS place_profile (
  venue_id         INTEGER PRIMARY KEY REFERENCES venues(id) ON DELETE CASCADE,

  -- Editorial content
  description      TEXT,
  short_description TEXT,
  hero_image_url   TEXT,
  gallery_urls     TEXT[],

  -- Discovery signals
  featured         BOOLEAN NOT NULL DEFAULT false,
  explore_category TEXT,
  explore_blurb    TEXT,

  -- Access & logistics
  parking_type     TEXT CHECK (parking_type IN ('free_lot','paid_lot','street','garage','none')),
  transit_notes    TEXT,
  capacity         INTEGER CHECK (capacity > 0),
  wheelchair       BOOLEAN,   -- NULL = unknown

  -- Family suitability
  family_suitability TEXT CHECK (family_suitability IN ('yes','no','caution')),
  age_min          INTEGER CHECK (age_min >= 0),
  age_max          INTEGER CHECK (age_max >= 0),
  CONSTRAINT place_profile_age_order CHECK (age_min IS NULL OR age_max IS NULL OR age_min <= age_max),

  -- Library pass (JSONB blob already used on venues)
  library_pass     JSONB,

  -- Verification
  last_verified_at   TIMESTAMPTZ,
  planning_notes     TEXT,
  planning_last_verified_at TIMESTAMPTZ,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_place_profile_featured
  ON place_profile(venue_id) WHERE featured = true;

CREATE INDEX IF NOT EXISTS idx_place_profile_explore_category
  ON place_profile(explore_category) WHERE explore_category IS NOT NULL;

CREATE TRIGGER update_place_profile_updated_at
  BEFORE UPDATE ON place_profile
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 3. place_vertical_details — 1:1 JSONB extensions by vertical
--    Each column holds a JSONB blob for that vertical's attributes.
--    New verticals just add a column — no schema upheaval.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS place_vertical_details (
  venue_id  INTEGER PRIMARY KEY REFERENCES venues(id) ON DELETE CASCADE,

  -- Dining vertical (restaurants, bars, cafes)
  -- Shape: { service_style, meal_duration_min_minutes, meal_duration_max_minutes,
  --          walk_in_wait_minutes, payment_buffer_minutes, accepts_reservations,
  --          reservation_recommended, menu_url, reservation_url,
  --          cuisine, dietary_options, menu_highlights, payment_notes }
  dining    JSONB,

  -- Outdoor/adventure vertical (parks, trails, destinations)
  -- Shape mirrors venue_destination_details columns
  outdoor   JSONB,

  -- Civic vertical (community centers, government, volunteer hubs)
  -- Shape: { civic_type, volunteer_opportunities_url, ada_accessible, ... }
  civic     JSONB,

  -- Google Places enrichment snapshot
  -- Shape: { place_id, rating, rating_count, price_level, types,
  --          google_maps_url, enriched_at }
  google    JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- GIN indexes on JSONB columns used in filter queries
CREATE INDEX IF NOT EXISTS idx_place_vertical_dining
  ON place_vertical_details USING GIN(dining)
  WHERE dining IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_place_vertical_outdoor
  ON place_vertical_details USING GIN(outdoor)
  WHERE outdoor IS NOT NULL;

CREATE TRIGGER update_place_vertical_details_updated_at
  BEFORE UPDATE ON place_vertical_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 4. place_candidates — staging table for unmatched crawler locations
--    Crawlers write here when they find a location they can't match to an
--    existing venue. Ops reviews and promotes to venues via merge_venues().
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'place_candidate_status') THEN
    CREATE TYPE place_candidate_status AS ENUM (
      'pending',    -- awaiting review
      'promoted',   -- merged into venues table
      'rejected',   -- confirmed duplicate or garbage
      'deferred'    -- real place, not worth adding yet
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS place_candidates (
  id                  SERIAL PRIMARY KEY,

  -- Raw data from crawler
  raw_name            TEXT NOT NULL,
  raw_address         TEXT,
  lat                 DECIMAL(10,8),
  lng                 DECIMAL(11,8),
  source_id           INTEGER REFERENCES sources(id) ON DELETE SET NULL,
  source_url          TEXT,

  -- Matching signals
  match_confidence    DECIMAL(3,2) CHECK (match_confidence BETWEEN 0 AND 1),
  potential_venue_id  INTEGER REFERENCES venues(id) ON DELETE SET NULL,

  -- Workflow
  status              place_candidate_status NOT NULL DEFAULT 'pending',
  promoted_to_venue_id INTEGER REFERENCES venues(id) ON DELETE SET NULL,
  review_notes        TEXT,
  reviewed_at         TIMESTAMPTZ,
  reviewed_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Raw payload for context
  raw_payload         JSONB,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_place_candidates_status
  ON place_candidates(status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_place_candidates_source
  ON place_candidates(source_id);

CREATE INDEX IF NOT EXISTS idx_place_candidates_potential_venue
  ON place_candidates(potential_venue_id)
  WHERE potential_venue_id IS NOT NULL;

CREATE TRIGGER update_place_candidates_updated_at
  BEFORE UPDATE ON place_candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 5. merge_venues(keep_id, drop_id) — re-parents all FKs and soft-deletes
--    the duplicate venue. Safe to call multiple times (idempotent on the
--    keep side; the drop side becomes inactive after first call).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION merge_venues(
  p_keep_id INTEGER,
  p_drop_id INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Sanity checks
  IF p_keep_id = p_drop_id THEN
    RAISE EXCEPTION 'merge_venues: keep and drop must be different venues (got %)', p_keep_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM venues WHERE id = p_keep_id) THEN
    RAISE EXCEPTION 'merge_venues: keep venue % does not exist', p_keep_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM venues WHERE id = p_drop_id) THEN
    RAISE EXCEPTION 'merge_venues: drop venue % does not exist', p_drop_id;
  END IF;

  -- Re-parent events
  UPDATE events
  SET venue_id = p_keep_id
  WHERE venue_id = p_drop_id;

  -- Re-parent venue_occasions (unique constraint on (venue_id, occasion) — skip conflicts)
  -- Move rows that don't already exist on the keep side
  UPDATE venue_occasions AS vo
  SET venue_id = p_keep_id
  WHERE vo.venue_id = p_drop_id
    AND NOT EXISTS (
      SELECT 1 FROM venue_occasions keep_vo
      WHERE keep_vo.venue_id = p_keep_id
        AND keep_vo.occasion = vo.occasion
    );
  -- Remove any remaining rows still on drop side (already exist on keep side)
  DELETE FROM venue_occasions WHERE venue_id = p_drop_id;

  -- Re-parent venue_specials
  UPDATE venue_specials
  SET venue_id = p_keep_id
  WHERE venue_id = p_drop_id;

  -- Re-parent editorial_mentions
  UPDATE editorial_mentions
  SET venue_id = p_keep_id
  WHERE venue_id = p_drop_id;

  -- Re-parent programs (nullable FK)
  UPDATE programs
  SET venue_id = p_keep_id
  WHERE venue_id = p_drop_id;

  -- Re-parent exhibitions (NOT NULL FK — no conflict expected but guard anyway)
  UPDATE exhibitions
  SET venue_id = p_keep_id
  WHERE venue_id = p_drop_id;

  -- Re-parent open_calls (nullable FK)
  UPDATE open_calls
  SET venue_id = p_keep_id
  WHERE venue_id = p_drop_id;

  -- Re-parent walkable_neighbors — two FKs (venue_id and neighbor_id)
  -- Move venue_id rows that won't create duplicate pairs
  UPDATE walkable_neighbors wn
  SET venue_id = p_keep_id
  WHERE wn.venue_id = p_drop_id
    AND NOT EXISTS (
      SELECT 1 FROM walkable_neighbors wn2
      WHERE wn2.venue_id = p_keep_id
        AND wn2.neighbor_id = wn.neighbor_id
    );
  -- Move neighbor_id rows that won't create duplicate pairs
  UPDATE walkable_neighbors wn
  SET neighbor_id = p_keep_id
  WHERE wn.neighbor_id = p_drop_id
    AND NOT EXISTS (
      SELECT 1 FROM walkable_neighbors wn2
      WHERE wn2.venue_id = wn.venue_id
        AND wn2.neighbor_id = p_keep_id
    );
  -- Remove any remaining rows that still reference drop_id
  DELETE FROM walkable_neighbors
  WHERE venue_id = p_drop_id OR neighbor_id = p_drop_id;

  -- Update place_candidates that pointed at the dropped venue
  UPDATE place_candidates
  SET promoted_to_venue_id = p_keep_id
  WHERE promoted_to_venue_id = p_drop_id;

  UPDATE place_candidates
  SET potential_venue_id = p_keep_id
  WHERE potential_venue_id = p_drop_id;

  -- Soft-delete the duplicate venue (preserve the row for audit trail)
  UPDATE venues
  SET active = false,
      updated_at = now()
  WHERE id = p_drop_id;

  RAISE NOTICE 'merge_venues: merged % → %; % deactivated', p_drop_id, p_keep_id, p_drop_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. RLS policies
-- ---------------------------------------------------------------------------

-- venues: public read, service_role write
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venues_public_read"
  ON venues FOR SELECT
  USING (true);

CREATE POLICY "venues_service_role_write"
  ON venues FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- place_profile: public read, service_role write
ALTER TABLE place_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "place_profile_public_read"
  ON place_profile FOR SELECT
  USING (true);

CREATE POLICY "place_profile_service_role_write"
  ON place_profile FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- place_vertical_details: public read, service_role write
ALTER TABLE place_vertical_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "place_vertical_details_public_read"
  ON place_vertical_details FOR SELECT
  USING (true);

CREATE POLICY "place_vertical_details_service_role_write"
  ON place_vertical_details FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- place_candidates: admin-only (no public read — contains unvalidated data)
ALTER TABLE place_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "place_candidates_service_role_only"
  ON place_candidates FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 7. Data backfill — populate extension tables from existing venues columns
-- ---------------------------------------------------------------------------

-- 7a. place_profile: seed from existing venue enrichment columns.
--     Only insert rows where at least one enrichment field is non-null.
--     ON CONFLICT DO NOTHING makes this re-runnable.
INSERT INTO place_profile (
  venue_id,
  description,
  short_description,
  hero_image_url,
  featured,
  explore_category,
  explore_blurb,
  library_pass,
  last_verified_at,
  planning_notes,
  planning_last_verified_at
)
SELECT
  v.id,
  v.description,
  v.short_description,
  v.hero_image_url,
  COALESCE(v.featured, false),
  v.explore_category,
  v.explore_blurb,
  v.library_pass,
  v.last_verified_at,
  v.planning_notes,
  v.planning_last_verified_at
FROM venues v
WHERE (
  v.description IS NOT NULL
  OR v.short_description IS NOT NULL
  OR v.hero_image_url IS NOT NULL
  OR v.featured = true
  OR v.explore_category IS NOT NULL
  OR v.explore_blurb IS NOT NULL
  OR v.library_pass IS NOT NULL
  OR v.last_verified_at IS NOT NULL
  OR v.planning_notes IS NOT NULL
)
ON CONFLICT (venue_id) DO NOTHING;

-- 7b. place_vertical_details.outdoor: seed from venue_destination_details
INSERT INTO place_vertical_details (venue_id, outdoor)
SELECT
  vdd.venue_id,
  jsonb_strip_nulls(jsonb_build_object(
    'destination_type',    vdd.destination_type,
    'commitment_tier',     vdd.commitment_tier,
    'primary_activity',    vdd.primary_activity,
    'drive_time_minutes',  vdd.drive_time_minutes,
    'difficulty_level',    vdd.difficulty_level,
    'trail_length_miles',  vdd.trail_length_miles,
    'elevation_gain_ft',   vdd.elevation_gain_ft,
    'surface_type',        vdd.surface_type,
    'best_seasons',        vdd.best_seasons,
    'weather_fit_tags',    vdd.weather_fit_tags,
    'practical_notes',     vdd.practical_notes,
    'conditions_notes',    vdd.conditions_notes,
    'accessibility_notes', vdd.accessibility_notes,
    'parking_type',        vdd.parking_type,
    'parking_capacity',    vdd.parking_capacity,
    'best_time_of_day',    vdd.best_time_of_day,
    'family_suitability',  vdd.family_suitability,
    'dog_friendly',        vdd.dog_friendly,
    'reservation_required',vdd.reservation_required,
    'permit_required',     vdd.permit_required,
    'fee_note',            vdd.fee_note,
    'seasonal_hazards',    vdd.seasonal_hazards,
    'source_url',          vdd.source_url,
    'metadata',            NULLIF(vdd.metadata, '{}'::jsonb)
  ))
FROM venue_destination_details vdd
ON CONFLICT (venue_id) DO UPDATE
  SET outdoor   = EXCLUDED.outdoor,
      updated_at = now();

-- 7c. place_vertical_details.dining: seed from dining columns on venues.
--     Use INSERT … ON CONFLICT to merge with any row already created by 7b.
INSERT INTO place_vertical_details (venue_id, dining)
SELECT
  v.id,
  jsonb_strip_nulls(jsonb_build_object(
    'service_style',               v.service_style,
    'meal_duration_min_minutes',   v.meal_duration_min_minutes,
    'meal_duration_max_minutes',   v.meal_duration_max_minutes,
    'walk_in_wait_minutes',        v.walk_in_wait_minutes,
    'payment_buffer_minutes',      v.payment_buffer_minutes,
    'accepts_reservations',        v.accepts_reservations,
    'reservation_recommended',     v.reservation_recommended,
    'menu_url',                    v.menu_url,
    'reservation_url',             v.reservation_url
  ))
FROM venues v
WHERE (
  v.service_style IS NOT NULL
  OR v.meal_duration_min_minutes IS NOT NULL
  OR v.accepts_reservations IS NOT NULL
  OR v.menu_url IS NOT NULL
  OR v.reservation_url IS NOT NULL
)
ON CONFLICT (venue_id) DO UPDATE
  SET dining    = EXCLUDED.dining,
      updated_at = now();

COMMIT;
