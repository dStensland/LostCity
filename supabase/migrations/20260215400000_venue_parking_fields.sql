-- Add parking and transit fields to venues table
-- Populated by website scraping (crawl-time + backfill) and OSM data

ALTER TABLE venues ADD COLUMN IF NOT EXISTS parking_note TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS parking_type TEXT[];
ALTER TABLE venues ADD COLUMN IF NOT EXISTS parking_free BOOLEAN;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS parking_source TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS transit_note TEXT;

COMMENT ON COLUMN venues.parking_note IS 'Parking details scraped from venue website or manually entered';
COMMENT ON COLUMN venues.parking_type IS 'Array of parking types: lot, deck, garage, valet, street';
COMMENT ON COLUMN venues.parking_free IS 'Whether free parking is available (null = unknown)';
COMMENT ON COLUMN venues.parking_source IS 'How parking data was obtained: scraped, osm, manual';
COMMENT ON COLUMN venues.transit_note IS 'Transit/BeltLine/bike info scraped from venue website';
