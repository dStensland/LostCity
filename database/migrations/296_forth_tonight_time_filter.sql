-- ============================================
-- MIGRATION 296: FORTH Tonight Time Filter
-- ============================================
-- The FORTH portal's "this-evening" section has no show_after_time set,
-- so brunch events at 10am appear in "Tonight" at 6pm.
--
-- Fix: set show_after_time = '14:00' so the section is only visible
-- from 2pm onward, matching actual evening/afternoon use.
--
-- Idempotent: only updates if the section exists; subsequent runs are no-ops.

DO $$
DECLARE
  forth_id   UUID;
  rows_updated INT;
BEGIN
  SELECT id INTO forth_id FROM portals WHERE slug = 'forth';

  IF forth_id IS NULL THEN
    RAISE NOTICE 'FORTH portal not found. Skipping.';
    RETURN;
  END IF;

  UPDATE portal_sections
  SET    show_after_time = '14:00'
  WHERE  portal_id = forth_id
    AND  slug      = 'this-evening';

  GET DIAGNOSTICS rows_updated = ROW_COUNT;

  IF rows_updated = 0 THEN
    RAISE NOTICE 'FORTH this-evening section not found. No update applied.';
  ELSE
    RAISE NOTICE 'Set show_after_time = 14:00 on FORTH this-evening section.';
  END IF;

END $$;
