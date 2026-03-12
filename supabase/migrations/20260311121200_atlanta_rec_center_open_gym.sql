-- ============================================
-- MIGRATION 340: Atlanta Rec Center Open Gym Source
-- ============================================
-- Public open-gym schedules published through Atlanta DPR's ACTIVENet catalog.

DO $$
DECLARE
  atlanta_portal_id UUID;
BEGIN
  SELECT id INTO atlanta_portal_id
  FROM portals
  WHERE slug = 'atlanta'
  LIMIT 1;

  IF atlanta_portal_id IS NULL THEN
    RAISE NOTICE 'Atlanta portal not found. Skipping rec-center open gym source registration.';
    RETURN;
  END IF;

  INSERT INTO sources (
    slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method
  )
  VALUES (
    'atlanta-rec-center-open-gym',
    'Atlanta Rec Center Open Gym',
    'https://anc.apm.activecommunities.com/atlantadprca/Activity_Search',
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
      'Coan Park Recreation Center',
      'coan-park-recreation-center',
      '1530 Woodbine Ave SE',
      'Edgewood',
      'Atlanta',
      'GA',
      '30317',
      33.7491,
      -84.3412,
      'community_center',
      'community_center',
      'https://apm.activecommunities.com/atlantadprca/Home',
      'City of Atlanta recreation center with published open gym programming.'
    ),
    (
      'Dunbar Park Recreation Center',
      'dunbar-park-recreation-center',
      '477 Windsor St SW',
      'Mechanicsville',
      'Atlanta',
      'GA',
      '30312',
      33.7385,
      -84.3912,
      'community_center',
      'community_center',
      'https://apm.activecommunities.com/atlantadprca/Home',
      'City of Atlanta recreation center with published open gym programming.'
    ),
    (
      'Grove Park Recreation Center',
      'grove-park-recreation-center',
      '750 Frances Pl NW',
      'Grove Park',
      'Atlanta',
      'GA',
      '30318',
      33.7748,
      -84.4362,
      'community_center',
      'community_center',
      'https://apm.activecommunities.com/atlantadprca/Home',
      'City of Atlanta recreation center with published open gym programming.'
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
