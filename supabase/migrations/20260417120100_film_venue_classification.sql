-- Migration: Film Venue Classification
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

-- Editorial programmers — set programming_style + founding_year
UPDATE places SET
  programming_style = 'repertory',
  venue_formats = '{70mm, 35mm}',
  founding_year = 1939
WHERE slug = 'plaza-theatre';

UPDATE places SET
  programming_style = 'repertory',
  venue_formats = '{70mm, 35mm}',
  founding_year = 1968
WHERE slug = 'tara-theatre';

UPDATE places SET
  programming_style = 'drive_in',
  venue_formats = '{}',
  founding_year = 1949
WHERE slug = 'starlight-six-drive-in';

UPDATE places SET
  programming_style = 'arthouse',
  venue_formats = '{atmos}'
WHERE slug = 'landmark-midtown-art-cinema';

UPDATE places SET
  programming_style = 'indie',
  venue_formats = '{atmos}'
WHERE slug = 'springs-cinema-and-taphouse';

-- Premium format venues — set venue_formats only
-- Some of these rows don't exist yet (Plan 2 crawler work adds them).
-- UPDATE is a no-op for missing slugs; the DO $$ block below logs which are missing.

UPDATE places SET venue_formats = '{true_imax, 70mm}'
WHERE slug = 'amc-mall-of-georgia-20';

UPDATE places SET venue_formats = '{imax, 4dx, rpx, screenx}'
WHERE slug = 'regal-atlantic-station';

UPDATE places SET venue_formats = '{dolby_cinema}'
WHERE slug = 'amc-north-point-mall-12';

UPDATE places SET venue_formats = '{dolby_cinema}'
WHERE slug = 'amc-avenue-forsyth-12';

UPDATE places SET venue_formats = '{dolby_cinema, imax}'
WHERE slug = 'amc-southlake-pavilion-24';

UPDATE places SET venue_formats = '{imax}'
WHERE slug = 'amc-phipps-plaza-14';

UPDATE places SET venue_formats = '{imax}'
WHERE slug = 'amc-barrett-commons-24';

UPDATE places SET venue_formats = '{imax}'
WHERE slug = 'amc-colonial-18';

UPDATE places SET venue_formats = '{imax, rpx}'
WHERE slug = 'regal-avalon';

UPDATE places SET venue_formats = '{atmos}'
WHERE slug = 'amc-parkway-pointe-15';

UPDATE places SET venue_formats = '{atmos}'
WHERE slug = 'amc-madison-yards-8';

-- Log which venues were not found so Plan 2's crawler work knows to populate them.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT slug FROM (VALUES
      ('plaza-theatre'), ('tara-theatre'), ('starlight-six-drive-in'),
      ('landmark-midtown-art-cinema'), ('springs-cinema-and-taphouse'),
      ('amc-mall-of-georgia-20'), ('regal-atlantic-station'),
      ('amc-north-point-mall-12'), ('amc-avenue-forsyth-12'),
      ('amc-southlake-pavilion-24'), ('amc-phipps-plaza-14'),
      ('amc-barrett-commons-24'), ('amc-colonial-18'), ('regal-avalon'),
      ('amc-parkway-pointe-15'), ('amc-madison-yards-8')
    ) AS t(slug)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM places WHERE slug = r.slug) THEN
      RAISE NOTICE 'Film venue seed: place not found, skipped: %', r.slug;
    END IF;
  END LOOP;
END $$;
