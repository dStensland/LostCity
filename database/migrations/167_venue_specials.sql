-- Migration 167: Create venue_specials table
-- Time-sensitive venue offerings: happy hours, daily specials, recurring deals, exhibits
-- These are NOT events (no dedup, no content hash, no ticket_url) but appear in feeds alongside events

-- ============================================================================
-- UP
-- ============================================================================

CREATE TABLE IF NOT EXISTS venue_specials (
    id SERIAL PRIMARY KEY,
    venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL,                -- happy_hour, daily_special, recurring_deal, exhibit, seasonal_menu, brunch, event_night
    description TEXT,
    days_of_week INTEGER[],           -- {1,2,3,4,5} = Mon-Fri (ISO 8601 weekday: 1=Mon, 7=Sun)
    time_start TIME,
    time_end TIME,
    start_date DATE,                  -- NULL = always active
    end_date DATE,                    -- NULL = no end
    image_url TEXT,
    price_note TEXT,                  -- "$11 spritzes", "50% off bottles", "$1 oysters"
    confidence TEXT DEFAULT 'medium', -- low, medium, high — how sure we are this is current
    source_url TEXT,                  -- where we found this info
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_venue_specials_venue ON venue_specials(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_specials_type ON venue_specials(type);
CREATE INDEX IF NOT EXISTS idx_venue_specials_active ON venue_specials(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_venue_specials_days ON venue_specials USING GIN (days_of_week) WHERE is_active = true;

-- RLS: public read, service role write
ALTER TABLE venue_specials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venue_specials_public_read" ON venue_specials
    FOR SELECT USING (true);

CREATE POLICY "venue_specials_service_write" ON venue_specials
    FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE venue_specials IS 'Time-sensitive venue offerings (happy hours, daily specials, recurring deals). Not events — no dedup or content hash.';
COMMENT ON COLUMN venue_specials.days_of_week IS 'ISO 8601 weekdays: 1=Monday through 7=Sunday. NULL means every day.';
COMMENT ON COLUMN venue_specials.confidence IS 'Data freshness confidence: low (unverified), medium (web research), high (confirmed on venue site)';

-- ============================================================================
-- DOWN
-- ============================================================================
-- DROP TABLE IF EXISTS venue_specials;
