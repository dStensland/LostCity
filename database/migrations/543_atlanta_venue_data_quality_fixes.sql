-- Migration: Atlanta Venue Data Quality Fixes
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

-- 1. Dynamic El Dorado: bar → comedy_club (comedy venue on Edgewood Ave)
UPDATE venues
SET venue_type = 'comedy_club', spot_type = 'comedy_club'
WHERE slug = 'dynamic-el-dorado';

-- 2. El Bar: reactivate (if inactive)
UPDATE venues
SET active = true
WHERE slug = 'el-bar' AND active = false;

UPDATE sources
SET is_active = true
WHERE slug = 'el-bar' AND is_active = false;

-- 3. Wild Leap Brewing: fix neighborhood from Downtown to Castleberry Hill
UPDATE venues
SET neighborhood = 'Castleberry Hill'
WHERE slug = 'wild-leap-brewing'
  AND neighborhood = 'Downtown';

-- Also try alternate slug patterns
UPDATE venues
SET neighborhood = 'Castleberry Hill'
WHERE name ILIKE '%wild leap%'
  AND city = 'Atlanta'
  AND neighborhood = 'Downtown';

-- 4. Bowlero venues: fix venue_type to recreation
UPDATE venues
SET venue_type = 'recreation', spot_type = 'recreation'
WHERE name ILIKE '%bowlero%'
  AND venue_type IN ('fitness_center', 'entertainment');

-- 5. Atlantucky Brewing: merge duplicates to single canonical record
-- Keep the lowest-ID venue as canonical, reassign events, deactivate extras
DO $$
DECLARE
  canonical_id INT;
  dupe_id INT;
BEGIN
  -- Find canonical (lowest ID)
  SELECT id INTO canonical_id
  FROM venues
  WHERE slug ILIKE '%atlantucky%' OR name ILIKE '%Atlantucky%'
  ORDER BY id ASC
  LIMIT 1;

  IF canonical_id IS NULL THEN
    RAISE NOTICE 'No Atlantucky venue found, skipping merge';
    RETURN;
  END IF;

  -- Reassign events from all Atlantucky dupes to canonical
  FOR dupe_id IN
    SELECT id FROM venues
    WHERE (slug ILIKE '%atlantucky%' OR name ILIKE '%Atlantucky%')
      AND id != canonical_id
  LOOP
    UPDATE events SET venue_id = canonical_id WHERE venue_id = dupe_id;
    UPDATE venue_specials SET venue_id = canonical_id WHERE venue_id = dupe_id;
    UPDATE editorial_mentions SET venue_id = canonical_id WHERE venue_id = dupe_id;
    UPDATE venues SET active = false WHERE id = dupe_id;
    RAISE NOTICE 'Merged Atlantucky venue % into %', dupe_id, canonical_id;
  END LOOP;
END $$;

-- 6. Iberian Pig: merge duplicates to single canonical record
DO $$
DECLARE
  canonical_id INT;
  dupe_id INT;
BEGIN
  SELECT id INTO canonical_id
  FROM venues
  WHERE slug ILIKE '%iberian-pig%' OR name ILIKE '%Iberian Pig%'
  ORDER BY id ASC
  LIMIT 1;

  IF canonical_id IS NULL THEN
    RAISE NOTICE 'No Iberian Pig venue found, skipping merge';
    RETURN;
  END IF;

  FOR dupe_id IN
    SELECT id FROM venues
    WHERE (slug ILIKE '%iberian-pig%' OR name ILIKE '%Iberian Pig%')
      AND id != canonical_id
  LOOP
    UPDATE events SET venue_id = canonical_id WHERE venue_id = dupe_id;
    UPDATE venue_specials SET venue_id = canonical_id WHERE venue_id = dupe_id;
    UPDATE editorial_mentions SET venue_id = canonical_id WHERE venue_id = dupe_id;
    UPDATE venues SET active = false WHERE id = dupe_id;
    RAISE NOTICE 'Merged Iberian Pig venue % into %', dupe_id, canonical_id;
  END LOOP;
END $$;
