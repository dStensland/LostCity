-- =============================================================================
-- Places P1 Fixes
--
-- 1. Add RLS to place_occasions (table was renamed from venue_occasions in
--    Deploy 10 but RLS was never enabled on it).
--
-- 2. Recreate hospital_nearby_places materialized view. Deploy 10 dropped the
--    old view (which joined the Google places table with hospitals) but did not
--    recreate it. The /api/places/hospital/[slug] route depends on it.
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
-- 2. Recreate hospital_nearby_places materialized view
-- ============================================================

-- Drop any remnant (idempotent — Deploy 10 already drops it, but be safe)
DROP MATERIALIZED VIEW IF EXISTS hospital_nearby_places;

-- The unified places table (formerly venues) does not have category_id,
-- final_score, rating, price_level, is_24_hours, or wheelchair_accessible.
-- Expose place_type AS category_id so the existing API filter works unchanged.
-- Null-coalesce missing columns for API compatibility.
CREATE MATERIALIZED VIEW hospital_nearby_places AS
SELECT
  p.id                                                        AS place_id,
  p.name,
  p.place_type                                                AS category_id,
  p.place_type,
  NULL::INT                                                   AS final_score,
  NULL::DECIMAL                                               AS rating,
  NULL::INT                                                   AS price_level,
  NULL::BOOLEAN                                               AS is_24_hours,
  NULL::BOOLEAN                                               AS wheelchair_accessible,
  h.id                                                        AS hospital_id,
  h.slug                                                      AS hospital_slug,
  ROUND(ST_Distance(p.location, h.location)::NUMERIC)         AS distance_meters
FROM places p
CROSS JOIN hospitals h
WHERE ST_DWithin(p.location, h.location, 5000)   -- 5 km radius
  AND COALESCE(p.is_active, true) = true
  AND p.location IS NOT NULL;

-- Indexes the API route relies on (filter by hospital + category, order by distance)
CREATE INDEX idx_hospital_nearby ON hospital_nearby_places(hospital_id, category_id, distance_meters);
CREATE INDEX idx_hospital_nearby_score ON hospital_nearby_places(hospital_id, distance_meters);

COMMENT ON MATERIALIZED VIEW hospital_nearby_places IS
  'Places within 5 km of each hospital, rebuilt in Places P1 Fixes to join the '
  'unified places table (formerly venues). place_type is aliased as category_id '
  'for backwards compatibility with the /api/places/hospital/[slug] route. '
  'Refresh with: REFRESH MATERIALIZED VIEW CONCURRENTLY hospital_nearby_places;';

COMMIT;
