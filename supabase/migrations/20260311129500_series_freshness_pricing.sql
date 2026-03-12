-- Migration: Add freshness tracking and structured pricing to series table
-- Enables Regular Hangs to show price badges ("$3 tacos") and confidence-based
-- suppression of stale recurring events.

-- Structured pricing for recurring deals (e.g. "$3 tacos", "half-price bottles")
ALTER TABLE series ADD COLUMN IF NOT EXISTS price_note TEXT;

-- When a crawl last confirmed this recurring activity still exists
ALTER TABLE series ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

-- Data freshness confidence: high (verified <14d), medium (14-30d), low (>30d)
ALTER TABLE series ADD COLUMN IF NOT EXISTS confidence TEXT DEFAULT 'medium';

COMMENT ON COLUMN series.price_note IS 'Structured pricing for recurring deals, e.g. "$3 tacos", "half-price bottles". Displayed as badge on Regular Hangs cards.';
COMMENT ON COLUMN series.last_verified_at IS 'Last time a crawl confirmed this recurring activity still exists at the venue.';
COMMENT ON COLUMN series.confidence IS 'Data freshness: high (verified <14d), medium (14-30d), low (>30d). Series with low confidence are suppressed from primary feed.';
