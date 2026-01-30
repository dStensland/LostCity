-- Add foursquare_id column to venues table for Foursquare Places API integration
-- This supplements the existing google_place_id column

ALTER TABLE venues
ADD COLUMN IF NOT EXISTS foursquare_id TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_venues_foursquare_id ON venues(foursquare_id)
WHERE foursquare_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN venues.foursquare_id IS 'Foursquare Place ID for venue deduplication and data enrichment';
