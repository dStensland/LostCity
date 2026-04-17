-- Migration: festival cleanup — remove Ren Fest row.
-- Ren Fest is a seasonal attraction, not a festival. Data now lives in
-- exhibitions (type='seasonal') linked to the Ren Fest place.
-- Keep this file mirrored in database/migrations and supabase/migrations.

BEGIN;

-- 1. NULL the series FKs first (series.festival_id has no ON DELETE behavior,
--    would FK-violate on hard-delete).
UPDATE series
  SET festival_id = NULL
  WHERE festival_id IN (
    SELECT id FROM festivals WHERE slug IN (
      'georgia-renaissance-festival',
      'ga-renaissance-festival',
      'ga-renaissance-festival-grounds'
    )
  );

-- 2. events.festival_id is ON DELETE SET NULL — safe, handled automatically.

-- 3. Delete the festival row(s). Uses slug IN to catch any duplicates from
--    the annual_tentpoles.py emitter.
DELETE FROM festivals
  WHERE slug IN (
    'georgia-renaissance-festival',
    'ga-renaissance-festival',
    'ga-renaissance-festival-grounds'
  );

COMMIT;
