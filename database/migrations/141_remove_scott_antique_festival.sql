-- Remove Scott Antique Markets from festivals table
-- Scott Antique Markets is a recurring antique market (monthly vendor market),
-- not a festival. It should be represented as a series or venue, not a festival.

-- UP Migration
BEGIN;

-- Unlink any series that reference this festival
UPDATE series
SET festival_id = NULL
WHERE festival_id = 'scott-antique-markets';

-- Delete the festival record
DELETE FROM festivals
WHERE slug = 'scott-antique-markets';

COMMIT;

-- DOWN Migration (commented out - uncomment to rollback)
-- BEGIN;
--
-- -- Restore the festival record (adjust values as needed based on original data)
-- INSERT INTO festivals (id, slug, name, created_at, updated_at)
-- VALUES (
--   'scott-antique-markets',
--   'scott-antique-markets',
--   'Scott Antique Markets',
--   NOW(),
--   NOW()
-- );
--
-- COMMIT;
