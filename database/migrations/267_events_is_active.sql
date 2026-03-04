-- Add row-level active flag for events so feeds can hide stale rows without hard deletes.
ALTER TABLE events
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

UPDATE events
SET is_active = true
WHERE is_active IS NULL;

ALTER TABLE events
ALTER COLUMN is_active SET DEFAULT true;

ALTER TABLE events
ALTER COLUMN is_active SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_is_active ON events(is_active);
CREATE INDEX IF NOT EXISTS idx_events_active_start_date ON events(start_date) WHERE is_active = true;
