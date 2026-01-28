-- Migration: Link sources to their event producers
-- This allows querying events via source_id -> sources.producer_id relationship
-- which is more reliable than relying on events.producer_id being populated

-- Ensure sources table has producer_id column
ALTER TABLE sources ADD COLUMN IF NOT EXISTS producer_id TEXT REFERENCES event_producers(id);

-- Create index for lookups if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_sources_producer ON sources(producer_id);

-- Link sources to their producers
UPDATE sources SET producer_id = 'atlanta-ballet' WHERE slug = 'atlanta-ballet' AND producer_id IS NULL;
UPDATE sources SET producer_id = 'atlanta-opera' WHERE slug = 'atlanta-opera' AND producer_id IS NULL;
UPDATE sources SET producer_id = 'atlanta-pride' WHERE slug = 'atlanta-pride' AND producer_id IS NULL;
UPDATE sources SET producer_id = 'atlanta-beltline-inc' WHERE slug = 'beltline' AND producer_id IS NULL;
UPDATE sources SET producer_id = 'atlanta-film-society' WHERE slug = 'atlanta-film-society' AND producer_id IS NULL;
UPDATE sources SET producer_id = 'out-on-film' WHERE slug = 'out-on-film' AND producer_id IS NULL;
UPDATE sources SET producer_id = 'atlanta-jewish-film' WHERE slug = 'ajff' AND producer_id IS NULL;
UPDATE sources SET producer_id = 'atlanta-contemporary' WHERE slug = 'atlanta-contemporary' AND producer_id IS NULL;
UPDATE sources SET producer_id = 'callanwolde' WHERE slug = 'callanwolde' AND producer_id IS NULL;
UPDATE sources SET producer_id = 'atlanta-track-club' WHERE slug = 'atlanta-track-club' AND producer_id IS NULL;
UPDATE sources SET producer_id = 'woodruff-arts' WHERE slug = 'high-museum' AND producer_id IS NULL;
UPDATE sources SET producer_id = 'artsatl' WHERE slug = 'arts-atl' AND producer_id IS NULL;
UPDATE sources SET producer_id = 'atlanta-cultural-affairs' WHERE slug = 'atlanta-cultural-affairs' AND producer_id IS NULL;
UPDATE sources SET producer_id = 'taste-of-atlanta' WHERE slug = 'taste-of-atlanta' AND producer_id IS NULL;
UPDATE sources SET producer_id = 'decatur-arts' WHERE slug = 'decatur-arts-festival' AND producer_id IS NULL;
UPDATE sources SET producer_id = 'community-foundation-atl' WHERE slug = 'community-foundation-atl' AND producer_id IS NULL;
