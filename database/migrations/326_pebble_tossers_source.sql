-- ============================================
-- MIGRATION 326: Pebble Tossers Source
-- ============================================
-- Pebble Tossers is Atlanta's leading youth volunteer/service nonprofit.
-- 60+ partner nonprofits, Teen Leadership Program across 10 metro counties.
-- Age range: 5-18 (with parent for younger kids, independently for teens).
--
-- Data source: GivePulse (volunteer.pebbletossers.org / givepulse.com/group/772370)
-- Access: Playwright — GivePulse API requires browser session (HMAC auth)
-- Event types: dated in-person volunteer opportunities, ~20-30 per 90-day window
-- Portal strategy: owned by Atlanta, federated to Hooky (fills teen gap)
--
-- Portal attribution:
--   Owner:       atlanta (primary consumer portal)
--   Subscribers: hooky (youth volunteer is core Hooky content for ages 5-18)
--                helpatl (civic volunteer opportunities align with HelpATL mission)
-- ============================================

DO $$
DECLARE
  atlanta_id  UUID;
  hooky_id    UUID;
  helpatl_id  UUID;
  src_id      INTEGER;
BEGIN
  SELECT id INTO atlanta_id FROM portals WHERE slug = 'atlanta';
  SELECT id INTO hooky_id   FROM portals WHERE slug = 'hooky';
  SELECT id INTO helpatl_id FROM portals WHERE slug = 'helpatl';

  IF atlanta_id IS NULL THEN
    RAISE EXCEPTION 'Atlanta portal not found. Cannot register source.';
  END IF;

  -- ---------------------------------------------------------------
  -- 1. Register source
  -- ---------------------------------------------------------------

  INSERT INTO sources (
    slug, name, url,
    source_type, crawl_frequency, is_active,
    integration_method, owner_portal_id
  )
  VALUES (
    'pebble-tossers',
    'Pebble Tossers',
    'https://www.givepulse.com/group/772370',
    'organization',
    'weekly',
    true,
    'playwright',
    atlanta_id
  )
  ON CONFLICT (slug) DO UPDATE SET
    name              = EXCLUDED.name,
    url               = EXCLUDED.url,
    owner_portal_id   = EXCLUDED.owner_portal_id,
    is_active         = true;

  SELECT id INTO src_id FROM sources WHERE slug = 'pebble-tossers';

  RAISE NOTICE 'Registered Pebble Tossers source (id=%)', src_id;

  -- ---------------------------------------------------------------
  -- 2. Sharing rules — source is public, share with all portals
  -- ---------------------------------------------------------------

  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  VALUES (src_id, atlanta_id, 'all')
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = EXCLUDED.owner_portal_id,
    share_scope     = 'all';

  RAISE NOTICE 'Sharing rules created for Pebble Tossers';

  -- ---------------------------------------------------------------
  -- 3. Hooky subscription — youth volunteer is core Hooky content
  -- ---------------------------------------------------------------

  IF hooky_id IS NOT NULL THEN
    INSERT INTO source_subscriptions (
      subscriber_portal_id, source_id, subscription_scope, is_active
    )
    VALUES (hooky_id, src_id, 'all', true)
    ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
      subscription_scope = 'all',
      is_active          = true;

    RAISE NOTICE 'Hooky subscribed to Pebble Tossers';
  ELSE
    RAISE NOTICE 'Hooky portal not found — skipping Hooky subscription';
  END IF;

  -- ---------------------------------------------------------------
  -- 4. HelpATL subscription — volunteer opportunities are HelpATL content
  -- ---------------------------------------------------------------

  IF helpatl_id IS NOT NULL THEN
    INSERT INTO source_subscriptions (
      subscriber_portal_id, source_id, subscription_scope, is_active
    )
    VALUES (helpatl_id, src_id, 'all', true)
    ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
      subscription_scope = 'all',
      is_active          = true;

    RAISE NOTICE 'HelpATL subscribed to Pebble Tossers';
  ELSE
    RAISE NOTICE 'HelpATL portal not found — skipping HelpATL subscription';
  END IF;

  -- ---------------------------------------------------------------
  -- 5. Create Pebble Tossers HQ venue record
  --    (fallback venue for events without a partner org location)
  -- ---------------------------------------------------------------

  INSERT INTO venues (
    name, slug, address, neighborhood,
    city, state, zip,
    lat, lng,
    venue_type, spot_type,
    website
  )
  VALUES (
    'Pebble Tossers',
    'pebble-tossers',
    '1155 Mount Vernon Hwy NE, Ste. 800',
    'Dunwoody',
    'Atlanta', 'GA', '30338',
    33.9415, -84.3467,
    'nonprofit_hq', 'nonprofit_hq',
    'https://www.pebbletossers.org'
  )
  ON CONFLICT (slug) DO NOTHING;

  RAISE NOTICE 'Pebble Tossers venue record created';

  -- ---------------------------------------------------------------
  -- 6. Wire to HelpATL volunteer channel (if it exists)
  -- ---------------------------------------------------------------

  IF helpatl_id IS NOT NULL THEN
    INSERT INTO interest_channel_rules (
      channel_id, rule_type, rule_payload, priority, is_active
    )
    SELECT
      c.id,
      'source',
      jsonb_build_object('source_id', src_id, 'source_slug', 'pebble-tossers'),
      10,
      true
    FROM interest_channels c
    WHERE c.portal_id = helpatl_id
      AND c.slug IN ('volunteer', 'youth-volunteer', 'community-service', 'civic-engagement')
      AND NOT EXISTS (
        SELECT 1 FROM interest_channel_rules r
        WHERE r.channel_id = c.id
          AND r.rule_type  = 'source'
          AND r.rule_payload ->> 'source_slug' = 'pebble-tossers'
      );

    RAISE NOTICE 'Pebble Tossers wired to HelpATL channels (if matching channels exist)';
  END IF;

END $$;

-- ---------------------------------------------------------------
-- 7. Refresh portal_source_access materialized view
-- ---------------------------------------------------------------
REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;

-- ---------------------------------------------------------------
-- Verification query (run post-migration to confirm)
-- ---------------------------------------------------------------
-- SELECT s.slug, s.name, s.is_active, p.slug AS owner_portal
-- FROM sources s
-- LEFT JOIN portals p ON s.owner_portal_id = p.id
-- WHERE s.slug = 'pebble-tossers';
--
-- SELECT ss.subscriber_portal_id, p.slug AS subscriber, s.slug AS source
-- FROM source_subscriptions ss
-- JOIN sources s ON ss.source_id = s.id
-- JOIN portals p ON ss.subscriber_portal_id = p.id
-- WHERE s.slug = 'pebble-tossers' AND ss.is_active = true;
