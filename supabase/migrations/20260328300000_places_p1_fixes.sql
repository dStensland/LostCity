-- =============================================================================
-- Places P1 Fixes
--
-- 1. Add RLS to place_occasions (table was renamed from venue_occasions in
--    Deploy 10 but RLS was never enabled on it).
--
-- 2. Recreate hospital_nearby_places materialized view.
--    SKIPPED: The hospitals table does not exist in production.
--    The /api/places/hospital/[slug] route will return empty results
--    until the hospital portal is set up with its own table.
--
--    The new view joins the unified places table (formerly venues) with
--    hospitals using PostGIS ST_DWithin on the location geography column.
--    place_type replaces the old category_id since the unified places table
--    does not have a category_id column. The view exposes category_id as an
--    alias of place_type so the API route's .eq("category_id", category)
--    filter continues to work without code changes.
-- =============================================================================

BEGIN;

-- ============================================================
-- 1. RLS on place_occasions
-- ============================================================

ALTER TABLE place_occasions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'place_occasions' AND policyname = 'place_occasions_public_read'
  ) THEN
    CREATE POLICY "place_occasions_public_read" ON place_occasions
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'place_occasions' AND policyname = 'place_occasions_service_role_write'
  ) THEN
    CREATE POLICY "place_occasions_service_role_write" ON place_occasions
      FOR ALL
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END $$;

-- ============================================================
-- 2. Hospital nearby places materialized view — SKIPPED
-- The hospitals table does not exist in production.
-- This will be created when the hospital portal is set up.

COMMIT;
