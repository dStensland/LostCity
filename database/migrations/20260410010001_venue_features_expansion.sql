-- Exhibition System Expansion: venue_features additive columns
-- Adds source tracking, portal federation, admission details, tags, and metadata
-- to support museums, zoos, attractions, and theme parks alongside art galleries.

BEGIN;

-- Source tracking
ALTER TABLE venue_features ADD COLUMN IF NOT EXISTS source_id INTEGER
  REFERENCES sources(id) ON DELETE SET NULL;

-- Portal federation
ALTER TABLE venue_features ADD COLUMN IF NOT EXISTS portal_id UUID
  REFERENCES portals(id) ON DELETE SET NULL;

-- Admission details
ALTER TABLE venue_features ADD COLUMN IF NOT EXISTS admission_type TEXT;
ALTER TABLE venue_features ADD COLUMN IF NOT EXISTS admission_url TEXT;

-- Provenance
ALTER TABLE venue_features ADD COLUMN IF NOT EXISTS source_url TEXT;

-- Discovery
ALTER TABLE venue_features ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Flexible metadata (content_hash, last_verified_at)
ALTER TABLE venue_features ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Indexes for new FKs
CREATE INDEX IF NOT EXISTS idx_venue_features_source
  ON venue_features(source_id) WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_venue_features_portal
  ON venue_features(portal_id) WHERE portal_id IS NOT NULL;

-- updated_at auto-update trigger
-- The update_updated_at_column() function already exists (used by 15+ tables)
DROP TRIGGER IF EXISTS update_venue_features_updated_at ON venue_features;
CREATE TRIGGER update_venue_features_updated_at
  BEFORE UPDATE ON venue_features
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;
