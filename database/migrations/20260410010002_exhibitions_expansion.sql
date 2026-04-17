-- Exhibition System Expansion: expanded types + venue feature FK
-- Adds seasonal, special-exhibit, attraction types for non-art venues.
-- Links exhibitions to venue_features via related_feature_id.

BEGIN;

-- 1. Add related_feature_id FK (BIGINT to match venue_features.id identity column)
ALTER TABLE exhibitions ADD COLUMN IF NOT EXISTS related_feature_id BIGINT
  REFERENCES venue_features(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_exhibitions_related_feature
  ON exhibitions(related_feature_id)
  WHERE related_feature_id IS NOT NULL;

-- 2. Expand exhibition_type CHECK constraint
--    Unnamed inline CHECK → auto-named exhibitions_exhibition_type_check
ALTER TABLE exhibitions DROP CONSTRAINT IF EXISTS exhibitions_exhibition_type_check;
ALTER TABLE exhibitions ADD CONSTRAINT exhibitions_exhibition_type_check
  CHECK (exhibition_type IN (
    'solo', 'group', 'installation', 'retrospective', 'popup', 'permanent',
    'seasonal', 'special-exhibit', 'attraction'
  ));

-- 3. Expand admission_type CHECK constraint
--    Unnamed inline CHECK → auto-named exhibitions_admission_type_check
ALTER TABLE exhibitions DROP CONSTRAINT IF EXISTS exhibitions_admission_type_check;
ALTER TABLE exhibitions ADD CONSTRAINT exhibitions_admission_type_check
  CHECK (admission_type IN (
    'free', 'ticketed', 'donation', 'suggested', 'included'
  ));

COMMIT;
