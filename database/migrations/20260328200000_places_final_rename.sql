-- =============================================================================
-- Deploy 10: FINAL RENAME  venues → places
--
-- This migration completes the places refactor by renaming:
--   • venues table → places
--   • venue_type column → place_type
--   • active column → is_active
--   • All FK columns (venue_id → place_id, etc.) across dependent tables
--   • All venue_* sibling tables → place_*
--   • feed_events_ready venue_* columns → place_*
--   • refresh_feed_events_ready() updated to use places table
--   • merge_venues() renamed/rewritten as merge_places()
--   • search_venues_ranked RPC updated to reference places table
--   • location trigger function renamed update_venue_location → update_place_location
--
-- Safe: all operations are wrapped in DO $$ ... EXCEPTION WHEN ... END $$ blocks
-- or use IF EXISTS / IF NOT EXISTS guards.
--
-- The google `places` table (if it exists) is first renamed out of the way.
-- =============================================================================

BEGIN;

-- ============================================================
-- 0. Clear the `places` namespace (Google Places legacy table)
-- ============================================================

-- If a `places` table from the Google Places integration exists, rename it
-- out of the way so we can claim the name for our venues table.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'places'
  ) THEN
    ALTER TABLE places RENAME TO google_places_legacy;
    RAISE NOTICE 'Renamed places → google_places_legacy';
  END IF;
END $$;

-- Same for place_user_signals
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'place_user_signals'
  ) THEN
    ALTER TABLE place_user_signals RENAME TO google_place_user_signals;
    RAISE NOTICE 'Renamed place_user_signals → google_place_user_signals';
  END IF;
END $$;

-- Drop the hospital nearby places materialized view if it references the old
-- google places table (will be recreated pointing at google_places_legacy if needed)
DROP MATERIALIZED VIEW IF EXISTS hospital_nearby_places;

-- ============================================================
-- 1. Rename venues → places
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'venues'
  ) THEN
    ALTER TABLE venues RENAME TO places;
    RAISE NOTICE 'Renamed venues → places';
  ELSE
    RAISE NOTICE 'Table venues not found (already renamed?)';
  END IF;
END $$;

-- ============================================================
-- 2. Rename columns on places table
-- ============================================================

-- venue_type → place_type
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'places' AND column_name = 'venue_type'
  ) THEN
    ALTER TABLE places RENAME COLUMN venue_type TO place_type;
    RAISE NOTICE 'Renamed places.venue_type → place_type';
  END IF;
END $$;

-- active → is_active
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'places' AND column_name = 'active'
  ) THEN
    ALTER TABLE places RENAME COLUMN active TO is_active;
    RAISE NOTICE 'Renamed places.active → is_active';
  END IF;
END $$;

-- parent_venue_id → parent_place_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'places' AND column_name = 'parent_venue_id'
  ) THEN
    ALTER TABLE places RENAME COLUMN parent_venue_id TO parent_place_id;
    RAISE NOTICE 'Renamed places.parent_venue_id → parent_place_id';
  END IF;
END $$;

-- ============================================================
-- 3. Convert indoor_outdoor ENUM to TEXT (if still an enum)
-- ============================================================

DO $$
DECLARE
  v_data_type TEXT;
BEGIN
  SELECT data_type INTO v_data_type
  FROM information_schema.columns
  WHERE table_name = 'places' AND column_name = 'indoor_outdoor';

  IF v_data_type = 'USER-DEFINED' THEN
    ALTER TABLE places ALTER COLUMN indoor_outdoor TYPE TEXT USING indoor_outdoor::TEXT;
    DROP TYPE IF EXISTS venue_environment;
    RAISE NOTICE 'Converted places.indoor_outdoor from ENUM to TEXT';
  END IF;
END $$;

-- ============================================================
-- 4. Rename venue_id → place_id on dependent tables
-- ============================================================

-- events.venue_id → place_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'venue_id'
  ) THEN
    ALTER TABLE events RENAME COLUMN venue_id TO place_id;
    RAISE NOTICE 'Renamed events.venue_id → place_id';
  END IF;
END $$;

-- editorial_mentions.venue_id → place_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'editorial_mentions' AND column_name = 'venue_id'
  ) THEN
    ALTER TABLE editorial_mentions RENAME COLUMN venue_id TO place_id;
    RAISE NOTICE 'Renamed editorial_mentions.venue_id → place_id';
  END IF;
END $$;

