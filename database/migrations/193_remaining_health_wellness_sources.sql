-- Migration 193: Register remaining health, wellness, and fitness crawlers
-- Purpose:
--   1) Register 14 unactivated crawlers: public health, fitness, yoga, support groups
--   2) Mark support group sources as sensitive (is_sensitive = true)
--   3) Share non-commercial wellness sources platform-wide
--   4) Subscribe Emory portal to public health + community fitness sources

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
        RAISE EXCEPTION 'Atlanta portal is required before running migration 193';
    END IF;

    -- =========================================================================
    -- 1) PUBLIC HEALTH SOURCES
    -- =========================================================================

    -- AID Atlanta - HIV/STI testing, PrEP, community health
    INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
    VALUES (
        'aid-atlanta',
        'AID Atlanta',
        'https://www.aidatlanta.org/events/',
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

    -- Grady Health Foundation - health equity events, fundraisers
    INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
    VALUES (
        'grady-health',
        'Grady Health Foundation',
        'https://www.gradyhealthfoundation.org',
        'organization',
        'daily',
        true,
        atlanta_portal_id,
        'beautifulsoup'
    )
    ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name,
        url = EXCLUDED.url,
        source_type = EXCLUDED.source_type,
        crawl_frequency = EXCLUDED.crawl_frequency,
        is_active = true,
        owner_portal_id = EXCLUDED.owner_portal_id,
        integration_method = EXCLUDED.integration_method;

    -- Health Walks Atlanta - charity walks (Heart Walk, Relay for Life, etc.)
    INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
    VALUES (
        'health-walks-atlanta',
        'Atlanta Health Walks & Charity Runs',
        'https://www.heart.org/en/affiliates/georgia/atlanta',
        'organization',
        'weekly',
        true,
        atlanta_portal_id,
        'beautifulsoup'
    )
    ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name,
        url = EXCLUDED.url,
        source_type = EXCLUDED.source_type,
        crawl_frequency = EXCLUDED.crawl_frequency,
        is_active = true,
        owner_portal_id = EXCLUDED.owner_portal_id,
        integration_method = EXCLUDED.integration_method;

    -- =========================================================================
    -- 2) FITNESS SOURCES
    -- =========================================================================

    -- BeltLine Fitness - free weekly classes (yoga, Zumba, HIIT, run club)
    INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
    VALUES (
        'beltline-fitness',
        'Atlanta BeltLine Fitness',
        'https://beltline.org/things-to-do/fitness/',
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

    -- =========================================================================
    -- 3) YOGA STUDIOS
    -- =========================================================================

    INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
    VALUES
        ('dancing-dogs-yoga', 'Dancing Dogs Yoga', 'https://www.dancingdogsyoga.com/workshops', 'venue', 'daily', true, atlanta_portal_id, 'playwright'),
        ('evolation-yoga', 'Evolation Yoga', 'https://www.evolationyoga.com/atlanta/events', 'venue', 'daily', true, atlanta_portal_id, 'playwright'),
        ('highland-yoga', 'Highland Yoga', 'https://highland-yoga.com/events-atlanta', 'venue', 'daily', true, atlanta_portal_id, 'playwright'),
        ('yonder-yoga', 'Yonder Yoga', 'https://www.yonderyoga.com/events', 'venue', 'daily', true, atlanta_portal_id, 'playwright'),
        ('vista-yoga', 'Vista Yoga', 'https://www.vistayogaatl.com/workshops', 'venue', 'daily', true, atlanta_portal_id, 'playwright')
    ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name,
        url = EXCLUDED.url,
        source_type = EXCLUDED.source_type,
        crawl_frequency = EXCLUDED.crawl_frequency,
        is_active = true,
        owner_portal_id = EXCLUDED.owner_portal_id,
        integration_method = EXCLUDED.integration_method;

    -- =========================================================================
    -- 4) SUPPORT GROUP / RECOVERY SOURCES (sensitive content)
    -- =========================================================================

    INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, is_sensitive, owner_portal_id, integration_method)
    VALUES
        ('aa-atlanta', 'Alcoholics Anonymous - Atlanta', 'https://atlantaaa.org', 'organization', 'weekly', true, true, atlanta_portal_id, 'rest_api'),
        ('na-georgia', 'Narcotics Anonymous - Georgia', 'https://bmlt.sezf.org/main_server', 'organization', 'weekly', true, true, atlanta_portal_id, 'rest_api'),
        ('griefshare-atlanta', 'GriefShare Atlanta', 'https://find.griefshare.org', 'organization', 'weekly', true, true, atlanta_portal_id, 'playwright'),
        ('divorcecare-atlanta', 'DivorceCare Atlanta', 'https://find.divorcecare.org', 'organization', 'weekly', true, true, atlanta_portal_id, 'playwright')
    ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name,
        url = EXCLUDED.url,
        source_type = EXCLUDED.source_type,
        crawl_frequency = EXCLUDED.crawl_frequency,
        is_active = true,
        is_sensitive = true,
        owner_portal_id = EXCLUDED.owner_portal_id,
        integration_method = EXCLUDED.integration_method;

    -- =========================================================================
    -- 5) SHARING RULES: Share non-commercial health/wellness sources platform-wide
    -- =========================================================================

    INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope, allowed_categories)
    SELECT s.id, atlanta_portal_id, 'all', NULL
    FROM sources s
    WHERE s.slug IN (
        'aid-atlanta',
        'grady-health',
        'health-walks-atlanta',
        'beltline-fitness',
        'aa-atlanta',
        'na-georgia',
        'griefshare-atlanta',
        'divorcecare-atlanta'
    )
    ON CONFLICT (source_id) DO UPDATE
    SET owner_portal_id = EXCLUDED.owner_portal_id,
        share_scope = 'all',
        allowed_categories = NULL,
        updated_at = NOW();

    -- NOTE: Yoga studios are commercial venues, so no platform-wide sharing.
    -- They remain Atlanta-portal-owned but not federated to Emory.

    -- =========================================================================
    -- 6) EMORY SUBSCRIPTIONS: Public health + community fitness (no commercial)
    -- =========================================================================

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
              'aid-atlanta',
              'grady-health',
              'health-walks-atlanta',
              'beltline-fitness'
          )
        ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE
        SET subscription_scope = 'all',
            subscribed_categories = NULL,
            is_active = true;

        -- Keep commercial yoga studios OUT of Emory (competitor/commercial policy)
        UPDATE source_subscriptions ss
        SET is_active = false
        FROM sources s
        WHERE ss.source_id = s.id
          AND ss.subscriber_portal_id = emory_portal_id
          AND s.slug IN (
              'dancing-dogs-yoga',
              'evolation-yoga',
              'highland-yoga',
              'yonder-yoga',
              'vista-yoga'
          );
    END IF;
END $$;

REFRESH MATERIALIZED VIEW portal_source_access;

COMMIT;
