-- Cleanup orphan festival_program series for Love Y'all Book Festival
--
-- Root cause: insert_event() in db.py was auto-creating a new festival_program
-- series per event via infer_program_title(), overwriting the series_id already
-- passed in by enrich_festival_program.py. This created ~64 orphan series, each
-- with exactly 1 event and a title matching the session name.
--
-- Fix: db.py now guards series_hint processing when series_id is already set.
-- This migration cleans up the existing orphans by reassigning their events to
-- the main festival series and deleting the orphan series records.

-- UP Migration
BEGIN;

-- Step 1: Identify the main festival series (created by ensure_festival_series)
-- It's the one whose title matches the festival name and has festival_id set.
-- We'll reassign all orphan events to this series.

-- Step 2: Reassign events from orphan series to the main festival series.
-- Orphan series are festival_program series linked to this festival that are NOT
-- the main series (i.e., they were auto-created per-session by insert_event).
UPDATE events
SET series_id = main.id
FROM (
  SELECT id FROM series
  WHERE festival_id = 'love-yall-book-fest'
    AND series_type = 'festival_program'
    AND title ILIKE '%love y%all%'
  LIMIT 1
) AS main
WHERE events.series_id IN (
  SELECT s.id FROM series s
  WHERE s.festival_id = 'love-yall-book-fest'
    AND s.series_type = 'festival_program'
    AND s.title NOT ILIKE '%love y%all%'
)
  -- Only reassign if main series exists (safety check)
  AND main.id IS NOT NULL;

-- Step 3: Delete the orphan series (now that no events reference them)
DELETE FROM series
WHERE festival_id = 'love-yall-book-fest'
  AND series_type = 'festival_program'
  AND title NOT ILIKE '%love y%all%';

COMMIT;

-- DOWN Migration (commented out - uncomment to rollback)
-- Note: Cannot fully restore orphan series since their UUIDs are lost.
-- The events remain correctly linked to the main festival series.
-- BEGIN;
--   -- No practical rollback — orphan series were junk data.
-- COMMIT;
