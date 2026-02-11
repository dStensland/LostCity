-- Migration 184: Add Atlanta public-health source and federate into Emory portal
-- Purpose:
--   1) Register DeKalb Public Health as an Atlanta-owned source
--   2) Enforce explicit sharing rules for health-oriented sources
--   3) Create/activate Emory portal as a hospital demo and subscribe to curated sources

BEGIN;

DO $$
DECLARE
    atlanta_portal_id UUID;
    emory_portal_id UUID;
    dekalb_public_health_source_id INTEGER;
BEGIN
    SELECT id INTO atlanta_portal_id
    FROM portals
    WHERE slug = 'atlanta'
    LIMIT 1;

    IF atlanta_portal_id IS NULL THEN
        RAISE EXCEPTION 'Atlanta portal is required before running migration 184';
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
        'dekalb-public-health',
        'DeKalb Public Health',
        'https://dekalbpublichealth.com/events/',
        'government',
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
        integration_method = EXCLUDED.integration_method
    RETURNING id INTO dekalb_public_health_source_id;

    INSERT INTO source_sharing_rules (
        source_id,
        owner_portal_id,
        share_scope,
        allowed_categories
    )
    VALUES (
        dekalb_public_health_source_id,
        atlanta_portal_id,
        'all',
        NULL
    )
    ON CONFLICT (source_id) DO UPDATE
    SET
        owner_portal_id = EXCLUDED.owner_portal_id,
        share_scope = 'all',
        allowed_categories = NULL,
        updated_at = NOW();

    -- Ensure Emory events source can be federated when needed.
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
    WHERE s.slug = 'emory-schwartz-center'
    ON CONFLICT (source_id) DO UPDATE
    SET
        owner_portal_id = EXCLUDED.owner_portal_id,
        share_scope = 'all',
        allowed_categories = NULL,
        updated_at = NOW();

    INSERT INTO portals (
        slug,
        name,
        tagline,
        portal_type,
        status,
        visibility,
        plan,
        parent_portal_id,
        filters,
        branding,
        settings
    )
    VALUES (
        'emory',
        'Emory Healthcare',
        'Care, classes, and healthier community experiences',
        'business',
        'active',
        'public',
        'enterprise',
        atlanta_portal_id,
        '{
            "city": "Atlanta",
            "state": "GA",
            "tags": ["healthcare", "public-health", "wellness", "hospital"],
            "geo_center": [33.7892, -84.3264],
            "geo_radius_km": 20
        }'::jsonb,
        '{
            "primary_color": "#005EB8",
            "secondary_color": "#003A70",
            "accent_color": "#00A3E0",
            "background_color": "#F5FAFF",
            "text_color": "#1F2937"
        }'::jsonb,
        '{
            "vertical": "hospital",
            "show_map": true,
            "default_view": "list",
            "show_categories": true,
            "wayfinding_partner": "gozio",
            "meta_title": "Emory Healthcare - Events, Wellness, and Community Health",
            "meta_description": "Discover health classes, screenings, and public-health events across metro Atlanta."
        }'::jsonb
    )
    ON CONFLICT (slug) DO UPDATE
    SET
        name = EXCLUDED.name,
        tagline = EXCLUDED.tagline,
        portal_type = EXCLUDED.portal_type,
        status = 'active',
        visibility = EXCLUDED.visibility,
        plan = EXCLUDED.plan,
        parent_portal_id = EXCLUDED.parent_portal_id,
        filters = EXCLUDED.filters,
        branding = EXCLUDED.branding,
        settings = EXCLUDED.settings;

    SELECT id INTO emory_portal_id
    FROM portals
    WHERE slug = 'emory'
    LIMIT 1;

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
        WHERE s.slug IN (
            'dekalb-public-health',
            'piedmont-classes',
            'piedmont-fitness',
            'piedmont-healthcare',
            'piedmont-transplant',
            'piedmont-womens-heart'
        )
        ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE
        SET
            subscription_scope = 'all',
            subscribed_categories = NULL,
            is_active = true;
    END IF;
END $$;

REFRESH MATERIALIZED VIEW portal_source_access;

COMMIT;
