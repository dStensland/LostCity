-- ============================================
-- MIGRATION 307: MedShare Source Federation
-- ============================================
-- MedShare already has active inventory but lacked a sharing rule,
-- so HelpATL subscriptions could not resolve into portal_source_access.
-- This migration fixes the federation contract at the source.

DO $$
DECLARE
  atlanta_support_id UUID;
  atlanta_id UUID;
  medshare_id INTEGER;
BEGIN
  SELECT id INTO atlanta_support_id FROM portals WHERE slug = 'atlanta-support';
  SELECT id INTO atlanta_id FROM portals WHERE slug = 'atlanta';
  SELECT id INTO medshare_id FROM sources WHERE slug = 'medshare';

  IF atlanta_support_id IS NULL OR atlanta_id IS NULL OR medshare_id IS NULL THEN
    RAISE NOTICE 'Atlanta Support, Atlanta, or MedShare source not found. Skipping.';
    RETURN;
  END IF;

  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  VALUES (medshare_id, atlanta_support_id, 'all')
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = atlanta_support_id,
    share_scope = 'all',
    updated_at = now();

  INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
  VALUES (atlanta_id, medshare_id, 'all', true)
  ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
    subscription_scope = 'all',
    is_active = true;

  RAISE NOTICE 'MedShare sharing rule and Atlanta subscription ensured';
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
