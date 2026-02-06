-- Migration: Festival hierarchy (festivals -> programs -> sessions)
-- Adds a festival reference on series so programs can roll up to a festival/conference.

ALTER TABLE series
  ADD COLUMN IF NOT EXISTS festival_id TEXT REFERENCES festivals(id);

CREATE INDEX IF NOT EXISTS idx_series_festival_id ON series(festival_id);
