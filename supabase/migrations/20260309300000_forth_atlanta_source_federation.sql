-- ============================================
-- MIGRATION 295: FORTH Atlanta Source Federation
-- ============================================
-- FORTH is a business portal (parent: Atlanta) but has zero source_subscriptions.
-- This causes it to see only its own ~13 events instead of Atlanta's 13,000+.
--
-- Fix:
--   1. Ensure sharing rules exist for all active Atlanta-owned sources (share_scope = 'all')
--   2. Subscribe FORTH to every active Atlanta-owned source
--   3. Refresh the portal_source_access materialized view

DO $$
DECLARE
  atlanta_id  UUID;
  forth_id    UUID;
  src         RECORD;
  sub_count   INT := 0;
  rule_count  INT := 0;
BEGIN
  SELECT id INTO atlanta_id FROM portals WHERE slug = 'atlanta';
  SELECT id INTO forth_id   FROM portals WHERE slug = 'forth';

  IF atlanta_id IS NULL THEN
    RAISE NOTICE 'Atlanta portal not found. Skipping.';
    RETURN;
  END IF;

  IF forth_id IS NULL THEN
    RAISE NOTICE 'FORTH portal not found. Skipping.';
    RETURN;
  END IF;

  -- ---------------------------------------------------------------
  -- 1. Ensure source_sharing_rules exist for all active Atlanta sources.
  --    Most will already have share_scope = 'all' from prior migrations.
  --    We upsert so this is idempotent and covers any newly added sources.
  -- ---------------------------------------------------------------
  FOR src IN
    SELECT id
    FROM sources
    WHERE owner_portal_id = atlanta_id
      AND is_active = true
  LOOP
    INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
    VALUES (src.id, atlanta_id, 'all')
    ON CONFLICT (source_id)
    DO UPDATE SET
      share_scope    = 'all',
      updated_at     = now()
    WHERE source_sharing_rules.share_scope != 'all';

    rule_count := rule_count + 1;
  END LOOP;

  RAISE NOTICE 'Ensured sharing rules for % Atlanta sources', rule_count;

  -- ---------------------------------------------------------------
  -- 2. Subscribe FORTH to every active Atlanta-owned source.
  --    ON CONFLICT DO NOTHING keeps existing subscriptions intact.
  -- ---------------------------------------------------------------
  FOR src IN
    SELECT id
    FROM sources
    WHERE owner_portal_id = atlanta_id
      AND is_active = true
  LOOP
    INSERT INTO source_subscriptions (
      subscriber_portal_id,
      source_id,
      subscription_scope,
      is_active
    )
    VALUES (
      forth_id,
      src.id,
      'all',
      true
    )
    ON CONFLICT (subscriber_portal_id, source_id)
    DO UPDATE SET
      subscription_scope = 'all',
      is_active          = true;

    sub_count := sub_count + 1;
  END LOOP;

  RAISE NOTICE 'Subscribed FORTH to % Atlanta sources', sub_count;

END $$;

-- ---------------------------------------------------------------
-- 3. Refresh the materialized view so FORTH immediately sees all
--    Atlanta sources through its new subscriptions.
-- ---------------------------------------------------------------
REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
