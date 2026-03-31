-- Migration: Fix adult-event trigger after events venue_id -> place_id rename
--
-- The places final rename moved events.venue_id to events.place_id, but the
-- inherit_venue_is_adult() trigger function still referenced NEW.venue_id.
-- That breaks inserts with: record "new" has no field "venue_id".

-- 1. Refresh adult flags on existing events using the renamed place_id column.
UPDATE events
SET is_adult = TRUE
WHERE place_id IN (
  SELECT id FROM places WHERE is_adult = TRUE
)
AND (is_adult = FALSE OR is_adult IS NULL);

-- 2. Replace the trigger function with the correct column/table names.
CREATE OR REPLACE FUNCTION inherit_venue_is_adult() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.place_id IS NOT NULL THEN
    SELECT p.is_adult INTO NEW.is_adult
    FROM places p
    WHERE p.id = NEW.place_id AND p.is_adult = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
