-- Migration 025: Link sources to event_producers
-- Adds producer_id to sources table for automatic event-producer linking

-- Add producer_id column to sources
ALTER TABLE sources ADD COLUMN IF NOT EXISTS producer_id TEXT REFERENCES event_producers(id);

-- Create index for lookups
CREATE INDEX IF NOT EXISTS idx_sources_producer ON sources(producer_id);

-- Add new event producers for organization sources
INSERT INTO event_producers (id, name, slug, org_type, website, categories, city, description) VALUES
('artsatl', 'ArtsATL', 'artsatl', 'arts_nonprofit', 'https://artsatl.org', '{"art", "theater", "music", "film"}', 'Atlanta', 'Atlanta arts and culture news and event listings'),
('atlanta-cultural-affairs', 'City of Atlanta Office of Cultural Affairs', 'atlanta-cultural-affairs', 'government', 'https://www.atlantaga.gov/government/departments/parks-recreation/office-of-cultural-affairs', '{"art", "music", "festival"}', 'Atlanta', 'City of Atlanta cultural programming including the Atlanta Jazz Festival'),
('community-foundation-atl', 'Community Foundation for Greater Atlanta', 'community-foundation-atl', 'community_group', 'https://cfgreateratlanta.org', '{"community"}', 'Atlanta', 'Nonprofit serving the Atlanta region')
ON CONFLICT (id) DO NOTHING;

-- Map sources to their producers
UPDATE sources SET producer_id = 'atlanta-film-society' WHERE slug = 'atlanta-film-society';
UPDATE sources SET producer_id = 'out-on-film' WHERE slug = 'out-on-film';
UPDATE sources SET producer_id = 'atlanta-jewish-film' WHERE slug = 'ajff';
UPDATE sources SET producer_id = 'atlanta-opera' WHERE slug = 'atlanta-opera';
UPDATE sources SET producer_id = 'atlanta-ballet' WHERE slug = 'atlanta-ballet';
UPDATE sources SET producer_id = 'atlanta-pride' WHERE slug = 'atlanta-pride';
UPDATE sources SET producer_id = 'atlanta-beltline-inc' WHERE slug = 'beltline';
UPDATE sources SET producer_id = 'atlanta-contemporary' WHERE slug = 'atlanta-contemporary';
UPDATE sources SET producer_id = 'callanwolde' WHERE slug = 'callanwolde';
UPDATE sources SET producer_id = 'atlanta-track-club' WHERE slug = 'atlanta-track-club';
UPDATE sources SET producer_id = 'artsatl' WHERE slug = 'arts-atl';
UPDATE sources SET producer_id = 'atlanta-cultural-affairs' WHERE slug = 'atlanta-cultural-affairs';
UPDATE sources SET producer_id = 'community-foundation-atl' WHERE slug = 'community-foundation-atl';
UPDATE sources SET producer_id = 'woodruff-arts' WHERE slug = 'high-museum';
UPDATE sources SET producer_id = 'decatur-arts' WHERE slug = 'decatur-arts-festival';
UPDATE sources SET producer_id = 'taste-of-atlanta' WHERE slug = 'taste-of-atlanta';

-- Update existing events to link to producers based on source
UPDATE events e
SET producer_id = s.producer_id
FROM sources s
WHERE e.source_id = s.id
  AND s.producer_id IS NOT NULL
  AND e.producer_id IS NULL;
