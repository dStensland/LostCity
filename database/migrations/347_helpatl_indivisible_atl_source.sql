-- ============================================
-- MIGRATION 347: HelpATL Indivisible ATL Source
-- ============================================
-- Reactivates Atlanta-owned Indivisible ATL and subscribes HelpATL so its
-- activist events can power Civic Training & Action.

DO $$
DECLARE
  atlanta_id UUID;
  helpatl_id UUID;
  src_id INTEGER;
BEGIN
  SELECT id INTO atlanta_id FROM portals WHERE slug = 'atlanta';
  SELECT id INTO helpatl_id FROM portals WHERE slug = 'helpatl';

  IF atlanta_id IS NULL OR helpatl_id IS NULL THEN
    RAISE NOTICE 'Atlanta or HelpATL portal not found. Skipping.';
    RETURN;
  END IF;

  SELECT id INTO src_id
  FROM sources
  WHERE slug = 'indivisible-atl'
  LIMIT 1;

  IF src_id IS NULL THEN
    RAISE NOTICE 'Indivisible ATL source not found. Skipping.';
    RETURN;
  END IF;

  UPDATE sources
  SET is_active = true,
      crawl_frequency = 'daily',
      integration_method = COALESCE(integration_method, 'scrape'),
      owner_portal_id = COALESCE(owner_portal_id, atlanta_id)
  WHERE id = src_id;

  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  VALUES (src_id, atlanta_id, 'all')
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = atlanta_id,
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
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
