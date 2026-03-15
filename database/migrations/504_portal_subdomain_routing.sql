-- Add subdomain routing columns to portals table
ALTER TABLE portals ADD COLUMN IF NOT EXISTS vertical_slug VARCHAR(63);
ALTER TABLE portals ADD COLUMN IF NOT EXISTS city_slug VARCHAR(63);

-- Unique constraint: one portal per vertical+city combo
CREATE UNIQUE INDEX IF NOT EXISTS idx_portals_vertical_city
  ON portals(vertical_slug, city_slug)
  WHERE status = 'active' AND vertical_slug IS NOT NULL AND city_slug IS NOT NULL;

-- Index for city-only lookup (base portals)
CREATE INDEX IF NOT EXISTS idx_portals_city_slug ON portals(city_slug) WHERE city_slug IS NOT NULL;

-- Backfill existing portals
UPDATE portals SET city_slug = 'atlanta' WHERE slug = 'atlanta';
UPDATE portals SET vertical_slug = 'citizen', city_slug = 'atlanta' WHERE slug = 'helpatl';
UPDATE portals SET vertical_slug = 'dog', city_slug = 'atlanta' WHERE slug = 'atl-dogs';
UPDATE portals SET vertical_slug = 'film', city_slug = 'atlanta' WHERE slug = 'atl-film';
-- FORTH is B2B: no city_slug, no vertical_slug (uses custom subdomain)
-- Adventure, Arts, Family, Sports portals get vertical_slug + city_slug when created