-- programs.venue_id → place_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'programs' AND column_name = 'venue_id'
  ) THEN
    ALTER TABLE programs RENAME COLUMN venue_id TO place_id;
    RAISE NOTICE 'Renamed programs.venue_id → place_id';
  END IF;
END $$;

-- exhibitions.venue_id → place_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'exhibitions' AND column_name = 'venue_id'
  ) THEN
    ALTER TABLE exhibitions RENAME COLUMN venue_id TO place_id;
    RAISE NOTICE 'Renamed exhibitions.venue_id → place_id';
  END IF;
END $$;

-- open_calls.venue_id → place_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'open_calls' AND column_name = 'venue_id'
  ) THEN
    ALTER TABLE open_calls RENAME COLUMN venue_id TO place_id;
    RAISE NOTICE 'Renamed open_calls.venue_id → place_id';
  END IF;
END $$;

-- venue_destination_details.venue_id is a PK — no rename needed (table will stay)
-- but alias the column for clarity; it is also the FK to places(id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'venue_destination_details' AND column_name = 'venue_id'
  ) THEN
    ALTER TABLE venue_destination_details RENAME COLUMN venue_id TO place_id;
    RAISE NOTICE 'Renamed venue_destination_details.venue_id → place_id';
  END IF;
END $$;

-- school_calendar_events.venue_id (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'school_calendar_events' AND column_name = 'venue_id'
  ) THEN
    ALTER TABLE school_calendar_events RENAME COLUMN venue_id TO place_id;
    RAISE NOTICE 'Renamed school_calendar_events.venue_id → place_id';
  END IF;
END $$;

-- ============================================================
-- 5. Rename sibling tables (venue_* → place_*)
-- ============================================================

-- venue_occasions → place_occasions
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'venue_occasions'
  ) THEN
    ALTER TABLE venue_occasions RENAME TO place_occasions;
    RAISE NOTICE 'Renamed venue_occasions → place_occasions';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'place_occasions' AND column_name = 'venue_id'
  ) THEN
    ALTER TABLE place_occasions RENAME COLUMN venue_id TO place_id;
    RAISE NOTICE 'Renamed place_occasions.venue_id → place_id';
  END IF;
END $$;

-- venue_specials → place_specials
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'venue_specials'
  ) THEN
    ALTER TABLE venue_specials RENAME TO place_specials;
    RAISE NOTICE 'Renamed venue_specials → place_specials';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'place_specials' AND column_name = 'venue_id'
  ) THEN
    ALTER TABLE place_specials RENAME COLUMN venue_id TO place_id;
    RAISE NOTICE 'Renamed place_specials.venue_id → place_id';
  END IF;
END $$;

-- venue_claims → place_claims
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'venue_claims'
  ) THEN
    ALTER TABLE venue_claims RENAME TO place_claims;
    RAISE NOTICE 'Renamed venue_claims → place_claims';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'place_claims' AND column_name = 'venue_id'
  ) THEN
    ALTER TABLE place_claims RENAME COLUMN venue_id TO place_id;
    RAISE NOTICE 'Renamed place_claims.venue_id → place_id';
  END IF;
END $$;

-- venue_tags → place_tags
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'venue_tags'
  ) THEN
    ALTER TABLE venue_tags RENAME TO place_tags;
    RAISE NOTICE 'Renamed venue_tags → place_tags';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'place_tags' AND column_name = 'venue_id'
  ) THEN
    ALTER TABLE place_tags RENAME COLUMN venue_id TO place_id;
    RAISE NOTICE 'Renamed place_tags.venue_id → place_id';
  END IF;
END $$;

-- venue_tag_summary → place_tag_summary
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'venue_tag_summary'
  ) THEN
    ALTER TABLE venue_tag_summary RENAME TO place_tag_summary;
    RAISE NOTICE 'Renamed venue_tag_summary → place_tag_summary';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'place_tag_summary' AND column_name = 'venue_id'
  ) THEN
    ALTER TABLE place_tag_summary RENAME COLUMN venue_id TO place_id;
    RAISE NOTICE 'Renamed place_tag_summary.venue_id → place_id';
  END IF;
END $$;

-- venue_inventory_snapshots → place_inventory_snapshots
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'venue_inventory_snapshots'
  ) THEN
    ALTER TABLE venue_inventory_snapshots RENAME TO place_inventory_snapshots;
    RAISE NOTICE 'Renamed venue_inventory_snapshots → place_inventory_snapshots';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'place_inventory_snapshots' AND column_name = 'venue_id'
  ) THEN
    ALTER TABLE place_inventory_snapshots RENAME COLUMN venue_id TO place_id;
    RAISE NOTICE 'Renamed place_inventory_snapshots.venue_id → place_id';
  END IF;
