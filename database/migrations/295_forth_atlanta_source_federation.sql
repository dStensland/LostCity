-- ============================================
-- MIGRATION 295: FORTH Atlanta Source Federation
-- ============================================
-- FORTH is a business portal (parent: Atlanta) but has zero source_subscriptions.
-- This causes it to see only its own ~13 events instead of Atlanta's 13,000+.
--
-- Fix: Bulk-subscribe FORTH to all active Atlanta-owned sources.

-- 1. Ensure sharing rules exist for all active Atlanta sources
INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
SELECT s.id, s.owner_portal_id, 'all'
FROM sources s
WHERE s.owner_portal_id = (SELECT id FROM portals WHERE slug = 'atlanta')
  AND s.is_active = true
ON CONFLICT (source_id) DO NOTHING;

-- 2. Subscribe FORTH to all active Atlanta-owned sources
INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
SELECT
  (SELECT id FROM portals WHERE slug = 'forth'),
  s.id,
  'all',
  true
FROM sources s
WHERE s.owner_portal_id = (SELECT id FROM portals WHERE slug = 'atlanta')
  AND s.is_active = true
ON CONFLICT (subscriber_portal_id, source_id)
DO UPDATE SET subscription_scope = 'all', is_active = true;

-- 3. Refresh the materialized view
REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
