-- ============================================
-- MIGRATION 357: Cobb Basketball Skills Source
-- ============================================
-- Public basketball skills classes from Cobb County Parks.

DO $$
DECLARE
  atlanta_portal_id UUID;
BEGIN
  SELECT id INTO atlanta_portal_id
  FROM portals
  WHERE slug = 'atlanta'
  LIMIT 1;

  IF atlanta_portal_id IS NULL THEN
    RAISE NOTICE 'Atlanta portal not found. Skipping Cobb basketball skills source registration.';
    RETURN;
  END IF;

  INSERT INTO sources (
    slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method
  )
  VALUES (
    'cobb-basketball-skills',
    'Cobb Basketball Skills',
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
      'Boots Ward Recreation Center',
      'boots-ward-recreation-center',
      '4845 Dallas Hwy',
      'Powder Springs',
      'Powder Springs',
      'GA',
      '30127',
      'community_center',
      'community_center',
      'https://secure.rec1.com/GA/cobb-county-ga/catalog',
      'Cobb County recreation center hosting public basketball skills classes.'
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