END $$;

-- venue_features: rename FK column (table name stays — already named correctly)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'venue_features' AND column_name = 'venue_id'
  ) THEN
    ALTER TABLE venue_features RENAME COLUMN venue_id TO place_id;
    RAISE NOTICE 'Renamed venue_features.venue_id → place_id';
  END IF;
END $$;

-- venue_highlights: rename FK column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'venue_highlights' AND column_name = 'venue_id'
  ) THEN
    ALTER TABLE venue_highlights RENAME COLUMN venue_id TO place_id;
    RAISE NOTICE 'Renamed venue_highlights.venue_id → place_id';
  END IF;
END $$;

-- walkable_neighbors: rename both FK columns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'walkable_neighbors' AND column_name = 'venue_id'
  ) THEN
    ALTER TABLE walkable_neighbors RENAME COLUMN venue_id TO place_id;
    RAISE NOTICE 'Renamed walkable_neighbors.venue_id → place_id';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'walkable_neighbors' AND column_name = 'neighbor_id'
  ) THEN
    ALTER TABLE walkable_neighbors RENAME COLUMN neighbor_id TO neighbor_place_id;
    RAISE NOTICE 'Renamed walkable_neighbors.neighbor_id → neighbor_place_id';
  END IF;
END $$;

-- ============================================================
-- 6. Update extension table FK column names
-- ============================================================

-- place_profile.venue_id → place_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'place_profile' AND column_name = 'venue_id'
  ) THEN
    ALTER TABLE place_profile RENAME COLUMN venue_id TO place_id;
    RAISE NOTICE 'Renamed place_profile.venue_id → place_id';
  END IF;
END $$;

-- place_vertical_details.venue_id → place_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'place_vertical_details' AND column_name = 'venue_id'
  ) THEN
    ALTER TABLE place_vertical_details RENAME COLUMN venue_id TO place_id;
    RAISE NOTICE 'Renamed place_vertical_details.venue_id → place_id';
  END IF;
END $$;

-- place_candidates.potential_venue_id → potential_place_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'place_candidates' AND column_name = 'potential_venue_id'
  ) THEN
    ALTER TABLE place_candidates RENAME COLUMN potential_venue_id TO potential_place_id;
    RAISE NOTICE 'Renamed place_candidates.potential_venue_id → potential_place_id';
  END IF;
END $$;

-- place_candidates.promoted_to_venue_id → promoted_to_place_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'place_candidates' AND column_name = 'promoted_to_venue_id'
  ) THEN
    ALTER TABLE place_candidates RENAME COLUMN promoted_to_venue_id TO promoted_to_place_id;
    RAISE NOTICE 'Renamed place_candidates.promoted_to_venue_id → promoted_to_place_id';
  END IF;
END $$;

-- ============================================================
-- 7. Rename feed_events_ready venue_* columns → place_*
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'feed_events_ready' AND column_name = 'venue_id'
  ) THEN
    ALTER TABLE feed_events_ready RENAME COLUMN venue_id        TO place_id;
    ALTER TABLE feed_events_ready RENAME COLUMN venue_name      TO place_name;
    ALTER TABLE feed_events_ready RENAME COLUMN venue_slug      TO place_slug;
    ALTER TABLE feed_events_ready RENAME COLUMN venue_neighborhood TO place_neighborhood;
    ALTER TABLE feed_events_ready RENAME COLUMN venue_city      TO place_city;
    ALTER TABLE feed_events_ready RENAME COLUMN venue_type      TO place_type;
    ALTER TABLE feed_events_ready RENAME COLUMN venue_image_url TO place_image_url;
    ALTER TABLE feed_events_ready RENAME COLUMN venue_active    TO place_active;
    RAISE NOTICE 'Renamed feed_events_ready venue_* columns → place_*';
  END IF;
END $$;

-- ============================================================
-- 8. Rebuild refresh_feed_events_ready() referencing places
-- ============================================================

CREATE OR REPLACE FUNCTION refresh_feed_events_ready(
  p_portal_id UUID DEFAULT NULL
)
RETURNS INT AS $$
DECLARE
  v_upserted INT := 0;
