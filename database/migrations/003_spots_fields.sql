-- Migration: Add spots fields to venues table
-- This extends venues to support the "Spots to Go" feature

-- Add spot-specific columns
ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS spot_type TEXT,           -- primary type: bar, restaurant, music_venue
  ADD COLUMN IF NOT EXISTS spot_types TEXT[],        -- multiple types: ['bar', 'music_venue']
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS short_description TEXT,   -- one-liner for cards
  ADD COLUMN IF NOT EXISTS price_level INT CHECK (price_level BETWEEN 1 AND 4),
  ADD COLUMN IF NOT EXISTS instagram TEXT,
  ADD COLUMN IF NOT EXISTS hours JSONB,              -- {"mon": {"open": "11:00", "close": "23:00"}}
  ADD COLUMN IF NOT EXISTS hours_display TEXT,       -- "Open until 2am"
  ADD COLUMN IF NOT EXISTS vibes TEXT[],             -- ['late-night', 'date-spot']
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Indexes for filtering
CREATE INDEX IF NOT EXISTS idx_venues_spot_type ON venues(spot_type);
CREATE INDEX IF NOT EXISTS idx_venues_spot_types ON venues USING GIN(spot_types);
CREATE INDEX IF NOT EXISTS idx_venues_active ON venues(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_venues_featured ON venues(featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_venues_vibes ON venues USING GIN(vibes);

-- Set initial spot_type based on venue_type if it exists
UPDATE venues
SET spot_type = venue_type
WHERE venue_type IS NOT NULL AND spot_type IS NULL;

-- Default all existing venues to active
UPDATE venues SET active = true WHERE active IS NULL;
