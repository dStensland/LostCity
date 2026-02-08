-- Add nullable FK from event_artists to canonical artists table.
-- Allows incremental linking: name-only rows can exist before artist resolution.
ALTER TABLE event_artists
  ADD COLUMN IF NOT EXISTS artist_id UUID REFERENCES artists(id) ON DELETE SET NULL;

-- Also add is_headliner if missing (used by lineup parsing)
ALTER TABLE event_artists
  ADD COLUMN IF NOT EXISTS is_headliner BOOLEAN;

CREATE INDEX IF NOT EXISTS idx_event_artists_artist_id
  ON event_artists(artist_id) WHERE artist_id IS NOT NULL;
