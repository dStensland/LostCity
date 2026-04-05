-- Migration: Community Grounds Source Registration
--
-- Keep this file mirrored in database/migrations and supabase/migrations.
-- Update database/schema.sql in the same change set when schema changes are involved.

DO $$
DECLARE
  atlanta_id UUID;
BEGIN
  SELECT id INTO atlanta_id
  FROM portals
  WHERE slug = 'atlanta'
  LIMIT 1;

  IF atlanta_id IS NULL THEN
    RAISE EXCEPTION 'Atlanta portal not found. Cannot register Community Grounds.';
  END IF;

  INSERT INTO places (
    name,
    slug,
    address,
    neighborhood,
    city,
    state,
    zip,
    lat,
    lng,
    place_type,
    spot_type,
    website,
    description,
    vibes,
    is_active
  )
  VALUES (
    'Community Grounds',
    'community-grounds',
    '1297 McDonough Boulevard Southeast',
    'South Atlanta',
    'Atlanta',
    'GA',
    '30315',
    33.7189936,
    -84.3854720,
    'coffee_shop',
    'coffee_shop',
    'https://communitygrounds.com/',
    'Neighborhood coffee shop and community gathering place in South Atlanta. The official site explicitly describes Community Grounds as a positive third space for neighbors, conversations, relaxing, and fellowship over coffee.',
    ARRAY['casual', 'cozy'],
    TRUE
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    neighborhood = EXCLUDED.neighborhood,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    zip = EXCLUDED.zip,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    place_type = EXCLUDED.place_type,
    spot_type = EXCLUDED.spot_type,
    website = EXCLUDED.website,
    description = EXCLUDED.description,
    vibes = EXCLUDED.vibes,
    is_active = EXCLUDED.is_active;

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
    'community-grounds',
    'Community Grounds',
    'https://communitygrounds.com/',
    'venue',
    'weekly',
    TRUE,
    atlanta_id,
    'python'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    source_type = EXCLUDED.source_type,
    crawl_frequency = EXCLUDED.crawl_frequency,
    is_active = EXCLUDED.is_active,
    owner_portal_id = EXCLUDED.owner_portal_id,
    integration_method = EXCLUDED.integration_method;
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
