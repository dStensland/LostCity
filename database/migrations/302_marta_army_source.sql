-- ============================================
-- MIGRATION 302: MARTA Army Transit Events Source
-- ============================================
-- 1. Register MARTA Army source under HelpATL ownership
-- 2. Create sharing rules (HelpATL owns, shared with Atlanta)
-- 3. Wire source rules to transit-mobility channel on HelpATL
-- 4. Create organization venue record

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
    ('marta-army', 'MARTA Army Transit Events',
     'https://www.martaarmy.org/transit-events',
     'organization', 'weekly', true, 'ical', helpatl_id)
  ON CONFLICT (slug) DO UPDATE SET
    owner_portal_id = helpatl_id,
    is_active       = true;

  SELECT id INTO src_id FROM sources WHERE slug = 'marta-army';

  RAISE NOTICE 'Registered MARTA Army source (id=%)', src_id;

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

  RAISE NOTICE 'Sharing rules and Atlanta subscription created for MARTA Army';

  -- ---------------------------------------------------------------
  -- 3. Wire to transit-mobility channel on HelpATL
  -- ---------------------------------------------------------------

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'source', jsonb_build_object('source_id', src_id, 'source_slug', 'marta-army'), 10, true
  FROM interest_channels c
  WHERE c.portal_id = helpatl_id AND c.slug = 'transit-mobility'
    AND NOT EXISTS (
      SELECT 1 FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type  = 'source'
        AND r.rule_payload ->> 'source_slug' = 'marta-army'
    );

  RAISE NOTICE 'Source rule wired to transit-mobility channel';

  -- ---------------------------------------------------------------
  -- 4. Create organization venue record
  -- ---------------------------------------------------------------

  INSERT INTO venues (name, slug, address, neighborhood, city, state, zip, lat, lng,
                      venue_type, spot_type, website)
  VALUES (
    'MARTA Army',
    'marta-army',
    'Atlanta, GA',
    'Citywide',
    'Atlanta', 'GA', '30303',
    33.7490, -84.3880,
    'organization', 'organization',
    'https://www.martaarmy.org'
  )
  ON CONFLICT (slug) DO NOTHING;

  RAISE NOTICE 'MARTA Army venue record created';

END $$;

-- ---------------------------------------------------------------
-- 5. Refresh materialized view
-- ---------------------------------------------------------------
REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
