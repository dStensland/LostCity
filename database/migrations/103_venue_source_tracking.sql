-- Migration: Add venue_id to sources for tracking which venues have crawlers
-- This allows us to easily identify destinations that need crawler coverage

-- Add venue_id to sources table
ALTER TABLE sources ADD COLUMN IF NOT EXISTS venue_id INTEGER REFERENCES venues(id) ON DELETE SET NULL;

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_sources_venue_id ON sources(venue_id);

COMMENT ON COLUMN sources.venue_id IS 'Links source/crawler to its primary venue. Used to identify which venues have dedicated crawlers.';

-- Backfill existing venue relationships based on slug matching
-- This is a best-effort match; some may need manual correction

-- Music venues
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'center-stage-theater' LIMIT 1) WHERE slug = 'center_stage';
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'smiths-olde-bar' LIMIT 1) WHERE slug = 'smiths_olde_bar';
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'aisle-5' LIMIT 1) WHERE slug = 'aisle5';
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'apache-cafe' LIMIT 1) WHERE slug = 'apache_xlr';
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'madlife-stage-studios' LIMIT 1) WHERE slug = 'madlife_stage';
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'perfect-note' LIMIT 1) WHERE slug = 'perfect_note_atlanta';
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'the-earl' LIMIT 1) WHERE slug = 'the_earl';
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'variety-playhouse' LIMIT 1) WHERE slug = 'variety_playhouse';
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'terminal-west' LIMIT 1) WHERE slug = 'terminal_west';
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'the-masquerade' LIMIT 1) WHERE slug = 'the_masquerade';
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'tabernacle' LIMIT 1) WHERE slug = 'tabernacle';
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'eddie-owens-at-the-red-light-cafe' LIMIT 1) WHERE slug = 'red_light_cafe';

-- Comedy clubs
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'the-punchline' LIMIT 1) WHERE slug = 'punchline';
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'laughing-skull-lounge' LIMIT 1) WHERE slug = 'laughing_skull';
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'dads-garage' LIMIT 1) WHERE slug = 'dads_garage';

-- Breweries
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'monday-night-brewing' LIMIT 1) WHERE slug = 'monday_night';
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'sweetwater-brewing-company' LIMIT 1) WHERE slug = 'sweetwater';

-- Museums
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'fernbank-museum-of-natural-history' LIMIT 1) WHERE slug = 'fernbank';
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'center-for-puppetry-arts' LIMIT 1) WHERE slug = 'puppetry_arts';
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'high-museum-of-art' LIMIT 1) WHERE slug = 'high_museum';
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'atlanta-history-center' LIMIT 1) WHERE slug = 'atlanta_history_center';
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'atlanta-contemporary' LIMIT 1) WHERE slug = 'atlanta_contemporary';

-- Theaters
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'actors-express' LIMIT 1) WHERE slug = 'actors_express';
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'out-front-theatre' LIMIT 1) WHERE slug = 'out_front_theatre';
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'alliance-theatre' LIMIT 1) WHERE slug = 'alliance_theatre';
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'fox-theatre' LIMIT 1) WHERE slug = 'fox_theatre';
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'shakespeare-tavern-playhouse' LIMIT 1) WHERE slug = 'shakespeare_tavern';
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'aurora-theatre' LIMIT 1) WHERE slug = 'aurora_theatre';

-- Bars
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = '529' LIMIT 1) WHERE slug = 'five29';
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'church' LIMIT 1) WHERE slug = 'church_atlanta';
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'eddies-attic' LIMIT 1) WHERE slug = 'eddies_attic';

-- Bookstores
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'eagle-eye-book-shop' LIMIT 1) WHERE slug = 'eagle_eye_books';

-- Entertainment
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'the-battery-atlanta' LIMIT 1) WHERE slug = 'battery_atlanta';

-- Create a view for easy querying of venues without crawlers
CREATE OR REPLACE VIEW venues_without_crawlers AS
SELECT
  v.id,
  v.name,
  v.slug,
  v.venue_type,
  v.website,
  v.neighborhood
FROM venues v
WHERE v.website IS NOT NULL
  AND v.website != ''
  AND NOT EXISTS (
    SELECT 1 FROM sources s WHERE s.venue_id = v.id AND s.is_active = true
  )
ORDER BY v.venue_type, v.name;

COMMENT ON VIEW venues_without_crawlers IS 'Venues with websites that do not have an active crawler. Use for identifying coverage gaps.';
