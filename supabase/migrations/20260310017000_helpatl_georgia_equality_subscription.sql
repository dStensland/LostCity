-- ============================================
-- MIGRATION 346: HelpATL Georgia Equality Subscription
-- ============================================
-- Adds Georgia Equality's existing Atlanta-owned source to HelpATL's
-- federation subscriptions so it can power civic action discovery.

DO $$
DECLARE
  helpatl_id UUID;
  georgia_equality_source_id INTEGER;
BEGIN
  SELECT id INTO helpatl_id FROM portals WHERE slug = 'helpatl';

  IF helpatl_id IS NULL THEN
    RAISE NOTICE 'HelpATL portal not found. Skipping.';
    RETURN;
  END IF;

  SELECT id INTO georgia_equality_source_id
  FROM sources
  WHERE slug = 'georgia-equality'
  LIMIT 1;

  IF georgia_equality_source_id IS NULL THEN
    RAISE NOTICE 'Georgia Equality source not found. Skipping.';
    RETURN;
  END IF;

  INSERT INTO source_subscriptions (
    subscriber_portal_id,
    source_id,
    subscription_scope,
    is_active
  )
  VALUES (helpatl_id, georgia_equality_source_id, 'all', true)
  ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
    subscription_scope = 'all',
    is_active = true;
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
