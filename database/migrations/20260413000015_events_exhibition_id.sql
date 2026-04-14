-- Migration: Events Exhibition Id
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

-- Add exhibition_id FK to events table.
-- Lets "opening night" or "artist talk" events link to their parent exhibition.
-- Many-to-one: multiple events can reference the same exhibition.

ALTER TABLE events ADD COLUMN IF NOT EXISTS exhibition_id UUID REFERENCES exhibitions(id);

CREATE INDEX IF NOT EXISTS idx_events_exhibition_id
  ON events(exhibition_id)
  WHERE exhibition_id IS NOT NULL;

COMMENT ON COLUMN events.exhibition_id IS
  'Links events to their parent exhibition (opening nights, artist talks, etc.)';
