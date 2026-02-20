-- Migration 238: Festivals as Events
-- Adds festival_id and is_tentpole columns to events table.
-- Backfills festival_id from the series chain.
-- Sets is_tentpole on known tier-1 festivals.

-- 1. Add festival_id and is_tentpole to events table
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS festival_id TEXT REFERENCES festivals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_tentpole BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_events_festival_id ON events(festival_id);
CREATE INDEX IF NOT EXISTS idx_events_tentpole ON events(is_tentpole) WHERE is_tentpole = true;

-- 2. Backfill festival_id on events from series chain
UPDATE events e
SET festival_id = s.festival_id
FROM series s
WHERE e.series_id = s.id
  AND s.festival_id IS NOT NULL
  AND e.festival_id IS NULL;

-- 3. Set is_tentpole on parent events (no series_id) for tier-1 festivals.
-- Series child events are sessions, not the parent festival event itself.
UPDATE events SET is_tentpole = true
WHERE festival_id IN (
  'dragon-con',
  'atlanta-pride',
  'shaky-knees',
  'music-midtown',
  'atlanta-jazz-festival',
  'atlanta-film-festival',
  'peachtree-road-race',
  'atlanta-dogwood-festival'
)
AND series_id IS NULL;
