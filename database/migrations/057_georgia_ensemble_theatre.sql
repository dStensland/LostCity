-- Migration: Add Georgia Ensemble Theatre source
-- Date: 2026-01-26
-- Professional theater company at Act3 Playhouse in Sandy Springs

-- Add Georgia Ensemble Theatre source
INSERT INTO sources (name, slug, url, source_type, is_active, created_at)
VALUES
  ('Georgia Ensemble Theatre', 'georgia-ensemble-theatre', 'https://get.org', 'venue', true, NOW())
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  url = EXCLUDED.url,
  source_type = EXCLUDED.source_type;

-- Add Georgia Ensemble Theatre @ Act3 Playhouse venue
-- This is their current location as of 2024-2025 season
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website, created_at
)
VALUES (
  'Georgia Ensemble Theatre @ Act3 Playhouse',
  'georgia-ensemble-theatre',
  '5975 Roswell Rd',
  'Sandy Springs',
  'Sandy Springs',
  'GA',
  '30328',
  33.9426,
  -84.3516,
  'theater',
  'theater',
  'https://get.org',
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

-- Add Roswell Cultural Arts Center as a venue alias (historic location)
-- GET was previously located here before moving to Act3 Playhouse
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng, venue_type, spot_type, website, created_at
)
VALUES (
  'Roswell Cultural Arts Center',
  'roswell-cultural-arts-center',
  '950 Forrest St',
  'Historic Roswell',
  'Roswell',
  'GA',
  '30075',
  34.0229,
  -84.3616,
  'theater',
  'theater',
  'https://roswellgov.com/government/departments/recreation-parks-historic-cultural-affairs/cultural-arts-center',
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
