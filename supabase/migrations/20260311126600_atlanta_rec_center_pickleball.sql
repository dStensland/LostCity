-- ============================================
-- MIGRATION 311: Atlanta Rec Center Pickleball Source
-- ============================================
-- Public weekly indoor pickleball hours published by the City of Atlanta.

DO $$
DECLARE
  atlanta_portal_id UUID;
BEGIN
  SELECT id INTO atlanta_portal_id
  FROM portals
  WHERE slug = 'atlanta'
  LIMIT 1;

  IF atlanta_portal_id IS NULL THEN
    RAISE NOTICE 'Atlanta portal not found. Skipping rec-center pickleball source registration.';
    RETURN;
  END IF;

  INSERT INTO sources (
    slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method
  )
  VALUES (
    'atlanta-rec-center-pickleball',
    'Atlanta Rec Center Pickleball',
    'https://www.atlantaga.gov/government/departments/department-parks-recreation/office-of-parks/city-of-atlanta-pickleball',
    'government',
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
    name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description
  )
  VALUES
    (
      'Anderson Recreation Center',
      'anderson-recreation-center',
      '120 Anderson Ave NW',
      'Carey Park',
      'Atlanta',
      'GA',
      '30314',
      33.7584203,
      -84.4504772,
      'community_center',
      'community_center',
      'https://www.atlantaga.gov',
      'City of Atlanta recreation center with published indoor pickleball hours.'
    ),
    (
      'Peachtree Hills Recreation Center',
      'peachtree-hills-recreation-center',
      '308 Peachtree Hills Ave NE',
      'Peachtree Hills',
      'Atlanta',
      'GA',
      '30305',
      33.8182644,
      -84.3777000,
      'community_center',
      'community_center',
      'https://www.atlantaga.gov',
      'City of Atlanta recreation center with published indoor pickleball hours.'
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
