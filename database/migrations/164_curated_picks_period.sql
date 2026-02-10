-- Migration: Add period column to curated_picks for Today/Week/Month tabs
-- Allows editors to curate picks for different time ranges

-- Add period column (today = single day, week = 7-day range, month = 30-day range)
ALTER TABLE curated_picks
  ADD COLUMN IF NOT EXISTS period TEXT NOT NULL DEFAULT 'today'
  CHECK (period IN ('today', 'week', 'month'));

-- Drop old unique constraint and create new one that includes period
-- Old constraint: UNIQUE(pick_date, event_id)
ALTER TABLE curated_picks
  DROP CONSTRAINT IF EXISTS curated_picks_pick_date_event_id_key;

ALTER TABLE curated_picks
  ADD CONSTRAINT curated_picks_pick_date_period_event_id_key
  UNIQUE (pick_date, period, event_id);

COMMENT ON COLUMN curated_picks.period IS 'Time range for this pick: today (single day), week (pick_date = Monday of week), month (pick_date = 1st of month)';
