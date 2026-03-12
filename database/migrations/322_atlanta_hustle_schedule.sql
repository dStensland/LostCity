-- ============================================
-- MIGRATION 322: Atlanta Hustle Schedule Source
-- ============================================
-- Official Atlanta Hustle home schedule at Silverbacks Park.

DO $$
DECLARE
  atlanta_portal_id UUID;
BEGIN
  SELECT id INTO atlanta_portal_id
  FROM portals
  WHERE slug = 'atlanta'
  LIMIT 1;

  IF atlanta_portal_id IS NULL THEN
    RAISE NOTICE 'Atlanta portal not found. Skipping Atlanta Hustle source registration.';
    RETURN;
  END IF;

  INSERT INTO sources (
    slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method
  )
  VALUES (
    'atlanta-hustle',
    'Atlanta Hustle',
    'https://www.watchufa.com/hustle/schedule',
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
    'Silverbacks Park',
    'silverbacks-park',
    '3200 Atlanta Silverbacks Way',
    'North Druid Hills',
    'Atlanta',
    'GA',
    '30340',
    33.8409,
    -84.2513,
    'stadium',
    'stadium',
    'https://silverbackspark.com/',
    'Home venue for Atlanta Hustle ultimate frisbee in Atlanta.',
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
