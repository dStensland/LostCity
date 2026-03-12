-- ===================================================
-- MIGRATION 374: Gwinnett Adult Swim Lessons Source
-- ===================================================
-- Public adult swim lessons from Gwinnett County Parks & Recreation.

DO $$
DECLARE
  atlanta_portal_id UUID;
BEGIN
  SELECT id INTO atlanta_portal_id
  FROM portals
  WHERE slug = 'atlanta'
  LIMIT 1;

  IF atlanta_portal_id IS NULL THEN
    RAISE NOTICE 'Atlanta portal not found. Skipping Gwinnett adult swim lessons source registration.';
    RETURN;
  END IF;

  INSERT INTO sources (
    slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method
  )
  VALUES (
    'gwinnett-adult-swim-lessons',
    'Gwinnett Adult Swim Lessons',
    'https://secure.rec1.com/GA/gwinnett-county-parks-recreation/catalog',
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
  VALUES (
    'Lenora Park Pool',
    'lenora-park-pool',
    '4515 Lenora Church Rd',
    'Snellville',
    'Snellville',
    'GA',
    '30039',
    'aquatic_center',
    'aquatic_center',
    'https://secure.rec1.com/GA/gwinnett-county-parks-recreation/catalog',
    'Gwinnett County aquatic facility hosting public adult swim lessons.'
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
