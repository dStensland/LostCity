-- Extend venue_destination_details into a reusable destination-intelligence contract.
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'venue_destination_details'
      AND column_name = 'commitment_level'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'venue_destination_details'
      AND column_name = 'commitment_tier'
  ) THEN
    EXECUTE 'ALTER TABLE venue_destination_details RENAME COLUMN commitment_level TO commitment_tier';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'venue_destination_details'
      AND column_name = 'difficulty'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'venue_destination_details'
      AND column_name = 'difficulty_level'
  ) THEN
    EXECUTE 'ALTER TABLE venue_destination_details RENAME COLUMN difficulty TO difficulty_level';
  END IF;
END $$;

ALTER TABLE venue_destination_details
  ADD COLUMN IF NOT EXISTS destination_type TEXT,
  ADD COLUMN IF NOT EXISTS primary_activity TEXT,
  ADD COLUMN IF NOT EXISTS drive_time_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS elevation_gain_ft INTEGER,
  ADD COLUMN IF NOT EXISTS surface_type TEXT,
  ADD COLUMN IF NOT EXISTS best_seasons TEXT[],
  ADD COLUMN IF NOT EXISTS weather_fit_tags TEXT[],
  ADD COLUMN IF NOT EXISTS practical_notes TEXT,
  ADD COLUMN IF NOT EXISTS family_suitability TEXT,
  ADD COLUMN IF NOT EXISTS reservation_required BOOLEAN,
  ADD COLUMN IF NOT EXISTS permit_required BOOLEAN,
  ADD COLUMN IF NOT EXISTS fee_note TEXT,
  ADD COLUMN IF NOT EXISTS seasonal_hazards TEXT[],
  ADD COLUMN IF NOT EXISTS source_url TEXT;

ALTER TABLE venue_destination_details
  DROP CONSTRAINT IF EXISTS venue_destination_details_commitment_level_check,
  DROP CONSTRAINT IF EXISTS venue_destination_details_commitment_tier_check,
  DROP CONSTRAINT IF EXISTS venue_destination_details_difficulty_check,
  DROP CONSTRAINT IF EXISTS venue_destination_details_difficulty_level_check,
  DROP CONSTRAINT IF EXISTS venue_destination_details_family_suitability_check,
  DROP CONSTRAINT IF EXISTS venue_destination_details_drive_time_minutes_check,
  DROP CONSTRAINT IF EXISTS venue_destination_details_elevation_gain_ft_check;

ALTER TABLE venue_destination_details
  ADD CONSTRAINT venue_destination_details_commitment_tier_check
    CHECK (commitment_tier IS NULL OR commitment_tier IN ('hour','halfday','fullday','weekend')),
  ADD CONSTRAINT venue_destination_details_difficulty_level_check
    CHECK (difficulty_level IS NULL OR difficulty_level IN ('easy','moderate','hard','expert')),
  ADD CONSTRAINT venue_destination_details_family_suitability_check
    CHECK (family_suitability IS NULL OR family_suitability IN ('yes','no','caution')),
  ADD CONSTRAINT venue_destination_details_drive_time_minutes_check
    CHECK (drive_time_minutes IS NULL OR drive_time_minutes BETWEEN 0 AND 1440),
  ADD CONSTRAINT venue_destination_details_elevation_gain_ft_check
    CHECK (elevation_gain_ft IS NULL OR elevation_gain_ft >= 0);

COMMENT ON COLUMN venue_destination_details.destination_type IS
  'Yonder-facing destination identity such as waterfall, state_park, urban_trail, campground, or viewpoint.';
COMMENT ON COLUMN venue_destination_details.commitment_tier IS
  'Consumer-facing commitment contract: hour, halfday, fullday, weekend.';
COMMENT ON COLUMN venue_destination_details.primary_activity IS
  'Primary consumer activity such as hiking, climbing, paddling, camping, or sightseeing.';
COMMENT ON COLUMN venue_destination_details.weather_fit_tags IS
  'Recommendation tags such as after-rain, shaded, summer-friendly, or best-at-sunrise.';
COMMENT ON COLUMN venue_destination_details.practical_notes IS
  'High-signal planning caveats, reservation friction, parking notes, or operational guidance.';

CREATE INDEX IF NOT EXISTS idx_venue_destination_details_type
  ON venue_destination_details(destination_type)
  WHERE destination_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_venue_destination_details_commitment
  ON venue_destination_details(commitment_tier)
  WHERE commitment_tier IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_venue_destination_details_best_seasons
  ON venue_destination_details USING GIN(best_seasons);

CREATE INDEX IF NOT EXISTS idx_venue_destination_details_weather_fit_tags
  ON venue_destination_details USING GIN(weather_fit_tags);