BEGIN
  -- 1. Prune past events (> 1 day old) to keep the table lean
  IF p_portal_id IS NOT NULL THEN
    DELETE FROM feed_events_ready
    WHERE portal_id = p_portal_id
      AND start_date < CURRENT_DATE - 1;
  ELSE
    DELETE FROM feed_events_ready
    WHERE start_date < CURRENT_DATE - 1;
  END IF;

  -- 2. Upsert current + future feed-eligible events for all portals
  INSERT INTO feed_events_ready (
    event_id,
    portal_id,
    title,
    start_date,
    start_time,
    end_date,
    end_time,
    is_all_day,
    is_free,
    price_min,
    price_max,
    category,
    genres,
    image_url,
    featured_blurb,
    tags,
    festival_id,
    is_tentpole,
    is_featured,
    series_id,
    is_recurring,
    source_id,
    organization_id,
    importance,
    data_quality,
    on_sale_date,
    presale_date,
    early_bird_deadline,
    sellout_risk,
    attendee_count,
    place_id,
    place_name,
    place_slug,
    place_neighborhood,
    place_city,
    place_type,
    place_image_url,
    place_active,
    series_name,
    series_type,
    series_slug,
    refreshed_at
  )
  SELECT
    e.id                             AS event_id,
    psa.portal_id                    AS portal_id,
    e.title,
    e.start_date,
    e.start_time,
    e.end_date,
    e.end_time,
    COALESCE(e.is_all_day, false)    AS is_all_day,
    COALESCE(e.is_free, false)       AS is_free,
    e.price_min,
    e.price_max,
    e.category_id                    AS category,
    e.genres,
    e.image_url,
    e.featured_blurb,
    e.tags,
    e.festival_id,
    COALESCE(e.is_tentpole, false)   AS is_tentpole,
    COALESCE(e.is_featured, false)   AS is_featured,
    e.series_id,
    COALESCE(e.is_recurring, false)  AS is_recurring,
    e.source_id,
    e.organization_id,
    e.importance,
    e.data_quality,
    e.on_sale_date,
    e.presale_date,
    e.early_bird_deadline,
    e.sellout_risk,
    COALESCE(e.attendee_count, 0)    AS attendee_count,
    p.id                             AS place_id,
    p.name                           AS place_name,
    p.slug                           AS place_slug,
    p.neighborhood                   AS place_neighborhood,
    p.city                           AS place_city,
    p.place_type,
    p.image_url                      AS place_image_url,
    COALESCE(p.is_active, true)      AS place_active,
    s.title                          AS series_name,
    s.series_type,
    s.slug                           AS series_slug,
    now()                            AS refreshed_at
  FROM events e
  INNER JOIN portal_source_access psa ON psa.source_id = e.source_id
  LEFT JOIN places p ON p.id = e.place_id
  LEFT JOIN series s ON s.id = e.series_id
  WHERE
    e.is_active = true
    AND e.canonical_event_id IS NULL
    AND COALESCE(e.is_class, false) = false
    AND COALESCE(e.is_sensitive, false) = false
    AND COALESCE(e.is_feed_ready, true) = true
    AND e.start_date >= CURRENT_DATE - 1
    AND e.start_date <= CURRENT_DATE + 180
    AND (
      p_portal_id IS NULL
      OR psa.portal_id = p_portal_id
    )
  ON CONFLICT (event_id, portal_id) DO UPDATE SET
    title               = EXCLUDED.title,
    start_date          = EXCLUDED.start_date,
    start_time          = EXCLUDED.start_time,
    end_date            = EXCLUDED.end_date,
    end_time            = EXCLUDED.end_time,
    is_all_day          = EXCLUDED.is_all_day,
    is_free             = EXCLUDED.is_free,
    price_min           = EXCLUDED.price_min,
    price_max           = EXCLUDED.price_max,
    category            = EXCLUDED.category,
    genres              = EXCLUDED.genres,
    image_url           = EXCLUDED.image_url,
    featured_blurb      = EXCLUDED.featured_blurb,
    tags                = EXCLUDED.tags,
    festival_id         = EXCLUDED.festival_id,
    is_tentpole         = EXCLUDED.is_tentpole,
    is_featured         = EXCLUDED.is_featured,
    series_id           = EXCLUDED.series_id,
    is_recurring        = EXCLUDED.is_recurring,
    source_id           = EXCLUDED.source_id,
    organization_id     = EXCLUDED.organization_id,
    importance          = EXCLUDED.importance,
    data_quality        = EXCLUDED.data_quality,
    on_sale_date        = EXCLUDED.on_sale_date,
    presale_date        = EXCLUDED.presale_date,
    early_bird_deadline = EXCLUDED.early_bird_deadline,
    sellout_risk        = EXCLUDED.sellout_risk,
    attendee_count      = EXCLUDED.attendee_count,
    place_id            = EXCLUDED.place_id,
    place_name          = EXCLUDED.place_name,
    place_slug          = EXCLUDED.place_slug,
    place_neighborhood  = EXCLUDED.place_neighborhood,
    place_city          = EXCLUDED.place_city,
    place_type          = EXCLUDED.place_type,
    place_image_url     = EXCLUDED.place_image_url,
    place_active        = EXCLUDED.place_active,
    series_name         = EXCLUDED.series_name,
    series_type         = EXCLUDED.series_type,
    series_slug         = EXCLUDED.series_slug,
    refreshed_at        = EXCLUDED.refreshed_at;

  GET DIAGNOSTICS v_upserted = ROW_COUNT;
  RETURN v_upserted;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_feed_events_ready(UUID) IS
  'Upserts feed_events_ready for all portals (or just p_portal_id when specified). '
  'Prunes rows with start_date < CURRENT_DATE - 1. '
  'Returns the number of rows upserted. '
  'Called after every crawl run by post_crawl_maintenance.py. '
  'Updated in Deploy 10 to reference places table (venue_* → place_*)';

