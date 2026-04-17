-- Add screening_run_id to events table for screening-primary architecture.
-- Enables direct event→run lookup without content_hash matching.

ALTER TABLE events ADD COLUMN IF NOT EXISTS screening_run_id UUID
  REFERENCES screening_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_screening_run_id
  ON events (screening_run_id) WHERE screening_run_id IS NOT NULL;
