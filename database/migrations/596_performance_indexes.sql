-- ============================================================
-- Performance indexes identified in 2026-03-24 portal audit
-- ============================================================

-- Foreign key indexes (missing — queried in feed pipeline)
CREATE INDEX IF NOT EXISTS idx_events_series_id
  ON events (series_id) WHERE series_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_festival_id
  ON events (festival_id) WHERE festival_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_organization_id
  ON events (organization_id) WHERE organization_id IS NOT NULL;

-- Destinations query: venue_occasions filtered by occasion + confidence
CREATE INDEX IF NOT EXISTS idx_venue_occasions_occasion_confidence
  ON venue_occasions (occasion, confidence DESC);

-- Phase B enrichment: editorial_mentions looked up by venue_id
-- Note: idx_editorial_mentions_venue_id already exists as a partial index
-- (WHERE is_active = true) from an earlier migration — IF NOT EXISTS skips this.
CREATE INDEX IF NOT EXISTS idx_editorial_mentions_venue_id
  ON editorial_mentions (venue_id);

-- ============================================================
-- updated_at on core tables (enables monitoring, incremental enrichment)
-- ============================================================

ALTER TABLE venues ADD COLUMN IF NOT EXISTS updated_at
  TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at
  TIMESTAMPTZ NOT NULL DEFAULT now();

-- Shared trigger function (already exists; CREATE OR REPLACE is safe)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language plpgsql;

-- venues trigger (new — no prior trigger existed on this table)
DROP TRIGGER IF EXISTS set_venues_updated_at ON venues;
CREATE TRIGGER set_venues_updated_at
  BEFORE UPDATE ON venues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- events trigger: rename update_events_updated_at → set_events_updated_at
-- for naming consistency. Drop the old name first, then create the new one.
DROP TRIGGER IF EXISTS update_events_updated_at ON events;
DROP TRIGGER IF EXISTS set_events_updated_at ON events;
CREATE TRIGGER set_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
