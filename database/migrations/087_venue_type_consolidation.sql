-- ============================================
-- MIGRATION 087: Consolidate venue type fields
-- ============================================
-- Standardize venue type fields:
-- - spot_type → venue_type (single value)
-- - spot_types → venue_types (array)
-- ============================================

-- ============================================
-- 1. COPY SPOT_TYPE VALUES TO VENUE_TYPE WHERE NULL
-- ============================================
UPDATE venues
SET venue_type = COALESCE(venue_type, spot_type)
WHERE spot_type IS NOT NULL AND venue_type IS NULL;

-- ============================================
-- 2. ADD VENUE_TYPES ARRAY COLUMN IF NOT EXISTS
-- ============================================
ALTER TABLE venues ADD COLUMN IF NOT EXISTS venue_types TEXT[];

-- ============================================
-- 3. COPY SPOT_TYPES ARRAY TO VENUE_TYPES
-- ============================================
UPDATE venues
SET venue_types = spot_types
WHERE spot_types IS NOT NULL AND venue_types IS NULL;

-- ============================================
-- 4. DROP THE OLD COLUMNS
-- ============================================
-- Note: Only do this after code changes are deployed
-- Commenting out for safety - run manually after code is updated

-- ALTER TABLE venues DROP COLUMN IF EXISTS spot_type;
-- ALTER TABLE venues DROP COLUMN IF EXISTS spot_types;

-- ============================================
-- 5. CREATE INDEX ON VENUE_TYPES IF NOT EXISTS
-- ============================================
CREATE INDEX IF NOT EXISTS idx_venues_venue_types ON venues USING GIN (venue_types);

-- Comment
COMMENT ON COLUMN venues.venue_type IS 'Primary venue type (restaurant, bar, music_venue, etc.)';
COMMENT ON COLUMN venues.venue_types IS 'Array of venue types for venues with multiple purposes';
