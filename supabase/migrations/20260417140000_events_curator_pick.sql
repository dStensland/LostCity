ALTER TABLE events
  ADD COLUMN IF NOT EXISTS is_curator_pick boolean NOT NULL DEFAULT false;

-- Partial index — curator picks are a tiny fraction of events.
CREATE INDEX IF NOT EXISTS idx_events_curator_pick
  ON events (start_date, portal_id)
  WHERE is_curator_pick = true;

COMMENT ON COLUMN events.is_curator_pick IS
  'Weekly editorial flag. True when CM has selected this event as a curator pick for the current week. Primary input to getCardTier hero tier for music surfaces.';
