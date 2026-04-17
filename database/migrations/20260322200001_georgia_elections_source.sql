-- ============================================================
-- MIGRATION: Georgia Elections Unified Source
-- ============================================================
-- 1. Register the unified Georgia Elections source (owned by HelpATL)
-- 2. Deactivate the 4 per-county election sources it supersedes
-- 3. Create a sharing rule (HelpATL owns, shared with all portals)
-- 4. Subscribe Atlanta portal to the new source
-- 5. Wire to HelpATL civic-engagement and elections interest channels
-- 6. Ensure the Cobb County Elections venue exists
-- 7. Refresh portal_source_access materialized view
--
-- Source coverage:
--   https://www.cobbcounty.gov/elections/voting/elections-calendar
--
-- Election dates are statewide — one source covers all metro Atlanta counties.
-- Superseded sources (deactivated, NOT deleted — historical events preserved):
--   fulton-county-elections, dekalb-county-elections,
--   cobb-county-elections,   gwinnett-county-elections

DO $$
DECLARE
  atlanta_id  UUID;
  helpatl_id  UUID;
  src_id      INTEGER;
BEGIN
  SELECT id INTO atlanta_id FROM portals WHERE slug = 'atlanta';
  SELECT id INTO helpatl_id FROM portals WHERE slug = 'helpatl';

  IF helpatl_id IS NULL THEN
    RAISE NOTICE 'HelpATL portal not found. Skipping.';
    RETURN;
  END IF;

  -- ---------------------------------------------------------------
  -- 1. Register unified Georgia Elections source
  -- ---------------------------------------------------------------

  INSERT INTO sources (slug, name, url, source_type, crawl_frequency,
                       is_active, integration_method, owner_portal_id)
  VALUES (
    'georgia-elections',
    'Georgia Elections Calendar',
    'https://www.cobbcounty.gov/elections/voting/elections-calendar',
    'organization',
    'monthly',
    true,
    'scrape',
    helpatl_id
  )
  ON CONFLICT (slug) DO UPDATE SET
    name             = EXCLUDED.name,
    url              = EXCLUDED.url,
    crawl_frequency  = EXCLUDED.crawl_frequency,
    is_active        = true,
    integration_method = EXCLUDED.integration_method,
    owner_portal_id  = helpatl_id;

  SELECT id INTO src_id FROM sources WHERE slug = 'georgia-elections';
  RAISE NOTICE 'Registered georgia-elections source (id=%)', src_id;

  -- ---------------------------------------------------------------
  -- 2. Deactivate superseded per-county election sources
  --    Events they produced are preserved; the sources just won't recrawl.
  -- ---------------------------------------------------------------

  UPDATE sources
  SET    is_active = false
  WHERE  slug IN (
    'fulton-county-elections',
    'dekalb-county-elections',
    'cobb-county-elections',
    'gwinnett-county-elections'
  );

  RAISE NOTICE 'Deactivated 4 per-county election sources';

  -- ---------------------------------------------------------------
  -- 3. Sharing rule: HelpATL owns, shared with all portals
  -- ---------------------------------------------------------------

  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  VALUES (src_id, helpatl_id, 'all')
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = helpatl_id,
    share_scope     = 'all',
    updated_at      = now();

  RAISE NOTICE 'Sharing rule created for georgia-elections';

  -- ---------------------------------------------------------------
  -- 4. Subscribe Atlanta portal
  -- ---------------------------------------------------------------

  IF atlanta_id IS NOT NULL THEN
    INSERT INTO source_subscriptions (subscriber_portal_id, source_id,
                                      subscription_scope, is_active)
    VALUES (atlanta_id, src_id, 'all', true)
    ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
      subscription_scope = 'all',
      is_active          = true;

    RAISE NOTICE 'Atlanta subscribed to georgia-elections';
  END IF;

  -- Also subscribe HelpATL to its own source
  INSERT INTO source_subscriptions (subscriber_portal_id, source_id,
                                    subscription_scope, is_active)
  VALUES (helpatl_id, src_id, 'all', true)
  ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
    subscription_scope = 'all',
    is_active          = true;

  -- ---------------------------------------------------------------
  -- 5. Wire to HelpATL interest channels (civic-engagement, elections)
  --    Silently skip if a channel doesn't exist yet.
  -- ---------------------------------------------------------------

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id,
         'source',
         jsonb_build_object('source_id', src_id, 'source_slug', 'georgia-elections'),
         10,
         true
  FROM interest_channels c
  WHERE c.portal_id = helpatl_id
    AND c.slug IN ('civic-engagement', 'elections', 'voting')
    AND NOT EXISTS (
      SELECT 1 FROM interest_channel_rules r
      WHERE  r.channel_id = c.id
        AND  r.rule_type  = 'source'
        AND  r.rule_payload ->> 'source_slug' = 'georgia-elections'
    );

  RAISE NOTICE 'Interest channel rules wired (if channels exist)';

  -- ---------------------------------------------------------------
  -- 6. Ensure Cobb County Elections venue exists
  -- ---------------------------------------------------------------

  INSERT INTO venues (name, slug, address, neighborhood, city, state, zip,
                      lat, lng, venue_type, spot_type, website)
  VALUES (
    'Cobb County Elections and Registration',
    'cobb-county-elections-registration',
    '736 Whitlock Ave NW',
    'Downtown Marietta',
    'Marietta', 'GA', '30064',
    33.9526, -84.5547,
    'organization', 'organization',
    'https://www.cobbcounty.gov/elections'
  )
  ON CONFLICT (slug) DO NOTHING;

  RAISE NOTICE 'Venue ensured: cobb-county-elections-registration';

END $$;

-- ---------------------------------------------------------------
-- 7. Refresh materialized view
-- ---------------------------------------------------------------
REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
