-- ============================================
-- MIGRATION 350: Gwinnett Aquatic Fitness Source
-- ============================================
-- Public aquatic fitness classes from Gwinnett County Parks & Recreation.

DO $$
DECLARE
  atlanta_portal_id UUID;
BEGIN
  SELECT id INTO atlanta_portal_id
  FROM portals
  WHERE slug = 'atlanta'
  LIMIT 1;

  IF atlanta_portal_id IS NULL THEN
    RAISE NOTICE 'Atlanta portal not found. Skipping Gwinnett aquatic fitness source registration.';
    RETURN;
  END IF;

  INSERT INTO sources (
    slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method
  )
  VALUES (
    'gwinnett-aquatic-fitness',
    'Gwinnett Aquatic Fitness',
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
    name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, description
  )
  VALUES
    (
      'Collins Hill Park Aquatic Center',
      'collins-hill-park-aquatic-center',
      '2200 Collins Hill Rd',
      'Lawrenceville',
      'Lawrenceville',
      'GA',
      '30043',
      33.9941,
      -84.0045,
      'community_center',
      'community_center',
      'https://secure.rec1.com/GA/gwinnett-county-parks-recreation/catalog',
      'Gwinnett County aquatic center hosting public aquatics fitness classes.'
    ),
    (
      'Mountain Park Aquatic Center',
      'mountain-park-aquatic-center',
      '1063 Rockbridge Rd SW',
      'Lilburn',
      'Lilburn',
      'GA',
      '30047',
      33.8929,
      -84.0864,
      'community_center',
      'community_center',
      'https://secure.rec1.com/GA/gwinnett-county-parks-recreation/catalog',
      'Gwinnett County aquatic center hosting public aquatics fitness classes.'
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
