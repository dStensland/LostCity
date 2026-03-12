-- ===================================================
-- MIGRATION 382: Atlanta Botanical Garden Camps Source
-- ===================================================
-- Official Atlanta Botanical Garden dedicated camp inventory.
--
-- Portal strategy:
--   Owner:       hooky
--   Subscribers: atlanta
-- ===================================================

DO $$
DECLARE
  hooky_id   UUID;
  atlanta_id UUID;
  src_id     INTEGER;
BEGIN
  SELECT id INTO hooky_id FROM portals WHERE slug = 'hooky';
  SELECT id INTO atlanta_id FROM portals WHERE slug = 'atlanta';

  IF hooky_id IS NULL THEN
    RAISE EXCEPTION 'Hooky portal not found. Run migration 322 first.';
  END IF;

  IF atlanta_id IS NULL THEN
    RAISE EXCEPTION 'Atlanta portal not found. Cannot register Atlanta Botanical Garden camps source.';
  END IF;

  INSERT INTO sources (
    slug, name, url,
    source_type, crawl_frequency, is_active,
    integration_method, owner_portal_id
  )
  VALUES (
    'atlanta-botanical-garden-camps',
    'Atlanta Botanical Garden Camps',
    'https://atlantabg.org/classes-education/garden-camps/',
    'venue',
    'weekly',
    true,
    'requests',
    hooky_id
  )
  ON CONFLICT (slug) DO UPDATE SET
    name               = EXCLUDED.name,
    url                = EXCLUDED.url,
    source_type        = EXCLUDED.source_type,
    crawl_frequency    = EXCLUDED.crawl_frequency,
    is_active          = EXCLUDED.is_active,
    integration_method = EXCLUDED.integration_method,
    owner_portal_id    = EXCLUDED.owner_portal_id;

  SELECT id INTO src_id FROM sources WHERE slug = 'atlanta-botanical-garden-camps';

  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  VALUES (src_id, hooky_id, 'all')
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = EXCLUDED.owner_portal_id,
    share_scope = EXCLUDED.share_scope;

  INSERT INTO source_subscriptions (
    subscriber_portal_id, source_id, subscription_scope, is_active
  )
  VALUES (atlanta_id, src_id, 'all', true)
  ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
    subscription_scope = EXCLUDED.subscription_scope,
    is_active = EXCLUDED.is_active;
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
