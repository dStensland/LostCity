-- ============================================
-- MIGRATION 301: APS and Fulton County School Board Sources
-- ============================================
-- 1. Register Atlanta Public Schools Board and Fulton County Schools Board sources
-- 2. Create sharing rules (HelpATL owns, shared with Atlanta)
-- 3. Wire source rules to school-board-watch channel on HelpATL
-- 4. Create venues for both districts
-- 5. Refresh portal_source_access materialized view

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
    ('atlanta-public-schools-board', 'Atlanta Public Schools Board of Education',
     'https://www.atlantapublicschools.us/boe',
     'organization', 'weekly', true, 'scrape', helpatl_id),
    ('fulton-county-schools-board', 'Fulton County Schools Board of Education',
     'https://www.fultonschools.org/fcs-board-of-education',
     'organization', 'weekly', true, 'scrape', helpatl_id)
  ON CONFLICT (slug) DO UPDATE SET
    owner_portal_id = helpatl_id,
    is_active       = true;

  RAISE NOTICE 'Registered APS and Fulton County school board sources';

  -- ---------------------------------------------------------------
  -- 2. Sharing rules + Atlanta subscriptions
  -- ---------------------------------------------------------------

  FOR src IN
    SELECT id FROM sources
    WHERE slug IN ('atlanta-public-schools-board', 'fulton-county-schools-board')
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
  -- 3. Wire source rules to school-board-watch channel on HelpATL
  -- ---------------------------------------------------------------

  FOR src IN
    SELECT id, slug FROM sources
    WHERE slug IN ('atlanta-public-schools-board', 'fulton-county-schools-board')
      AND is_active = true
  LOOP
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

    -- Also wire to education cause channel
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

  -- APS Headquarters
  INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng,
                      venue_type, spot_type, website)
  VALUES (
    'Alonzo A. Crim Center for Learning and Leadership',
    'alonzo-a-crim-center',
    '130 Trinity Ave SW',
    'Downtown',
    'Atlanta', 'GA', '30303',
    33.7489, -84.3940,
    'community_center', 'community_center',
    'https://www.atlantapublicschools.us'
  )
  ON CONFLICT (slug) DO NOTHING;

  -- Fulton North Learning Center (Work Sessions)
  INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng,
                      venue_type, spot_type, website)
  VALUES (
    'Fulton County Schools North Learning Center',
    'fulton-county-schools-north-learning-center',
    '450 Northridge Parkway',
    'Sandy Springs',
    'Sandy Springs', 'GA', '30350',
    33.9697, -84.3517,
    'community_center', 'community_center',
    'https://www.fultonschools.org'
  )
  ON CONFLICT (slug) DO NOTHING;

  -- Fulton South Learning Center (Board Meetings)
  INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng,
                      venue_type, spot_type, website)
  VALUES (
    'Fulton County Schools South Learning Center',
    'fulton-county-schools-south-learning-center',
    '4025 Flat Shoals Road',
    'Union City',
    'Union City', 'GA', '30291',
    33.5689, -84.3442,
    'community_center', 'community_center',
    'https://www.fultonschools.org'
  )
  ON CONFLICT (slug) DO NOTHING;

  RAISE NOTICE 'Venues created for APS and Fulton County Schools';

END $$;

-- ---------------------------------------------------------------
-- 5. Refresh materialized view
-- ---------------------------------------------------------------
REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
