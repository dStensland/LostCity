-- ===============================================
-- MIGRATION 366: DeKalb Midway Pickleball Source
-- ===============================================
-- Public Midway pickleball open play from DeKalb County Recreation.

DO $$
DECLARE
  atlanta_portal_id UUID;
BEGIN
  SELECT id INTO atlanta_portal_id
  FROM portals
  WHERE slug = 'atlanta'
  LIMIT 1;

  IF atlanta_portal_id IS NULL THEN
    RAISE NOTICE 'Atlanta portal not found. Skipping DeKalb Midway pickleball source registration.';
    RETURN;
  END IF;

  INSERT INTO sources (
    slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method
  )
  VALUES (
    'dekalb-midway-pickleball',
    'DeKalb Midway Pickleball',
    'https://apm.activecommunities.com/dekalbcountyrecreation/Activity_Search',
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
    name, slug, address, neighborhood, city, state, zip, venue_type, spot_type, website, description
  )
  VALUES
    (
      'Midway Recreation Center',
      'midway-recreation-center',
      '3181 Midway Rd',
      'Decatur',
      'Decatur',
      'GA',
      '30032',
      'community_center',
      'community_center',
      'https://apm.activecommunities.com/dekalbcountyrecreation/Activity_Search',
      'DeKalb County recreation center hosting public pickleball open play.'
    )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    neighborhood = EXCLUDED.neighborhood,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    zip = EXCLUDED.zip,
    venue_type = EXCLUDED.venue_type,
    spot_type = EXCLUDED.spot_type,
    website = EXCLUDED.website,
    description = EXCLUDED.description;
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
