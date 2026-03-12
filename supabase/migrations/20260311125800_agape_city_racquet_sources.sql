-- ============================================
-- MIGRATION 309: Agape City Racquet Center Sources
-- ============================================
-- Public City of Atlanta tennis and pickleball events at Agape-managed racquet centers.

DO $$
DECLARE
  atlanta_portal_id UUID;
BEGIN
  SELECT id INTO atlanta_portal_id
  FROM portals
  WHERE slug = 'atlanta'
  LIMIT 1;

  IF atlanta_portal_id IS NULL THEN
    RAISE NOTICE 'Atlanta portal not found. Skipping Agape racquet source registration.';
    RETURN;
  END IF;

  INSERT INTO sources (
    slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method
  )
  VALUES
    (
      'bitsy-grant-tennis-center',
      'Bitsy Grant Tennis Center',
      'https://bitsygrant.agapetennisacademy.com/events/',
      'venue',
      'weekly',
      true,
      atlanta_portal_id,
      'beautifulsoup'
    ),
    (
      'chastain-park-tennis-center',
      'Chastain Park Tennis Center',
      'https://chastainpark.agapetennisacademy.com/events/',
      'venue',
      'weekly',
      true,
      atlanta_portal_id,
      'beautifulsoup'
    ),
    (
      'sharon-lester-tennis-center',
      'Sharon Lester Tennis Center at Piedmont Park',
      'https://sharonlester.agapetennisacademy.com/events/',
      'venue',
      'weekly',
      true,
      atlanta_portal_id,
      'beautifulsoup'
    ),
    (
      'washington-park-tennis-center',
      'Washington Park Tennis Center',
      'https://washingtonpark.agapetennisacademy.com/events/',
      'venue',
      'weekly',
      true,
      atlanta_portal_id,
      'beautifulsoup'
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
      'Bitsy Grant Tennis Center',
      'bitsy-grant-tennis-center',
      '2125 Northside Dr. NW',
      'Buckhead',
      'Atlanta',
      'GA',
      '30305',
      33.8131096,
      -84.4076328,
      'fitness_center',
      'recreation',
      'https://bitsygrant.agapetennisacademy.com',
      'City of Atlanta public racquet center managed by Agape Tennis Academy with tennis and pickleball events.'
    ),
    (
      'Chastain Park Tennis Center',
      'chastain-park-tennis-center',
      '290 Chastain Park Ave',
      'Chastain Park',
      'Atlanta',
      'GA',
      '30342',
      33.8731334,
      -84.3960896,
      'fitness_center',
      'recreation',
      'https://chastainpark.agapetennisacademy.com',
      'City of Atlanta public racquet center in Chastain Park managed by Agape Tennis Academy.'
    ),
    (
      'Sharon Lester Tennis Center at Piedmont Park',
      'sharon-lester-tennis-center',
      '400 Park Dr. NE',
      'Midtown',
      'Atlanta',
      'GA',
      '30306',
      33.7864420,
      -84.3716600,
      'fitness_center',
      'recreation',
      'https://sharonlester.agapetennisacademy.com',
      'City of Atlanta tennis and pickleball center at Piedmont Park managed by Agape Tennis Academy.'
    ),
    (
      'Washington Park Tennis Center',
      'washington-park-tennis-center',
      '1125 Lena St. NW',
      'Washington Park',
      'Atlanta',
      'GA',
      '30314',
      33.7567587,
      -84.4240071,
      'fitness_center',
      'recreation',
      'https://washingtonpark.agapetennisacademy.com',
      'Westside City of Atlanta racquet center managed by Agape Tennis Academy.'
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
