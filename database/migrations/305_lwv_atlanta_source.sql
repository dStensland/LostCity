-- ============================================
-- MIGRATION 305: League of Women Voters Atlanta-Fulton Source
-- ============================================
-- Voter education, candidate forums, Good Trouble Tuesday events
-- Registers under HelpATL ownership, shared with Atlanta portal
-- Wires to civic-engagement channel

DO $$
DECLARE
  atlanta_id  UUID;
  helpatl_id  UUID;
  src_id      INTEGER;
BEGIN
  SELECT id INTO atlanta_id FROM portals WHERE slug = 'atlanta';
  SELECT id INTO helpatl_id FROM portals WHERE slug = 'helpatl';

  IF atlanta_id IS NULL OR helpatl_id IS NULL THEN
    RAISE NOTICE 'Atlanta or HelpATL portal not found. Skipping.';
    RETURN;
  END IF;

  -- ---------------------------------------------------------------
  -- 1. Register source
  -- ---------------------------------------------------------------

  INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active,
                       integration_method, owner_portal_id)
  VALUES
    ('lwv-atlanta', 'League of Women Voters Atlanta-Fulton',
     'https://www.lwvaf.org/calendar',
     'organization', 'weekly', true, 'playwright', helpatl_id)
  ON CONFLICT (slug) DO UPDATE SET
    owner_portal_id = helpatl_id,
    is_active       = true;

  SELECT id INTO src_id FROM sources WHERE slug = 'lwv-atlanta';

  RAISE NOTICE 'Registered LWV Atlanta source (id=%)', src_id;

  -- ---------------------------------------------------------------
  -- 2. Sharing rules + Atlanta subscription
  -- ---------------------------------------------------------------

  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  VALUES (src_id, helpatl_id, 'all')
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = helpatl_id,
    share_scope     = 'all';

  INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
  VALUES (atlanta_id, src_id, 'all', true)
  ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
    subscription_scope = 'all',
    is_active          = true;

  RAISE NOTICE 'Sharing rules and Atlanta subscription created';

  -- ---------------------------------------------------------------
  -- 3. Wire to civic-engagement channel
  -- ---------------------------------------------------------------

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'source', jsonb_build_object('source_id', src_id, 'source_slug', 'lwv-atlanta'), 10, true
  FROM interest_channels c
  WHERE c.portal_id = helpatl_id AND c.slug = 'civic-engagement'
    AND NOT EXISTS (
      SELECT 1 FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type  = 'source'
        AND r.rule_payload ->> 'source_slug' = 'lwv-atlanta'
    );

  RAISE NOTICE 'Source rule wired to civic-engagement channel';

  -- ---------------------------------------------------------------
  -- 4. Organization venue record
  -- ---------------------------------------------------------------

  INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng,
                      venue_type, spot_type, website)
  VALUES (
    'League of Women Voters Atlanta-Fulton',
    'lwv-atlanta-fulton',
    'Atlanta, GA',
    'Citywide',
    'Atlanta', 'GA', '30303',
    33.7490, -84.3888,
    'organization', 'organization',
    'https://www.lwvaf.org'
  )
  ON CONFLICT (slug) DO NOTHING;

  RAISE NOTICE 'LWV Atlanta venue record created';

END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
