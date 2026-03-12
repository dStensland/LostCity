-- ============================================
-- MIGRATION 352: DeKalb Aquatic Fitness Source
-- ============================================
-- Public aquatic fitness classes from DeKalb County Recreation.

DO $$
DECLARE
  atlanta_portal_id UUID;
BEGIN
  SELECT id INTO atlanta_portal_id
  FROM portals
  WHERE slug = 'atlanta'
  LIMIT 1;

  IF atlanta_portal_id IS NULL THEN
    RAISE NOTICE 'Atlanta portal not found. Skipping DeKalb aquatic fitness source registration.';
    RETURN;
  END IF;

  INSERT INTO sources (
    slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method
  )
  VALUES (
    'dekalb-aquatic-fitness',
    'DeKalb Aquatic Fitness',
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
    name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description
  )
  VALUES
    (
      'East Central DeKalb Community & Senior Center',
      'east-central-dekalb-community-senior-center',
      '4885 Elam Rd',
      'Stone Mountain',
      'Stone Mountain',
      'GA',
      '30083',
      33.7945,
      -84.2057,
      'community_center',
      'community_center',
      'https://apm.activecommunities.com/dekalbcountyrecreation/Activity_Search',
      'DeKalb County community center hosting public aquatic fitness classes.'
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
