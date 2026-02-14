-- Migration: Add 'exhibition' to series_type CHECK constraint
-- Exhibitions (museum shows, gallery installations, immersive experiences)
-- are distinct from recurring_show — they have date ranges, not recurrence patterns.

-- Drop and recreate the CHECK constraint to include 'exhibition'
ALTER TABLE series DROP CONSTRAINT IF EXISTS series_series_type_check;
ALTER TABLE series ADD CONSTRAINT series_series_type_check
  CHECK (series_type IN ('film', 'recurring_show', 'class_series', 'festival_program', 'tour', 'exhibition', 'other'));
