-- Migration: Archive programs with exclusion language in their names
-- These are troop/member-only Girl Scout badge classes that leaked into the
-- public-facing family portal. source_id=1425 (City of Milton Parks & Recreation)
-- crawls multiple program types and does not filter private badge classes.
--
-- Root cause: The Milton Parks crawler (city_of_milton.py or similar) ingests
-- all programs from the ActiveNet catalog without filtering for "Closed to Public"
-- suffix. The crawler should skip any program whose name contains
-- "(Closed to Public)", "Staff Only", or "Members Only" pattern.
--
-- Fix needed in crawler: add name filter at extraction time.
-- Note: programs.status CHECK allows 'active', 'draft', 'archived' only.

DO $$
DECLARE
  archived_count INTEGER;
BEGIN
  UPDATE programs
  SET status = 'archived',
      updated_at = NOW()
  WHERE status = 'active'
    AND (
      name ILIKE '%(Closed to Public)%'
      OR name ILIKE '%Staff Only%'
      OR name ILIKE '%- Staff%'
      OR name ILIKE '%Internal Only%'
      OR name ILIKE '%Members Only%'
      OR name ILIKE '%Not Open to Public%'
    );

  GET DIAGNOSTICS archived_count = ROW_COUNT;
  RAISE NOTICE 'Archived % programs with exclusion language in names', archived_count;
END $$;

-- Verification:
-- SELECT name, source_id FROM programs
-- WHERE status = 'active'
--   AND (name ILIKE '%(Closed to Public)%' OR name ILIKE '%Staff Only%');
-- Expected: 0 rows
