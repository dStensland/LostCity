-- Migration 526: Add partial index on library_pass->>'eligible' for fast lookup
-- Supports efficient queries for library-pass-eligible venues in the family portal.

CREATE INDEX IF NOT EXISTS idx_venues_library_pass_eligible
  ON venues ((library_pass->>'eligible'))
  WHERE library_pass IS NOT NULL;
