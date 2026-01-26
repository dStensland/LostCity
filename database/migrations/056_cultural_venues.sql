-- Migration: Add City Springs and cultural venue sources
-- Date: 2026-01-26

-- Add City Springs source
INSERT INTO sources (name, slug, url, source_type, is_active, created_at)
VALUES
  ('City Springs', 'city-springs', 'https://citysprings.com', 'venue', true, NOW())
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  url = EXCLUDED.url,
  source_type = EXCLUDED.source_type;

-- Add City Green venue (outdoor events)
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website, created_at
)
VALUES (
  'City Green',
  'city-green',
  '1 Galambos Way',
  'Sandy Springs',
  'Sandy Springs',
  'GA',
  '30328',
  33.9304,
  -84.3733,
  'outdoor',
  'outdoor',
  'https://citysprings.com',
  NOW()
)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  neighborhood = EXCLUDED.neighborhood,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  zip = EXCLUDED.zip,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  venue_type = EXCLUDED.venue_type,
  spot_type = EXCLUDED.spot_type,
  website = EXCLUDED.website;

-- Update Sandy Springs Performing Arts Center venue if it exists
-- (to ensure coordinates and details are consistent)
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website, created_at
)
VALUES (
  'Sandy Springs Performing Arts Center',
  'sandy-springs-pac',
  '1 Galambos Way',
  'Sandy Springs',
  'Sandy Springs',
  'GA',
  '30328',
  33.9304,
  -84.3733,
  'theater',
  'theater',
  'https://www.sandyspringspac.com',
  NOW()
)
ON CONFLICT (slug) DO UPDATE
SET
  address = EXCLUDED.address,
  neighborhood = EXCLUDED.neighborhood,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  zip = EXCLUDED.zip,
  lat = EXCLUDED.lat,
  lng = EXCLUDED.lng,
  website = EXCLUDED.website;
