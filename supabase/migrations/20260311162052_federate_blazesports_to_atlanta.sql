-- Federate BlazeSports America from the Atlanta Support portal into the
-- main Atlanta portal so adaptive recreation inventory can power the
-- Atlanta groups surface.

DO $$
DECLARE
  atlanta_portal_id UUID;
  blazesports_source_id INTEGER;
  blazesports_owner_portal_id UUID;
BEGIN
  SELECT id INTO atlanta_portal_id
  FROM portals
  WHERE slug = 'atlanta'
  LIMIT 1;

  SELECT id, owner_portal_id
  INTO blazesports_source_id, blazesports_owner_portal_id
  FROM sources
  WHERE slug = 'blazesports'
    AND is_active = true
  LIMIT 1;

  IF atlanta_portal_id IS NULL THEN
    RAISE NOTICE 'Atlanta portal not found. Skipping BlazeSports federation.';
    RETURN;
  END IF;

  IF blazesports_source_id IS NULL OR blazesports_owner_portal_id IS NULL THEN
    RAISE NOTICE 'Active owned BlazeSports source not found. Skipping federation.';
    RETURN;
  END IF;

  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  VALUES (blazesports_source_id, blazesports_owner_portal_id, 'all')
  ON CONFLICT (source_id) DO UPDATE
  SET
    owner_portal_id = EXCLUDED.owner_portal_id,
    share_scope = 'all',
    allowed_categories = NULL,
    updated_at = now();

  INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
  VALUES (atlanta_portal_id, blazesports_source_id, 'all', true)
  ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE
  SET
    subscription_scope = 'all',
    subscribed_categories = NULL,
    is_active = true;
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
