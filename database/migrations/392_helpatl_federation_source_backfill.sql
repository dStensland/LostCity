-- Backfill federation-critical HelpATL source registrations that exist only in
-- database migrations 301, 302, 303, and 305. This keeps fresh Supabase-led
-- environments aligned with the live federation graph.

DO $$
DECLARE
  atlanta_id UUID;
  helpatl_id UUID;
  src RECORD;
BEGIN
  SELECT id INTO atlanta_id FROM portals WHERE slug = 'atlanta';
  SELECT id INTO helpatl_id FROM portals WHERE slug = 'helpatl';

  IF atlanta_id IS NULL OR helpatl_id IS NULL THEN
    RAISE NOTICE 'Atlanta or HelpATL portal not found. Skipping.';
    RETURN;
  END IF;

  INSERT INTO sources (
    slug,
    name,
    url,
    source_type,
    crawl_frequency,
    is_active,
    integration_method,
    owner_portal_id
  )
  VALUES
    (
      'atlanta-public-schools-board',
      'Atlanta Public Schools Board of Education',
      'https://www.atlantapublicschools.us/boe',
      'organization',
      'weekly',
      true,
      'scrape',
      helpatl_id
    ),
    (
      'fulton-county-schools-board',
      'Fulton County Schools Board of Education',
      'https://www.fultonschools.org/fcs-board-of-education',
      'organization',
      'weekly',
      true,
      'scrape',
      helpatl_id
    ),
    (
      'marta-army',
      'MARTA Army Transit Events',
      'https://www.martaarmy.org/transit-events',
      'organization',
      'weekly',
      true,
      'ical',
      helpatl_id
    ),
    (
      'atlanta-city-planning',
      'Atlanta Department of City Planning',
      'https://citydesign.atlantaga.gov/upcoming-events',
      'organization',
      'weekly',
      true,
      'playwright',
      helpatl_id
    ),
    (
      'lwv-atlanta',
      'League of Women Voters Atlanta-Fulton',
      'https://www.lwvaf.org/calendar',
      'organization',
      'weekly',
      true,
      'playwright',
      helpatl_id
    )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    source_type = EXCLUDED.source_type,
    crawl_frequency = EXCLUDED.crawl_frequency,
    is_active = true,
    integration_method = EXCLUDED.integration_method,
    owner_portal_id = helpatl_id;

  FOR src IN
    SELECT id, slug
    FROM sources
    WHERE slug IN (
      'atlanta-public-schools-board',
      'fulton-county-schools-board',
      'marta-army',
      'atlanta-city-planning',
      'lwv-atlanta'
    )
      AND is_active = true
  LOOP
    INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
    VALUES (src.id, helpatl_id, 'all')
    ON CONFLICT (source_id) DO UPDATE SET
      owner_portal_id = helpatl_id,
      share_scope = 'all',
      updated_at = now();

    INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
    VALUES (atlanta_id, src.id, 'all', true)
    ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
      subscription_scope = 'all',
      is_active = true;
  END LOOP;

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'source', jsonb_build_object('source_id', s.id, 'source_slug', s.slug), 10, true
  FROM interest_channels c
  JOIN sources s ON s.slug IN ('atlanta-public-schools-board', 'fulton-county-schools-board')
  WHERE c.portal_id = helpatl_id
    AND c.slug = 'school-board-watch'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'source'
        AND r.rule_payload ->> 'source_slug' = s.slug
    );

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'source', jsonb_build_object('source_id', s.id, 'source_slug', s.slug), 20, true
  FROM interest_channels c
  JOIN sources s ON s.slug IN ('atlanta-public-schools-board', 'fulton-county-schools-board')
  WHERE c.portal_id = helpatl_id
    AND c.slug = 'education'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'source'
        AND r.rule_payload ->> 'source_slug' = s.slug
    );

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'source', jsonb_build_object('source_id', s.id, 'source_slug', s.slug), 10, true
  FROM interest_channels c
  JOIN sources s ON s.slug = 'marta-army'
  WHERE c.portal_id = helpatl_id
    AND c.slug = 'transit-mobility'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'source'
        AND r.rule_payload ->> 'source_slug' = s.slug
    );

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'source', jsonb_build_object('source_id', s.id, 'source_slug', s.slug), 10, true
  FROM interest_channels c
  JOIN sources s ON s.slug = 'atlanta-city-planning'
  WHERE c.portal_id = helpatl_id
    AND c.slug = 'atlanta-city-government'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'source'
        AND r.rule_payload ->> 'source_slug' = s.slug
    );

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'source', jsonb_build_object('source_id', s.id, 'source_slug', s.slug), 20, true
  FROM interest_channels c
  JOIN sources s ON s.slug IN ('atlanta-city-planning', 'lwv-atlanta')
  WHERE c.portal_id = helpatl_id
    AND c.slug = 'civic-engagement'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'source'
        AND r.rule_payload ->> 'source_slug' = s.slug
    );
END $$;

INSERT INTO venues (
  name,
  slug,
  address,
  neighborhood,
  city,
  state,
  zip,
  lat,
  lng,
  venue_type,
  spot_type,
  website
)
VALUES
  (
    'Alonzo A. Crim Center for Learning and Leadership',
    'alonzo-a-crim-center',
    '130 Trinity Ave SW',
    'Downtown',
    'Atlanta',
    'GA',
    '30303',
    33.7489,
    -84.3940,
    'community_center',
    'community_center',
    'https://www.atlantapublicschools.us'
  ),
  (
    'Fulton County Schools North Learning Center',
    'fulton-county-schools-north-learning-center',
    '450 Northridge Parkway',
    'Sandy Springs',
    'Sandy Springs',
    'GA',
    '30350',
    33.9697,
    -84.3517,
    'community_center',
    'community_center',
    'https://www.fultonschools.org'
  ),
  (
    'Fulton County Schools South Learning Center',
    'fulton-county-schools-south-learning-center',
    '4025 Flat Shoals Road',
    'Union City',
    'Union City',
    'GA',
    '30291',
    33.5689,
    -84.3442,
    'community_center',
    'community_center',
    'https://www.fultonschools.org'
  ),
  (
    'MARTA Army',
    'marta-army',
    'Atlanta, GA',
    'Citywide',
    'Atlanta',
    'GA',
    '30303',
    33.7490,
    -84.3880,
    'organization',
    'organization',
    'https://www.martaarmy.org'
  ),
  (
    'Atlanta Department of City Planning',
    'atlanta-dept-city-planning',
    '55 Trinity Ave SW',
    'Downtown',
    'Atlanta',
    'GA',
    '30303',
    33.7490,
    -84.3919,
    'community_center',
    'community_center',
    'https://citydesign.atlantaga.gov'
  ),
  (
    'League of Women Voters Atlanta-Fulton',
    'lwv-atlanta-fulton',
    'Atlanta, GA',
    'Citywide',
    'Atlanta',
    'GA',
    '30303',
    33.7490,
    -84.3888,
    'organization',
    'organization',
    'https://www.lwvaf.org'
  )
ON CONFLICT (slug) DO NOTHING;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
