-- ============================================
-- MIGRATION 443: HelpATL Georgia Ethics Commission Source
-- ============================================
-- Adds an official statewide process source for HelpATL's Georgia Democracy
-- Watch lane using the accessible Georgia Ethics Commission public site/feed.

DO $$
DECLARE
  helpatl_id UUID;
  watch_channel_id UUID;
  src_id INTEGER;
BEGIN
  SELECT id INTO helpatl_id
  FROM portals
  WHERE slug = 'helpatl'
  LIMIT 1;

  IF helpatl_id IS NULL THEN
    RAISE NOTICE 'HelpATL portal not found. Skipping.';
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
  VALUES (
    'georgia-ethics-commission',
    'Georgia Government Transparency & Campaign Finance Commission',
    'https://ethics.ga.gov/',
    'government',
    'daily',
    true,
    'scrape',
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

  SELECT id INTO src_id
  FROM sources
  WHERE slug = 'georgia-ethics-commission'
  LIMIT 1;

  IF src_id IS NULL THEN
    RAISE NOTICE 'Georgia Ethics Commission source missing after upsert. Skipping.';
    RETURN;
  END IF;

  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  VALUES (src_id, helpatl_id, 'all')
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = helpatl_id,
    share_scope = 'all',
    updated_at = now();

  INSERT INTO source_subscriptions (
    subscriber_portal_id,
    source_id,
    subscription_scope,
    is_active
  )
  VALUES (helpatl_id, src_id, 'all', true)
  ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
    subscription_scope = 'all',
    is_active = true;

  SELECT id INTO watch_channel_id
  FROM interest_channels
  WHERE portal_id = helpatl_id
    AND slug = 'georgia-democracy-watch'
  LIMIT 1;

  IF watch_channel_id IS NOT NULL THEN
    INSERT INTO interest_channel_rules (
      channel_id,
      rule_type,
      rule_payload,
      priority,
      is_active
    )
    VALUES (
      watch_channel_id,
      'source',
      jsonb_build_object(
        'source_id', src_id,
        'source_slug', 'georgia-ethics-commission'
      ),
      24,
      true
    )
    ON CONFLICT DO NOTHING;
  END IF;

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
  VALUES (
    'Georgia Ethics Commission',
    'georgia-ethics-commission',
    '200 Piedmont Ave SE',
    'Downtown',
    'Atlanta',
    'GA',
    '30334',
    33.7487,
    -84.3826,
    'government',
    'government',
    'https://ethics.ga.gov/'
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
    website = EXCLUDED.website;
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
