-- ============================================
-- MIGRATION: Activate Family Crawler Sources
-- ============================================
-- Ensures all four metro Atlanta family program sources are active
-- for the spring break crawl sprint (April 6–10, 2026).
--
-- Sources registered in migrations 415–418:
--   - gwinnett-family-programs  (Rec1 / Gwinnett County Parks & Rec)
--   - cobb-family-programs      (Rec1 / Cobb County Parks & Rec)
--   - atlanta-family-programs   (ACTIVENet / Atlanta DPR)
--   - dekalb-family-programs    (ACTIVENet / DeKalb County Recreation)
--
-- These sources were created with is_active=true but this migration
-- enforces that state idempotently, protects against manual deactivation,
-- and refreshes the portal_source_access materialized view.

UPDATE sources
SET
  is_active = true,
  crawl_frequency = 'weekly'
WHERE slug IN (
  'gwinnett-family-programs',
  'cobb-family-programs',
  'atlanta-family-programs',
  'dekalb-family-programs'
);

-- Ensure source_sharing_rules exist for each source
-- (idempotent — ON CONFLICT is handled by the unique constraint on source_id)
DO $$
DECLARE
  hooky_id   UUID;
  atlanta_id UUID;
  src        RECORD;
BEGIN
  SELECT id INTO hooky_id  FROM portals WHERE slug = 'atlanta-families';
  SELECT id INTO atlanta_id FROM portals WHERE slug = 'atlanta';

  IF hooky_id IS NULL THEN
    RAISE EXCEPTION 'atlanta-families portal not found. Run migrations 322 and 512 first.';
  END IF;

  FOR src IN
    SELECT id FROM sources
    WHERE slug IN (
      'gwinnett-family-programs',
      'cobb-family-programs',
      'atlanta-family-programs',
      'dekalb-family-programs'
    )
  LOOP
    -- Sharing rule: hooky owns the source, shares all content
    INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
    VALUES (src.id, hooky_id, 'all')
    ON CONFLICT (source_id) DO UPDATE SET
      owner_portal_id = EXCLUDED.owner_portal_id,
      share_scope     = EXCLUDED.share_scope;

    -- Subscription: Atlanta subscribes to all family program content
    IF atlanta_id IS NOT NULL THEN
      INSERT INTO source_subscriptions (
        subscriber_portal_id, source_id, subscription_scope, is_active
      )
      VALUES (atlanta_id, src.id, 'all', true)
      ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
        subscription_scope = EXCLUDED.subscription_scope,
        is_active          = EXCLUDED.is_active;
    END IF;
  END LOOP;
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
