-- Planning Horizon: event importance tiers, timeline fields, ticket intelligence
-- Surfaces big future events with advance-planning signals (ticket windows,
-- sellout risk, on-sale dates, registration deadlines).

-- ============================================================================
-- 1. EVENT IMPORTANCE TIER
-- ============================================================================
-- Replaces the underused is_tentpole boolean with a 3-tier system.
-- flagship = city-defining (Dragon Con, Music Midtown, Atlanta Pride)
-- major    = worth planning around (Tabernacle concerts, popular exhibitions)
-- standard = everything else (default, no special planning treatment)

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS importance TEXT
    NOT NULL DEFAULT 'standard'
    CHECK (importance IN ('flagship', 'major', 'standard'));

-- Backfill: existing is_tentpole events become flagship
UPDATE events
  SET importance = 'flagship'
  WHERE is_tentpole = true
    AND importance = 'standard';

-- ============================================================================
-- 2. PLANNING TIMELINE FIELDS
-- ============================================================================
-- When tickets go on sale, presale windows, early bird deadlines,
-- lineup/detail announcement dates, and registration windows.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS on_sale_date DATE,
  ADD COLUMN IF NOT EXISTS presale_date DATE,
  ADD COLUMN IF NOT EXISTS early_bird_deadline DATE,
  ADD COLUMN IF NOT EXISTS announce_date DATE,
  ADD COLUMN IF NOT EXISTS registration_opens DATE,
  ADD COLUMN IF NOT EXISTS registration_closes DATE,
  ADD COLUMN IF NOT EXISTS registration_url TEXT;

-- ============================================================================
-- 3. TICKET INTELLIGENCE
-- ============================================================================
-- Freshness tracking for ticket_status and a sellout risk indicator.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS ticket_status_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sellout_risk TEXT
    CHECK (sellout_risk IS NULL OR sellout_risk IN ('none', 'low', 'medium', 'high'));

-- ============================================================================
-- 4. INDEXES FOR PLANNING HORIZON QUERIES
-- ============================================================================

-- "What big events are coming up?" — flagship + major, future dates, active
CREATE INDEX IF NOT EXISTS idx_events_planning_horizon
  ON events (start_date, importance)
  WHERE importance IN ('flagship', 'major')
    AND is_active = true;

-- "What just went on sale?" — recent on_sale_date
CREATE INDEX IF NOT EXISTS idx_events_on_sale_date
  ON events (on_sale_date DESC)
  WHERE on_sale_date IS NOT NULL
    AND is_active = true;

-- "What early bird deadlines are coming up?"
CREATE INDEX IF NOT EXISTS idx_events_early_bird_deadline
  ON events (early_bird_deadline)
  WHERE early_bird_deadline IS NOT NULL
    AND is_active = true;

-- "What registration deadlines are closing soon?"
CREATE INDEX IF NOT EXISTS idx_events_registration_closes
  ON events (registration_closes)
  WHERE registration_closes IS NOT NULL
    AND is_active = true;

-- Ticket staleness: find events whose ticket_status may be outdated
CREATE INDEX IF NOT EXISTS idx_events_ticket_freshness
  ON events (ticket_status_checked_at)
  WHERE ticket_status IS NOT NULL
    AND is_active = true;

-- ============================================================================
-- 5. CONSTRAINT: registration window ordering
-- ============================================================================

ALTER TABLE events
  ADD CONSTRAINT events_registration_window_check CHECK (
    registration_opens IS NULL
    OR registration_closes IS NULL
    OR registration_opens <= registration_closes
  );
