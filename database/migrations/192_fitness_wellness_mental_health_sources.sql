-- Migration 192: Register fitness, wellness, and mental health crawlers
-- Purpose:
--   1) Register 5 new sources: Atlanta Track Club, Central Rock Gym, Home Depot Backyard,
--      NAMI Georgia, Mental Health America of Georgia
--   2) Share wellness/mental-health sources platform-wide
--   3) Subscribe Emory portal to mental health + fitness sources for hospital demo

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
    WHERE slug = 'emory-demo'
    LIMIT 1;

    IF atlanta_portal_id IS NULL THEN
        RAISE EXCEPTION 'Atlanta portal is required before running migration 192';
    END IF;

    -- 1) Register all 5 new sources under the Atlanta portal

    -- Atlanta Track Club - running races, group runs, youth programs
    INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
    VALUES (
        'atlanta-track-club',
        'Atlanta Track Club',
        'https://www.atlantatrackclub.org/calendar',
        'organization',
        'daily',
        true,
        atlanta_portal_id,
        'playwright'
    )
    ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name,
        url = EXCLUDED.url,
        source_type = EXCLUDED.source_type,
        crawl_frequency = EXCLUDED.crawl_frequency,
        is_active = true,
        owner_portal_id = EXCLUDED.owner_portal_id,
        integration_method = EXCLUDED.integration_method;

    -- Central Rock Gym Atlanta - climbing events, BIPOC/LGBTQ+ meetups
    INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
    VALUES (
        'central-rock-gym-atlanta',
        'Central Rock Gym Atlanta',
        'https://centralrockgym.com/atlanta/climbing_type/events/',
        'venue',
        'daily',
        true,
        atlanta_portal_id,
        'playwright'
    )
    ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name,
        url = EXCLUDED.url,
        source_type = EXCLUDED.source_type,
        crawl_frequency = EXCLUDED.crawl_frequency,
        is_active = true,
        owner_portal_id = EXCLUDED.owner_portal_id,
        integration_method = EXCLUDED.integration_method;

    -- Home Depot Backyard - free community fitness, markets, festivals
    INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
    VALUES (
        'home-depot-backyard',
        'The Home Depot Backyard',
        'https://www.mercedesbenzstadium.com/hdby/events-calendar',
        'venue',
        'daily',
        true,
        atlanta_portal_id,
        'playwright'
    )
    ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name,
        url = EXCLUDED.url,
        source_type = EXCLUDED.source_type,
        crawl_frequency = EXCLUDED.crawl_frequency,
        is_active = true,
        owner_portal_id = EXCLUDED.owner_portal_id,
        integration_method = EXCLUDED.integration_method;

    -- NAMI Georgia - mental health support groups, training, advocacy
    INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
    VALUES (
        'nami-georgia',
        'NAMI Georgia',
        'https://namiga.org/events/',
        'organization',
        'daily',
        true,
        atlanta_portal_id,
        'rest_api'
    )
    ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name,
        url = EXCLUDED.url,
        source_type = EXCLUDED.source_type,
        crawl_frequency = EXCLUDED.crawl_frequency,
        is_active = true,
        owner_portal_id = EXCLUDED.owner_portal_id,
        integration_method = EXCLUDED.integration_method;

    -- Mental Health America of Georgia - LEAP workshops, MHFA training, advocacy
    INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
    VALUES (
        'mha-georgia',
        'Mental Health America of Georgia',
        'https://www.mhageorgia.org/events/',
        'organization',
        'daily',
        true,
        atlanta_portal_id,
        'rest_api'
    )
    ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name,
        url = EXCLUDED.url,
        source_type = EXCLUDED.source_type,
        crawl_frequency = EXCLUDED.crawl_frequency,
        is_active = true,
        owner_portal_id = EXCLUDED.owner_portal_id,
        integration_method = EXCLUDED.integration_method;

    -- 2) Share mental health + fitness sources platform-wide
    INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope, allowed_categories)
    SELECT s.id, atlanta_portal_id, 'all', NULL
    FROM sources s
    WHERE s.slug IN (
        'nami-georgia',
        'mha-georgia',
        'atlanta-track-club',
        'central-rock-gym-atlanta',
        'home-depot-backyard'
    )
    ON CONFLICT (source_id) DO UPDATE
    SET owner_portal_id = EXCLUDED.owner_portal_id,
        share_scope = 'all',
        allowed_categories = NULL,
        updated_at = NOW();

    -- 3) Subscribe Emory to mental health + community fitness sources
    IF emory_portal_id IS NOT NULL THEN
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
              'nami-georgia',
              'mha-georgia',
              'home-depot-backyard'
          )
        ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE
        SET subscription_scope = 'all',
            subscribed_categories = NULL,
            is_active = true;
    END IF;
END $$;

REFRESH MATERIALIZED VIEW portal_source_access;

COMMIT;
