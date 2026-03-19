-- Migration: Fix stale registration_status for programs whose registration_closes date has passed
-- 136 programs show registration_status='open' with registration_closes in the past.
-- These are from Cobb County (1303), Gwinnett County (1304), Gwinnett Family (1435),
-- and City of Milton (1425) -- all county parks sources that don't auto-update status.
--
-- Root cause: The crawler captures registration_closes at crawl time but does not
-- re-check and update registration_status on subsequent crawls. Fix needed in the
-- county parks crawlers (rpc1_base.py, gwinnett_parks_rec.py) to compute
-- registration_status from registration_closes at write time.
--
-- This migration fixes the symptom; the crawler fix prevents recurrence.

DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE programs
  SET registration_status = 'closed',
      updated_at = NOW()
  WHERE registration_status = 'open'
    AND registration_closes IS NOT NULL
    AND registration_closes < CURRENT_DATE;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Closed % programs with past registration_closes dates', updated_count;
END $$;

-- Verification:
-- SELECT COUNT(*) FROM programs
-- WHERE registration_status = 'open'
--   AND registration_closes IS NOT NULL
--   AND registration_closes < CURRENT_DATE;
-- Expected: 0
