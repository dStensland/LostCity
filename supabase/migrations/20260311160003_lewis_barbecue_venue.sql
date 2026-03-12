-- Migration: Lewis Barbecue Venue
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.
--
-- Registers Lewis Barbecue as a venue and inactive source.
-- Opened December 2025 at 1544 Piedmont Ave NE (Ansley Park).
-- MICHELIN Bib Gourmand. World's first rooftop smokehouse.
-- Source is inactive (no events page to crawl) — venue record is the value.

-- Venue
INSERT INTO venues (
  name, slug, address, neighborhood, city, state, zip,
  lat, lng,
  venue_type, spot_type,
  website,
  description,
  vibes,
  active
)
VALUES (
  'Lewis Barbecue',
  'lewis-barbecue',
  '1544 Piedmont Ave NE, Unit 406',
  'Ansley Park',
  'Atlanta',
  'GA',
  '30324',
  33.8020,
  -84.3672,
  'restaurant',
  'restaurant',
  'https://lewisbarbecue.com',
  'World''s first rooftop smokehouse from pitmaster John Lewis. Central Texas-style BBQ with USDA Prime brisket, beef ribs, and house-made sausage. MICHELIN Bib Gourmand. 200+ seats with dedicated bar and BeltLine walk-up window.',
  ARRAY['bbq', 'rooftop', 'beltline-adjacent', 'craft-cocktails', 'outdoor-seating'],
  true
)
ON CONFLICT (slug) DO NOTHING;

-- Source (inactive — no crawler yet; venue record is the value)
INSERT INTO sources (
  slug,
  name,
  url,
  source_type,
  crawl_frequency,
  is_active,
  owner_portal_id,
  integration_method
)
VALUES (
  'lewis-barbecue',
  'Lewis Barbecue',
  'https://lewisbarbecue.com',
  'venue',
  'monthly',
  false,
  (SELECT id FROM portals WHERE slug = 'atlanta'),
  'none'
)
ON CONFLICT (slug) DO NOTHING;
