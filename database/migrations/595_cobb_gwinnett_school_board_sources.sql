-- ============================================
-- MIGRATION: Cobb + Gwinnett County School Board Sources
-- ============================================
-- 1. Register Cobb and Gwinnett school board sources (owned by HelpATL)
-- 2. Create sharing rules (HelpATL owns, shared with Atlanta)
-- 3. Wire source rules to school-board-watch and education channels on HelpATL
-- 4. Create venues for both districts
-- 5. Refresh portal_source_access materialized view
--
-- Districts served:
--   Cobb County School District   — ~107,000 students
--   Gwinnett County Public Schools — ~180,000 students (largest in Georgia)
-- Combined: 287,000 students. Together with APS, Fulton, and DeKalb, this
-- gives HelpATL school board coverage across all 4 largest metro districts.

DO $$
DECLARE
  atlanta_id  UUID;
  helpatl_id  UUID;
  src         RECORD;
BEGIN
  SELECT id INTO atlanta_id FROM portals WHERE slug = 'atlanta';
  SELECT id INTO helpatl_id FROM portals WHERE slug = 'helpatl';

  IF atlanta_id IS NULL OR helpatl_id IS NULL THEN
    RAISE NOTICE 'Atlanta or HelpATL portal not found. Skipping.';
    RETURN;
  END IF;

  -- ---------------------------------------------------------------
  -- 1. Register sources
  -- ---------------------------------------------------------------

  INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active,
                       integration_method, owner_portal_id)
  VALUES
    ('cobb-county-schools-board', 'Cobb County Schools Board of Education',
     'https://www.cobbk12.org/board-meeting-schedule',
     'organization', 'weekly', true, 'scrape', helpatl_id),
    ('gwinnett-county-schools-board', 'Gwinnett County Public Schools Board of Education',
     'https://www.gcpsk12.org/about-us/board/board-meeting-schedule',
     'organization', 'weekly', true, 'scrape', helpatl_id)
  ON CONFLICT (slug) DO UPDATE SET
    owner_portal_id = helpatl_id,
    is_active       = true;

  RAISE NOTICE 'Registered Cobb and Gwinnett County school board sources';

  -- ---------------------------------------------------------------
  -- 2. Sharing rules + Atlanta subscriptions
  -- ---------------------------------------------------------------

  FOR src IN
    SELECT id FROM sources
    WHERE slug IN ('cobb-county-schools-board', 'gwinnett-county-schools-board')
      AND is_active = true
  LOOP
    INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
    VALUES (src.id, helpatl_id, 'all')
    ON CONFLICT (source_id) DO UPDATE SET
      owner_portal_id = helpatl_id,
      share_scope     = 'all';

    INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
    VALUES (atlanta_id, src.id, 'all', true)
    ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
      subscription_scope = 'all',
      is_active          = true;
  END LOOP;

  RAISE NOTICE 'Sharing rules and Atlanta subscriptions created';

  -- ---------------------------------------------------------------
  -- 3. Wire source rules to school-board-watch and education channels
  -- ---------------------------------------------------------------

  FOR src IN
    SELECT id, slug FROM sources
    WHERE slug IN ('cobb-county-schools-board', 'gwinnett-county-schools-board')
      AND is_active = true
  LOOP
    -- school-board-watch channel
    INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
    SELECT c.id, 'source', jsonb_build_object('source_id', src.id, 'source_slug', src.slug), 10, true
    FROM interest_channels c
    WHERE c.portal_id = helpatl_id AND c.slug = 'school-board-watch'
      AND NOT EXISTS (
        SELECT 1 FROM interest_channel_rules r
        WHERE r.channel_id = c.id
          AND r.rule_type  = 'source'
          AND r.rule_payload ->> 'source_slug' = src.slug
      );

    -- education channel
    INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
    SELECT c.id, 'source', jsonb_build_object('source_id', src.id, 'source_slug', src.slug), 20, true
    FROM interest_channels c
    WHERE c.portal_id = helpatl_id AND c.slug = 'education'
      AND NOT EXISTS (
        SELECT 1 FROM interest_channel_rules r
        WHERE r.channel_id = c.id
          AND r.rule_type  = 'source'
          AND r.rule_payload ->> 'source_slug' = src.slug
      );
  END LOOP;

  RAISE NOTICE 'Source rules wired to school-board-watch and education channels';

  -- ---------------------------------------------------------------
  -- 4. Create venues
  -- ---------------------------------------------------------------

  -- Cobb County School District Central Office
  INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng,
                      venue_type, spot_type, website)
  VALUES (
    'Cobb County School District Central Office',
    'cobb-county-schools-central',
    '514 Glover St SE',
    'Downtown Marietta',
    'Marietta', 'GA', '30060',
    33.9501, -84.5502,
    'organization', 'organization',
    'https://www.cobbk12.org'
  )
  ON CONFLICT (slug) DO NOTHING;

  -- Gwinnett County Public Schools J. Alvin Wilbanks Instructional Support Center
  INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng,
                      venue_type, spot_type, website)
  VALUES (
    'Gwinnett County Public Schools J. Alvin Wilbanks Instructional Support Center',
    'gwinnett-schools-isc',
    '437 Old Peachtree Rd NW',
    'Suwanee',
    'Suwanee', 'GA', '30024',
    34.0490, -84.0705,
    'organization', 'organization',
    'https://www.gcpsk12.org'
  )
  ON CONFLICT (slug) DO NOTHING;

  RAISE NOTICE 'Venues created for Cobb and Gwinnett County Schools';

END $$;

-- ---------------------------------------------------------------
-- 5. Refresh materialized view
-- ---------------------------------------------------------------
REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
