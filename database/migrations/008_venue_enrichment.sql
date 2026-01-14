-- Migration: Add venue enrichment tracking columns
-- Supports Google Places enrichment and data quality tracking

-- Add enrichment tracking columns
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS google_place_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS google_data JSONB,
  ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS location_type TEXT DEFAULT 'venue',  -- 'venue', 'address', 'virtual'
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS google_maps_url TEXT,
  ADD COLUMN IF NOT EXISTS rating DECIMAL(2, 1),
  ADD COLUMN IF NOT EXISTS rating_count INT,
  ADD COLUMN IF NOT EXISTS typical_price_min INT,
  ADD COLUMN IF NOT EXISTS typical_price_max INT;

-- Add PostGIS location column if not exists (requires PostGIS extension)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'venues' AND column_name = 'location'
  ) THEN
    ALTER TABLE venues ADD COLUMN location GEOGRAPHY(POINT, 4326);
  END IF;
END $$;

-- Create trigger to update location from lat/lng
CREATE OR REPLACE FUNCTION update_venue_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS venue_location_trigger ON venues;
CREATE TRIGGER venue_location_trigger
BEFORE INSERT OR UPDATE ON venues
FOR EACH ROW EXECUTE FUNCTION update_venue_location();

-- Index for spatial queries
CREATE INDEX IF NOT EXISTS idx_venues_location ON venues USING GIST(location);

-- Index for google_place_id lookups
CREATE INDEX IF NOT EXISTS idx_venues_google_place_id ON venues(google_place_id) WHERE google_place_id IS NOT NULL;

-- Index for location_type filtering
CREATE INDEX IF NOT EXISTS idx_venues_location_type ON venues(location_type);

-- Update existing venues with lat/lng to populate location
UPDATE venues SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
WHERE lat IS NOT NULL AND lng IS NOT NULL AND location IS NULL;