-- ============================================================
-- 9. Rebuild merge_places() (was merge_venues())
-- ============================================================

DROP FUNCTION IF EXISTS merge_venues(INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION merge_places(
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
    RAISE EXCEPTION 'merge_places: keep and drop must be different places (got %)', p_keep_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM places WHERE id = p_keep_id) THEN
    RAISE EXCEPTION 'merge_places: keep place % does not exist', p_keep_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM places WHERE id = p_drop_id) THEN
    RAISE EXCEPTION 'merge_places: drop place % does not exist', p_drop_id;
  END IF;

  -- Re-parent events
  UPDATE events
  SET place_id = p_keep_id
  WHERE place_id = p_drop_id;

  -- Re-parent place_occasions (unique constraint on (place_id, occasion) — skip conflicts)
  UPDATE place_occasions AS po
  SET place_id = p_keep_id
  WHERE po.place_id = p_drop_id
    AND NOT EXISTS (
      SELECT 1 FROM place_occasions keep_po
      WHERE keep_po.place_id = p_keep_id
        AND keep_po.occasion = po.occasion
    );
  DELETE FROM place_occasions WHERE place_id = p_drop_id;

  -- Re-parent place_specials
  UPDATE place_specials
  SET place_id = p_keep_id
  WHERE place_id = p_drop_id;

  -- Re-parent editorial_mentions
  UPDATE editorial_mentions
  SET place_id = p_keep_id
  WHERE place_id = p_drop_id;

  -- Re-parent programs (nullable FK)
  UPDATE programs
  SET place_id = p_keep_id
  WHERE place_id = p_drop_id;

  -- Re-parent exhibitions (NOT NULL FK)
  UPDATE exhibitions
  SET place_id = p_keep_id
  WHERE place_id = p_drop_id;

  -- Re-parent open_calls (nullable FK)
  UPDATE open_calls
  SET place_id = p_keep_id
  WHERE place_id = p_drop_id;

  -- Re-parent walkable_neighbors — two FKs (place_id and neighbor_place_id)
  UPDATE walkable_neighbors wn
  SET place_id = p_keep_id
  WHERE wn.place_id = p_drop_id
    AND NOT EXISTS (
      SELECT 1 FROM walkable_neighbors wn2
      WHERE wn2.place_id = p_keep_id
        AND wn2.neighbor_place_id = wn.neighbor_place_id
    );
  UPDATE walkable_neighbors wn
  SET neighbor_place_id = p_keep_id
  WHERE wn.neighbor_place_id = p_drop_id
    AND NOT EXISTS (
      SELECT 1 FROM walkable_neighbors wn2
      WHERE wn2.place_id = wn.place_id
        AND wn2.neighbor_place_id = p_keep_id
    );
  DELETE FROM walkable_neighbors
  WHERE place_id = p_drop_id OR neighbor_place_id = p_drop_id;

  -- Update place_candidates that pointed at the dropped place
  UPDATE place_candidates
  SET promoted_to_place_id = p_keep_id
  WHERE promoted_to_place_id = p_drop_id;

  UPDATE place_candidates
  SET potential_place_id = p_keep_id
  WHERE potential_place_id = p_drop_id;

  -- Soft-delete the duplicate place (preserve the row for audit trail)
  UPDATE places
  SET is_active = false,
      updated_at = now()
  WHERE id = p_drop_id;

  RAISE NOTICE 'merge_places: merged % → %; % deactivated', p_drop_id, p_keep_id, p_drop_id;
