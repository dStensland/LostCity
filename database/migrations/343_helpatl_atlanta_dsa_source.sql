-- ============================================
-- MIGRATION 343: HelpATL Atlanta DSA Source
-- ============================================
-- Adds Atlanta Democratic Socialists of America as a civic-action source for
-- HelpATL, with Atlanta portal subscription sharing.

DO $$
DECLARE
  helpatl_id UUID;
  atlanta_id UUID;
  src_id INTEGER;
BEGIN
  SELECT id INTO helpatl_id FROM portals WHERE slug = 'helpatl';
  SELECT id INTO atlanta_id FROM portals WHERE slug = 'atlanta';

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
    'atlanta-dsa',
    'Atlanta Democratic Socialists of America',
    'https://atldsa.org/events/',
    'organization',
    'daily',
    true,
    'ical',
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

  SELECT id INTO src_id FROM sources WHERE slug = 'atlanta-dsa' LIMIT 1;

  IF src_id IS NOT NULL THEN
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

    IF atlanta_id IS NOT NULL THEN
      INSERT INTO source_subscriptions (
        subscriber_portal_id,
        source_id,
        subscription_scope,
        is_active
      )
      VALUES (atlanta_id, src_id, 'all', true)
      ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
        subscription_scope = 'all',
        is_active = true;
    END IF;
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
    'Atlanta Democratic Socialists of America',
    'atlanta-dsa',
    'Atlanta, GA',
    'Citywide',
    'Atlanta',
    'GA',
    '30303',
    33.7490,
    -84.3880,
    'organization',
    'organization',
    'https://atldsa.org'
  )
  ON CONFLICT (slug) DO NOTHING;
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
