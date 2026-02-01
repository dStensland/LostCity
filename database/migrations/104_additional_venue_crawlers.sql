-- Migration: Add crawlers for 4 additional venues
-- New Realm Brewing, The Porter Beer Bar, Chastain Arts Center, Mint Gallery

-- Insert sources
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active) VALUES
('New Realm Brewing', 'new-realm-brewing', 'https://newrealmbrewing.com/atlanta/live-music-events', 'venue', 'daily', true),
('The Porter Beer Bar', 'the-porter', 'https://www.theporterbeerbar.com/wordpress/elementor-1726/', 'venue', 'daily', true),
('Chastain Arts Center', 'chastain-arts', 'https://www.chastainartscenter.org/events', 'venue', 'daily', true),
('Mint Gallery', 'mint-gallery', 'https://mintgallery.com/events', 'venue', 'weekly', true)
ON CONFLICT (slug) DO UPDATE SET
  url = EXCLUDED.url,
  is_active = EXCLUDED.is_active;

-- Link sources to venues (requires venue_id column from migration 103)
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'new-realm-brewing' LIMIT 1) WHERE slug = 'new-realm-brewing';
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'the-porter-beer-bar' LIMIT 1) WHERE slug = 'the-porter';
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'chastain-arts-center' LIMIT 1) WHERE slug = 'chastain-arts';
UPDATE sources SET venue_id = (SELECT id FROM venues WHERE slug = 'mint-gallery' LIMIT 1) WHERE slug = 'mint-gallery';

-- Ensure venues exist with proper data
INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, venue_type, website) VALUES
('New Realm Brewing', 'new-realm-brewing', '550 Somerset Terrace NE', 'Virginia-Highland', 'Atlanta', 'GA', '30306', 'brewery', 'https://newrealmbrewing.com'),
('The Porter Beer Bar', 'the-porter-beer-bar', '1156 Euclid Ave NE', 'Little Five Points', 'Atlanta', 'GA', '30307', 'bar', 'https://www.theporterbeerbar.com'),
('Chastain Arts Center', 'chastain-arts-center', '135 W Wieuca Rd NW', 'Chastain Park', 'Atlanta', 'GA', '30342', 'gallery', 'https://www.chastainartscenter.org'),
('Mint Gallery', 'mint-gallery', '1379 La France St NE', 'Edgewood', 'Atlanta', 'GA', '30307', 'gallery', 'https://mintgallery.com')
ON CONFLICT (slug) DO UPDATE SET
  website = EXCLUDED.website,
  venue_type = EXCLUDED.venue_type;
