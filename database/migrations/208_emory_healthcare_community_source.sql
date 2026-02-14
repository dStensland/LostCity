-- Migration 208: Register Emory Healthcare Community Events source
-- Purpose:
--   1) Register emory-healthcare-community source (Blackthorn API crawler)
--   2) Share from Atlanta portal ownership
--   3) Subscribe Emory demo portal variants (emory-demo/emory-test/emory)
--
-- Background:
--   Emory Healthcare uses Blackthorn.io (Salesforce-native event platform) for:
--   - Community Engagement events (support groups, wellness walks, cooking classes)
--   - Maternity classes (in-person and online)
--   - Health education programs
--
--   Crawler intercepts Blackthorn XHR API responses via Playwright.
--   Three event groups: Community Engagement (primary), Maternity In-Person, Maternity Online.

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
        RAISE EXCEPTION 'Atlanta portal is required before running migration 208';
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
    VALUES (
        'emory-healthcare-community',
        'Emory Healthcare Community Events',
        'https://events.blackthorn.io/00D5e000002EtNZ',
        'hospital',
        'daily',
        true,
        atlanta_portal_id,
        'playwright'
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

    -- Share this source platform-wide (available to all portals)
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
    WHERE s.slug = 'emory-healthcare-community'
    ON CONFLICT (source_id) DO UPDATE
    SET
        owner_portal_id = EXCLUDED.owner_portal_id,
        share_scope = 'all',
        allowed_categories = NULL,
        updated_at = NOW();

    -- Subscribe Emory portal variants to this source
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
      ON s.slug = 'emory-healthcare-community'
    WHERE p.slug IN ('emory-demo', 'emory-test', 'emory')
    ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE
    SET
        subscription_scope = 'all',
        subscribed_categories = NULL,
        is_active = true;
END $$;

-- Refresh materialized view to make source available immediately
REFRESH MATERIALIZED VIEW portal_source_access;

COMMIT;
