-- Track which source last wrote hours and when, enabling confidence-based
-- overwrites and freshness-based crawl skipping.

ALTER TABLE venues ADD COLUMN IF NOT EXISTS hours_source TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS hours_updated_at TIMESTAMPTZ;

-- Partial index: only venues that have hours need freshness lookups
CREATE INDEX IF NOT EXISTS idx_venues_hours_updated_at
  ON venues (hours_updated_at) WHERE hours IS NOT NULL;
