-- ============================================
-- MIGRATION 319: Georgia Swarm Schedule Source
-- ============================================
-- Official Georgia Swarm home schedule at Gas South Arena.

DO $$
DECLARE
  atlanta_portal_id UUID;
BEGIN
  SELECT id INTO atlanta_portal_id
  FROM portals
  WHERE slug = 'atlanta'
  LIMIT 1;

  IF atlanta_portal_id IS NULL THEN
    RAISE NOTICE 'Atlanta portal not found. Skipping Georgia Swarm source registration.';
    RETURN;
  END IF;

  INSERT INTO sources (
    slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method
  )
  VALUES (
    'georgia-swarm',
    'Georgia Swarm',
    'https://www.georgiaswarm.com/schedule/',
    'organization',
    'weekly',
    true,
    atlanta_portal_id,
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

  INSERT INTO venues (
    name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description, active
  )
  VALUES (
    'Gas South Arena',
    'gas-south-arena',
    '6400 Sugarloaf Pkwy',
    'Duluth',
    'Duluth',
    'GA',
    '30097',
    33.9618,
    -84.0965,
    'arena',
    'stadium',
    'https://www.gassouthdistrict.com/arena',
    'Home venue for the Georgia Swarm in Duluth.',
    true
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
    venue_type = EXCLUDED.venue_type,
    spot_type = EXCLUDED.spot_type,
    website = EXCLUDED.website,
    description = EXCLUDED.description,
    active = EXCLUDED.active;
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
