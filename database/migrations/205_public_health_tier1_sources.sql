-- Migration 205: Register Tier-1 public-health sources for Emory federation
-- Purpose:
--   1) Register CDC, Georgia DPH, and Fulton County Board of Health sources
--   2) Share those sources platform-wide from Atlanta portal ownership
--   3) Subscribe all Emory demo portal variants (emory-demo/emory-test/emory)

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
        RAISE EXCEPTION 'Atlanta portal is required before running migration 205';
    END IF;

    INSERT INTO sources (
        slug,
        name,
        url,
        source_type,
        crawl_frequency,
        is_active,
        owner_portal_id,
        integration_method
    )
    VALUES
        (
            'cdc',
            'CDC',
            'https://www.cdc.gov/museum/tours/',
            'government',
            'daily',
            true,
            atlanta_portal_id,
            'beautifulsoup'
        ),
        (
            'ga-dph',
            'Georgia Department of Public Health',
            'https://dph.georgia.gov/events',
            'government',
            'daily',
            true,
            atlanta_portal_id,
            'beautifulsoup'
        ),
        (
            'fulton-board-health',
            'Fulton County Board of Health',
            'https://fultoncountyboh.com/fcbohevents/month/',
            'government',
            'daily',
            true,
            atlanta_portal_id,
            'markdown-proxy'
        )
    ON CONFLICT (slug) DO UPDATE
    SET
        name = EXCLUDED.name,
        url = EXCLUDED.url,
        source_type = EXCLUDED.source_type,
        crawl_frequency = EXCLUDED.crawl_frequency,
        is_active = true,
        owner_portal_id = EXCLUDED.owner_portal_id,
        integration_method = EXCLUDED.integration_method;

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
    WHERE s.slug IN ('cdc', 'ga-dph', 'fulton-board-health')
    ON CONFLICT (source_id) DO UPDATE
    SET
        owner_portal_id = EXCLUDED.owner_portal_id,
        share_scope = 'all',
        allowed_categories = NULL,
        updated_at = NOW();

    INSERT INTO source_subscriptions (
        subscriber_portal_id,
        source_id,
        subscription_scope,
        subscribed_categories,
        is_active
    )
    SELECT
        p.id AS subscriber_portal_id,
        s.id AS source_id,
        'all' AS subscription_scope,
        NULL AS subscribed_categories,
        true AS is_active
    FROM portals p
    JOIN sources s
      ON s.slug IN ('cdc', 'ga-dph', 'fulton-board-health')
    WHERE p.slug IN ('emory-demo', 'emory-test', 'emory')
    ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE
    SET
        subscription_scope = 'all',
        subscribed_categories = NULL,
        is_active = true;
END $$;

REFRESH MATERIALIZED VIEW portal_source_access;

COMMIT;