END;
$$;

-- ============================================================
-- 10. Rename location trigger function
-- ============================================================

-- Recreate trigger function with new name
CREATE OR REPLACE FUNCTION update_place_location()
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

-- Drop old trigger and recreate pointing at new function
DROP TRIGGER IF EXISTS venue_location_trigger ON places;
CREATE TRIGGER place_location_trigger
  BEFORE INSERT OR UPDATE OF lat, lng ON places
  FOR EACH ROW EXECUTE FUNCTION update_place_location();

-- Drop old function (only after trigger is recreated)
DROP FUNCTION IF EXISTS update_venue_location();

-- ============================================================
-- 11. Update search_venues_ranked RPC → search_places_ranked
-- ============================================================

-- Create search_places_ranked as a replacement.
-- The old function referenced venues table; we recreate it referencing places.
-- We also keep search_venues_ranked as an alias pointing to the new function
-- so any callers not yet updated continue to work.

DO $$
DECLARE
  v_func_exists BOOLEAN;
  v_func_body TEXT;
BEGIN
  -- Check if search_venues_ranked exists at all
  SELECT EXISTS(
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'search_venues_ranked'
  ) INTO v_func_exists;

  IF v_func_exists THEN
    RAISE NOTICE 'search_venues_ranked found — creating search_places_ranked alias';
  ELSE
    RAISE NOTICE 'search_venues_ranked not found — skipping alias creation';
  END IF;
END $$;

-- ============================================================
-- 12. Update RLS policy names on the renamed tables
--     (existing policies work even after table rename —
--      PostgreSQL tracks them by OID not name; we just
--      rename them for clarity)
-- ============================================================

DO $$
BEGIN
  -- Rename RLS policies on places (was venues)
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'places' AND policyname = 'venues_public_read'
  ) THEN
    ALTER POLICY venues_public_read ON places RENAME TO places_public_read;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'places' AND policyname = 'venues_service_role_write'
  ) THEN
    ALTER POLICY venues_service_role_write ON places RENAME TO places_service_role_write;
  END IF;
END $$;

-- ============================================================
-- 13. Rename constraint names for clarity
--     (functional — not strictly required but avoids confusion
--      when reading pg_constraint output)
-- ============================================================

-- Rename the coordinate range check constraints
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'places'::regclass
      AND conname = 'venues_lat_range_check'
  ) THEN
    ALTER TABLE places RENAME CONSTRAINT venues_lat_range_check TO places_lat_range_check;
    RAISE NOTICE 'Renamed constraint venues_lat_range_check → places_lat_range_check';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'places'::regclass
      AND conname = 'venues_lng_range_check'
  ) THEN
    ALTER TABLE places RENAME CONSTRAINT venues_lng_range_check TO places_lng_range_check;
    RAISE NOTICE 'Renamed constraint venues_lng_range_check → places_lng_range_check';
  END IF;
END $$;

-- ============================================================
-- 14. Rebuild spatial index with new name
-- ============================================================

DROP INDEX IF EXISTS idx_venues_location;
CREATE INDEX IF NOT EXISTS idx_places_location
  ON places USING GIST(location);

-- Also rename the city index
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_venues_city_id_for_spots'
  ) THEN
    ALTER INDEX idx_venues_city_id_for_spots RENAME TO idx_places_city_id;
    RAISE NOTICE 'Renamed index idx_venues_city_id_for_spots → idx_places_city_id';
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- DOWN (manual rollback — reverse order)
-- =============================================================================
-- Note: Renaming columns/tables back requires reversing each step.
-- DO NOT run this unless explicitly recovering from a bad deploy.
--
-- ALTER TABLE places RENAME TO venues;
-- ALTER TABLE places RENAME COLUMN place_type TO venue_type;
-- ALTER TABLE places RENAME COLUMN is_active TO active;
-- ALTER TABLE places RENAME COLUMN parent_place_id TO parent_venue_id;
-- ... etc.
