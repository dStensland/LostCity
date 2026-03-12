-- Migration: Flag known adult entertainment venues
--
-- Atlanta Eagle is a leather/kink bar. Its events feature explicit content
-- (gear enforcement rules, etc.) that should not appear in general discovery
-- feeds, especially for hotel/corporate portal demos.
--
-- The is_adult flag is already checked by applySearchFilters in search.ts
-- when exclude_adult is true. This migration sets the flag on known venues
-- and their events.

-- 1. Flag the venue
UPDATE venues SET is_adult = TRUE
WHERE LOWER(name) IN ('atlanta eagle')
  AND city = 'Atlanta';

-- 2. Backfill events at adult venues
UPDATE events SET is_adult = TRUE
WHERE venue_id IN (
  SELECT id FROM venues WHERE is_adult = TRUE
)
AND (is_adult = FALSE OR is_adult IS NULL);

-- 3. Create a trigger to auto-flag events at adult venues
CREATE OR REPLACE FUNCTION inherit_venue_is_adult() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.venue_id IS NOT NULL THEN
    SELECT v.is_adult INTO NEW.is_adult
    FROM venues v WHERE v.id = NEW.venue_id AND v.is_adult = TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inherit_venue_is_adult ON events;
CREATE TRIGGER trg_inherit_venue_is_adult
  BEFORE INSERT ON events
  FOR EACH ROW
  WHEN (NEW.is_adult IS NULL OR NEW.is_adult = FALSE)
  EXECUTE FUNCTION inherit_venue_is_adult();
