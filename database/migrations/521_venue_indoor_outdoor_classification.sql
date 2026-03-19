-- Migration: venue_indoor_outdoor_classification
-- Adds indoor_outdoor enum column to venues and backfills from venue_type.
--
-- Values:
--   'indoor'  -- climate-controlled, weather-independent
--   'outdoor' -- open air, weather-dependent
--   'both'    -- significant indoor AND outdoor spaces (zoos, rec centers, etc.)
--   NULL      -- unknown / not yet classified
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

-- UP

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'venue_environment'
  ) THEN
    CREATE TYPE venue_environment AS ENUM ('indoor', 'outdoor', 'both');
  END IF;
END $$;

ALTER TABLE venues
  ADD COLUMN IF NOT EXISTS indoor_outdoor venue_environment;

-- Backfill from venue_type.
-- Mapping reflects "where does most of the activity happen?"
UPDATE venues
SET indoor_outdoor = CASE
  -- Clearly indoor
  WHEN venue_type IN (
    'museum', 'gallery', 'theater', 'cinema', 'library', 'bowling',
    'arcade', 'indoor_play', 'trampoline_park', 'escape_room',
    'shopping', 'bar', 'restaurant', 'coffee', 'studio', 'gym',
    'clinic', 'office', 'school', 'university', 'coworking',
    'hotel', 'retail', 'ice_rink'
  ) THEN 'indoor'::venue_environment

  -- Clearly outdoor
  WHEN venue_type IN (
    'park', 'garden', 'farm', 'trail', 'playground', 'pool',
    'nature_preserve', 'amphitheater', 'sports_field', 'beach',
    'campground', 'golf_course', 'skate_park', 'boat_launch',
    'fishing_spot', 'waterfall'
  ) THEN 'outdoor'::venue_environment

  -- Meaningful indoor + outdoor spaces
  WHEN venue_type IN (
    'zoo', 'aquarium', 'theme_park', 'recreation_center',
    'community_center', 'brewery', 'winery', 'distillery',
    'botanical_garden', 'historic_site', 'fairground',
    'sports_complex', 'performing_arts_center'
  ) THEN 'both'::venue_environment

  ELSE NULL
END
WHERE indoor_outdoor IS NULL;

-- Index for filtering queries
CREATE INDEX IF NOT EXISTS venues_indoor_outdoor_idx ON venues (indoor_outdoor)
  WHERE indoor_outdoor IS NOT NULL;

-- DOWN (commented out for safety)
-- ALTER TABLE venues DROP COLUMN IF EXISTS indoor_outdoor;
-- DROP TYPE IF EXISTS venue_environment;
