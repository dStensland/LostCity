-- Add portal_id to screening_runs for portal scoping.
--
-- Rationale: places has NO portal_id (city-level scoping). Film runs inherently
-- belong to one portal (a run at Plaza Theatre = Atlanta). Events-based scoping
-- would drop seeded data where event_id is null. Putting portal_id directly on
-- screening_runs matches the pattern used by events, exhibitions, programs.

BEGIN;

-- Add nullable for staged backfill
ALTER TABLE screening_runs
  ADD COLUMN IF NOT EXISTS portal_id UUID REFERENCES portals(id) ON DELETE CASCADE;

-- Backfill: all existing seeded data is Atlanta
UPDATE screening_runs
  SET portal_id = (SELECT id FROM portals WHERE slug = 'atlanta')
  WHERE portal_id IS NULL;

-- Enforce going forward
ALTER TABLE screening_runs
  ALTER COLUMN portal_id SET NOT NULL;

-- Query path: loaders filter screening_times → screening_runs by portal_id
CREATE INDEX IF NOT EXISTS idx_screening_runs_portal_id
  ON screening_runs(portal_id);

-- Composite index for date-range filtered queries by portal
CREATE INDEX IF NOT EXISTS idx_screening_runs_portal_dates
  ON screening_runs(portal_id, start_date, end_date);

COMMIT;
