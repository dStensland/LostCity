-- Migration 186: Add non-commercial outdoor/fitness sources to Emory federation
-- Purpose:
--   1) Expand wellness + community-mental-health signal with parks/civic/outdoor sources
--   2) Keep source attribution strict (explicit sharing rules + explicit subscriptions)
--   3) Avoid commercial/competitor feeds

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

    IF atlanta_portal_id IS NULL OR emory_portal_id IS NULL THEN
        RAISE EXCEPTION 'Both atlanta and emory portals must exist before migration 186';
    END IF;

    -- Ensure selected non-commercial sources are shared platform-wide.
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
          'beltline',
          'chattahoochee-nature',
          'park-pride',
          'decatur-recreation',
          'ansley-park-civic',
          'morningside-civic',
          'ormewood-park-neighborhood',
          'college-park-city'
      )
    ON CONFLICT (source_id) DO UPDATE
    SET
        owner_portal_id = EXCLUDED.owner_portal_id,
        share_scope = 'all',
        allowed_categories = NULL,
        updated_at = NOW();

    -- Subscribe Emory to these sources.
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
          'beltline',
          'chattahoochee-nature',
          'park-pride',
          'decatur-recreation',
          'ansley-park-civic',
          'morningside-civic',
          'ormewood-park-neighborhood',
          'college-park-city'
      )
    ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE
    SET
        subscription_scope = 'all',
        subscribed_categories = NULL,
        is_active = true;

    -- Safety: keep obvious commercial outdoor sources disabled for Emory.
    UPDATE source_subscriptions ss
    SET is_active = false
    FROM sources s
    WHERE ss.source_id = s.id
      AND ss.subscriber_portal_id = emory_portal_id
      AND s.slug IN (
          'big-peach-running',
          'stone-mountain-park',
          'park-tavern',
          'blakes-on-the-park',
          'highland-yoga',
          'dancing-dogs-yoga'
      );
END $$;

REFRESH MATERIALIZED VIEW portal_source_access;

COMMIT;
