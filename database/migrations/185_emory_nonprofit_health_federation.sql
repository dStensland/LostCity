-- Migration 185: Remove Piedmont from Emory federation and switch to nonprofit/public resources
-- Purpose:
--   1) Enforce "no competitors" policy for Emory by deactivating Piedmont subscriptions
--   2) Federate Atlanta-owned nonprofit/public-health sources into Emory
--   3) Keep attribution strict through explicit subscriptions and sharing rules

BEGIN;

DO $$
DECLARE
    atlanta_portal_id UUID;
    emory_portal_id UUID;
BEGIN
    SELECT id INTO atlanta_portal_id
    FROM portals
    WHERE slug = 'atlanta'
    LIMIT 1;

    SELECT id INTO emory_portal_id
    FROM portals
    WHERE slug = 'emory'
    LIMIT 1;

    IF atlanta_portal_id IS NULL THEN
        RAISE EXCEPTION 'Atlanta portal is required before running migration 185';
    END IF;

    IF emory_portal_id IS NULL THEN
        RAISE EXCEPTION 'Emory portal is required before running migration 185';
    END IF;

    -- 1) Remove competitor feeds from Emory (soft delete via is_active=false)
    UPDATE source_subscriptions ss
    SET is_active = false
    FROM sources s
    WHERE ss.source_id = s.id
      AND ss.subscriber_portal_id = emory_portal_id
      AND (
          s.slug LIKE 'piedmont-%'
          OR s.slug = 'piedmonthealthcare-events'
      );

    -- 2) Ensure share rules exist and are fully open for nonprofit/public source set.
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
    WHERE s.owner_portal_id = atlanta_portal_id
      AND s.slug IN (
          'dekalb-public-health',
          'dekalb-library',
          'ymca-atlanta',
          'hands-on-atlanta',
          'food-well-alliance',
          'georgia-organics',
          'giving-kitchen',
          'united-way-atlanta',
          'atlanta-community-food-bank',
          'meals-on-wheels-atlanta',
          'open-hand-atlanta'
      )
    ON CONFLICT (source_id) DO UPDATE
    SET
        owner_portal_id = EXCLUDED.owner_portal_id,
        share_scope = 'all',
        allowed_categories = NULL,
        updated_at = NOW();

    -- 3) Subscribe Emory to nonprofit/public-health sources.
    INSERT INTO source_subscriptions (
        subscriber_portal_id,
        source_id,
        subscription_scope,
        subscribed_categories,
        is_active
    )
    SELECT
        emory_portal_id,
        s.id,
        'all',
        NULL,
        true
    FROM sources s
    WHERE s.is_active = true
      AND s.slug IN (
          'dekalb-public-health',
          'dekalb-library',
          'ymca-atlanta',
          'hands-on-atlanta',
          'food-well-alliance',
          'georgia-organics',
          'giving-kitchen',
          'united-way-atlanta',
          'atlanta-community-food-bank',
          'meals-on-wheels-atlanta',
          'open-hand-atlanta'
      )
    ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE
    SET
        subscription_scope = 'all',
        subscribed_categories = NULL,
        is_active = true;
END $$;

REFRESH MATERIALIZED VIEW portal_source_access;

COMMIT;
