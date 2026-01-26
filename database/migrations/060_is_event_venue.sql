-- Migration: Add is_event_venue column to venues table
-- Indicates whether a venue actively hosts events (concerts, shows, etc.)

ALTER TABLE venues ADD COLUMN IF NOT EXISTS is_event_venue BOOLEAN;

-- Partial index for filtering to only venues that host events
CREATE INDEX IF NOT EXISTS idx_venues_is_event_venue ON venues(is_event_venue) WHERE is_event_venue = TRUE;

-- Comment for documentation
COMMENT ON COLUMN venues.is_event_venue IS 'Whether the venue actively hosts events (concerts, shows, etc.) - determined by website analysis';
