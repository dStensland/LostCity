-- Migration 170: Add venue enrichment columns for specials scraper
-- menu_url, reservation_url, last_verified_at — captured during venue website scraping

-- Menu URL (links to venue's online menu)
ALTER TABLE venues ADD COLUMN IF NOT EXISTS menu_url TEXT;

-- Reservation URL (Resy, OpenTable, Yelp Reservations, etc.)
ALTER TABLE venues ADD COLUMN IF NOT EXISTS reservation_url TEXT;

-- Last time venue data was verified by scraper or human
ALTER TABLE venues ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

-- Also add last_verified_at to venue_specials for freshness tracking
ALTER TABLE venue_specials ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN venues.menu_url IS 'URL to venue online menu (website /menu page, PDF, etc.)';
COMMENT ON COLUMN venues.reservation_url IS 'URL to make reservations (Resy, OpenTable, Yelp, etc.)';
COMMENT ON COLUMN venues.last_verified_at IS 'Last time venue data was verified by scraper or human review';
COMMENT ON COLUMN venue_specials.last_verified_at IS 'Last time this special was verified as still active';

-- DOWN
-- ALTER TABLE venues DROP COLUMN IF EXISTS menu_url;
-- ALTER TABLE venues DROP COLUMN IF EXISTS reservation_url;
-- ALTER TABLE venues DROP COLUMN IF EXISTS last_verified_at;
-- ALTER TABLE venue_specials DROP COLUMN IF EXISTS last_verified_at;
