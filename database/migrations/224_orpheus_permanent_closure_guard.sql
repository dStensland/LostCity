-- Migration 224: Orpheus permanent closure guard
-- Keep Orpheus Brewing permanently inactive and out of Best Of.

BEGIN;

WITH closed_venues AS (
  SELECT id
  FROM venues
  WHERE slug = 'orpheus-brewing'
     OR lower(name) = 'orpheus brewing'
)
UPDATE venues
SET
  active = false,
  description = CASE
    WHEN description ILIKE '%Permanently closed. Do not reactivate via crawler.%' THEN description
    WHEN description IS NULL OR btrim(description) = '' THEN 'Permanently closed. Do not reactivate via crawler.'
    WHEN right(btrim(description), 1) IN ('.', '!', '?') THEN btrim(description) || ' Permanently closed. Do not reactivate via crawler.'
    ELSE btrim(description) || '. Permanently closed. Do not reactivate via crawler.'
  END
WHERE id IN (SELECT id FROM closed_venues);

UPDATE sources
SET is_active = false
WHERE slug = 'orpheus-brewing';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'best_of_nominations'
  ) THEN
    UPDATE best_of_nominations
    SET status = 'rejected'
    WHERE status = 'approved'
      AND venue_id IN (
        SELECT id
        FROM venues
        WHERE slug = 'orpheus-brewing'
           OR lower(name) = 'orpheus brewing'
      );
  END IF;
END $$;

COMMIT;
