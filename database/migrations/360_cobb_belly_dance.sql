-- ============================================
-- MIGRATION 360: Cobb Belly Dance Source
-- ============================================
-- Public belly dance classes from Cobb County Parks.

DO $$
DECLARE
  atlanta_portal_id UUID;
BEGIN
  SELECT id INTO atlanta_portal_id
  FROM portals
  WHERE slug = 'atlanta'
  LIMIT 1;

  IF atlanta_portal_id IS NULL THEN
    RAISE NOTICE 'Atlanta portal not found. Skipping Cobb belly dance source registration.';
    RETURN;
  END IF;

  INSERT INTO sources (
    slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method
  )
  VALUES (
    'cobb-belly-dance',
    'Cobb Belly Dance',
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
      'Ron Anderson Recreation Center',
      'ron-anderson-recreation-center',
      '3820 Macedonia Rd',
      'Powder Springs',
      'Powder Springs',
      'GA',
      '30127',
      'community_center',
      'community_center',
      'https://secure.rec1.com/GA/cobb-county-ga/catalog',
      'Cobb County recreation center hosting public belly dance classes.'
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
