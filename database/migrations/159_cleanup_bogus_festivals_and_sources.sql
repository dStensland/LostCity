-- Migration 159: Clean up bogus festival sources and their junk data
--
-- Three sources were incorrectly created as festivals:
--   1. laughing-skull-comedy-fest (source 709) — duplicate of the real venue crawler
--      (laughing-skull, source 22). Produced 33 duplicate events + 36 junk series.
--   2. decatur-arts-festival (source 132) — parsed section headings and date strings
--      from decaturartsfestival.com as event titles. Festival is postponed.
--   3. decatur-wine-festival (source 588) — festival doesn't exist. Already inactive.
--
-- This migration:
--   A. Unlinks series from these bogus festivals, then deletes the series
--   B. Deletes junk events from sources 709 and 132
--   C. Deactivates sources 709 and 132 (588 is already inactive)
--   D. Removes the bogus festival records from the festivals table

BEGIN;

-- ============================================================
-- A. Unlink and delete junk series tied to these festivals
-- ============================================================

-- Laughing Skull "comedy fest" — 36 series that are just individual show times
DELETE FROM series
WHERE festival_id = 'laughing-skull-comedy-fest';

-- Decatur Arts Festival — 3 series with garbage titles
DELETE FROM series
WHERE festival_id = 'decatur-arts-festival';

-- ============================================================
-- B. Delete junk events from these sources
-- ============================================================

-- Source 709 (laughing-skull-comedy-fest): duplicate venue shows
DELETE FROM events
WHERE source_id = 709;

-- Source 132 (decatur-arts-festival): section headings as event titles
DELETE FROM events
WHERE source_id = 132;

-- ============================================================
-- C. Deactivate the bogus sources
-- ============================================================

UPDATE sources SET is_active = false
WHERE id IN (132, 588, 709);

-- ============================================================
-- D. Remove bogus festival records
-- ============================================================

-- Laughing Skull Comedy Fest is not a festival — it's a comedy venue
DELETE FROM festivals
WHERE slug = 'laughing-skull-comedy-fest';

-- Decatur Wine Festival doesn't exist
DELETE FROM festivals
WHERE slug = 'decatur-wine-festival';

-- Decatur Arts Festival is postponed; remove until real dates are announced
DELETE FROM festivals
WHERE slug = 'decatur-arts-festival';

COMMIT;

-- DOWN Migration (commented out - uncomment to rollback)
-- BEGIN;
--
-- -- Restore festival records
-- INSERT INTO festivals (slug, name) VALUES
--   ('laughing-skull-comedy-fest', 'Laughing Skull Comedy Festival'),
--   ('decatur-wine-festival', 'Decatur Wine Festival'),
--   ('decatur-arts-festival', 'Decatur Arts Festival');
--
-- -- Re-activate sources
-- UPDATE sources SET is_active = true WHERE id IN (132, 709);
-- -- Note: source 588 was already inactive before this migration
--
-- -- Events and series cannot be restored from migration alone
-- -- (would need to re-crawl)
--
-- COMMIT;
