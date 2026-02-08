-- Migration 135: Festival categorization — structured taxonomy
--
-- Adds three classification dimensions:
--   1. primary_type  — what IS this thing (mutually exclusive)
--   2. experience_tags — what will you DO there (multi-select, replaces categories)
--   3. audience/size/setting/price metadata
--
-- Drops the redundant 'festival' entries from existing categories array.

-- Dimension 1: Primary type (one per festival)
ALTER TABLE festivals
  ADD COLUMN IF NOT EXISTS primary_type TEXT;

COMMENT ON COLUMN festivals.primary_type IS
  'Mutually exclusive classification: music_festival, food_festival, arts_festival, film_festival, cultural_festival, pop_culture_con, hobby_expo, tech_conference, athletic_event, holiday_spectacle, community_festival, fair, market';

-- Dimension 2: Experience tags (replaces categories for new taxonomy)
ALTER TABLE festivals
  ADD COLUMN IF NOT EXISTS experience_tags TEXT[];

COMMENT ON COLUMN festivals.experience_tags IS
  'What you will experience: live_music, food_tasting, art_exhibits, film_screenings, cosplay, gaming, outdoor, racing, shopping, workshops, speakers, kids_activities, carnival_rides, cultural_heritage, nightlife';

-- Dimension 3: Audience & format metadata
ALTER TABLE festivals
  ADD COLUMN IF NOT EXISTS audience TEXT;

COMMENT ON COLUMN festivals.audience IS
  'Target audience: all_ages, family, adults_only, 21_plus, industry';

ALTER TABLE festivals
  ADD COLUMN IF NOT EXISTS size_tier TEXT;

COMMENT ON COLUMN festivals.size_tier IS
  'Scale: intimate (<500), local (500-5k), major (5k-50k), mega (50k+)';

ALTER TABLE festivals
  ADD COLUMN IF NOT EXISTS indoor_outdoor TEXT;

COMMENT ON COLUMN festivals.indoor_outdoor IS
  'Setting: indoor, outdoor, both';

ALTER TABLE festivals
  ADD COLUMN IF NOT EXISTS price_tier TEXT;

COMMENT ON COLUMN festivals.price_tier IS
  'Cost: free, budget (<$25), moderate ($25-100), premium ($100+)';

-- Index for filtering
CREATE INDEX IF NOT EXISTS idx_festivals_primary_type ON festivals(primary_type);
CREATE INDEX IF NOT EXISTS idx_festivals_audience ON festivals(audience);
CREATE INDEX IF NOT EXISTS idx_festivals_size_tier ON festivals(size_tier);
CREATE INDEX IF NOT EXISTS idx_festivals_price_tier ON festivals(price_tier);

-- Clean up: strip redundant 'festival' from existing categories array
UPDATE festivals
SET categories = array_remove(categories, 'festival')
WHERE categories @> ARRAY['festival'];
