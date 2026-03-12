-- ============================================
-- MIGRATION 310: Joseph McGhee Tennis Center Source
-- ============================================
-- Public City of Atlanta tennis events at the Agape-managed Joseph McGhee Tennis Center.

DO $$
DECLARE
  atlanta_portal_id UUID;
BEGIN
  SELECT id INTO atlanta_portal_id
  FROM portals
  WHERE slug = 'atlanta'
  LIMIT 1;

  IF atlanta_portal_id IS NULL THEN
    RAISE NOTICE 'Atlanta portal not found. Skipping Joseph McGhee source registration.';
    RETURN;
  END IF;

  INSERT INTO sources (
    slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method
  )
  VALUES (
    'joseph-mcghee-tennis-center',
    'Joseph McGhee Tennis Center',
    'https://mcghee.agapetennisacademy.com/events/',
    'venue',
    'weekly',
    true,
    atlanta_portal_id,
    'beautifulsoup'
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
    name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description
  )
  VALUES (
    'Joseph McGhee Tennis Center',
    'joseph-mcghee-tennis-center',
    '820 Beecher St. SW',
    'West End',
    'Atlanta',
    'GA',
    '30311',
    33.7337777,
    -84.4157412,
    'fitness_center',
    'recreation',
    'https://mcghee.agapetennisacademy.com',
    'Southwest Atlanta public tennis center managed by Agape Tennis Academy.'
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
    description = EXCLUDED.description;
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
