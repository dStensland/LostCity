-- Migration 206: Expand Emory demo subscriptions with high-signal community sources
-- Purpose:
--   1) Promote dense, practical community inventory in Emory consumer portal
--   2) Keep source set family/community-oriented (no nightlife expansion)

BEGIN;

DO $$
DECLARE
    atlanta_portal_id UUID;
BEGIN
    SELECT id INTO atlanta_portal_id
    FROM portals
    WHERE slug = 'atlanta'
    LIMIT 1;

    IF atlanta_portal_id IS NULL THEN
        RAISE EXCEPTION 'Atlanta portal is required before running migration 206';
    END IF;

    -- Ensure these Atlanta-owned sources are shared.
    INSERT INTO source_sharing_rules (
        source_id,
        owner_portal_id,
        share_scope,
        allowed_categories
    )
    SELECT
        s.id,
        atlanta_portal_id,
        'all',
        NULL
    FROM sources s
    WHERE s.slug IN (
        'fulton-library',
        'mjcca',
        'college-park-main-street',
        'fernbank',
        'childrens-museum'
    )
    ON CONFLICT (source_id) DO UPDATE
    SET
        owner_portal_id = EXCLUDED.owner_portal_id,
        share_scope = 'all',
        allowed_categories = NULL,
        updated_at = NOW();

    -- Explicitly subscribe Emory variants so they are always included in scoped source sets.
    INSERT INTO source_subscriptions (
        subscriber_portal_id,
        source_id,
        subscription_scope,
        subscribed_categories,
        is_active
    )
    SELECT
        p.id,
        s.id,
        'all',
        NULL,
        true
    FROM portals p
    JOIN sources s
      ON s.slug IN (
          'fulton-library',
          'mjcca',
          'college-park-main-street',
          'fernbank',
          'childrens-museum'
      )
    WHERE p.slug IN ('emory-demo', 'emory-test', 'emory')
    ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE
    SET
        subscription_scope = 'all',
        subscribed_categories = NULL,
        is_active = true;
END $$;

REFRESH MATERIALIZED VIEW portal_source_access;

COMMIT;
