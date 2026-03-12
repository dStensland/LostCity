-- ============================================
-- MIGRATION 359: Cobb Adult Swim Lessons Source
-- ============================================
-- Public adult swim lessons from Cobb County Parks.

DO $$
DECLARE
  atlanta_portal_id UUID;
BEGIN
  SELECT id INTO atlanta_portal_id
  FROM portals
  WHERE slug = 'atlanta'
  LIMIT 1;

  IF atlanta_portal_id IS NULL THEN
    RAISE NOTICE 'Atlanta portal not found. Skipping Cobb adult swim lessons source registration.';
    RETURN;
  END IF;

  INSERT INTO sources (
    slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method
  )
  VALUES (
    'cobb-adult-swim-lessons',
    'Cobb Adult Swim Lessons',
    'https://secure.rec1.com/GA/cobb-county-ga/catalog',
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
      'West Cobb Aquatic Center',
      'west-cobb-aquatic-center',
      '3675 Macland Road',
      'Powder Springs',
      'Powder Springs',
      'GA',
      '30127',
      'community_center',
      'community_center',
      'https://secure.rec1.com/GA/cobb-county-ga/catalog',
      'Cobb County aquatic center hosting public adult swim lessons.'
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
