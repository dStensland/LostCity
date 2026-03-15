-- Add metadata JSONB to programs so crawler dedupe and provenance can round-trip.
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS metadata JSONB;

UPDATE programs
SET metadata = '{}'::jsonb
WHERE metadata IS NULL;

ALTER TABLE programs
  ALTER COLUMN metadata SET DEFAULT '{}'::jsonb;

ALTER TABLE programs
  ALTER COLUMN metadata SET NOT NULL;

COMMENT ON COLUMN programs.metadata IS
  'Crawler metadata and structured provenance for programs, including content_hash dedupe keys.';

CREATE INDEX IF NOT EXISTS idx_programs_content_hash
  ON programs ((metadata->>'content_hash'))
  WHERE metadata ? 'content_hash';
