-- Migration 209: Register public health & mental health sources
-- Sources: shepherd-center, northside-health-fairs, cancer-support-community-atlanta
-- Already registered: dbsa-atlanta (907), ridgeview-institute (908), skyland-trail (909), chris-180 (910)
-- Subscribe all 7 to emory-demo portal

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
        RAISE EXCEPTION 'Atlanta portal is required before running migration 209';
    END IF;

    -- Register shepherd-center (The Events Calendar REST API)
    INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
    VALUES ('shepherd-center', 'Shepherd Center', 'https://www.shepherd.org/events/', 'organization', 'daily', true, atlanta_portal_id, 'rest_api')
    ON CONFLICT (slug) DO UPDATE SET is_active = true, owner_portal_id = EXCLUDED.owner_portal_id;

    -- Register northside-health-fairs (Playwright scraper)
    INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
    VALUES ('northside-health-fairs', 'Northside Hospital Health Fairs', 'https://www.northside.com/events', 'organization', 'weekly', true, atlanta_portal_id, 'playwright')
    ON CONFLICT (slug) DO UPDATE SET is_active = true, owner_portal_id = EXCLUDED.owner_portal_id;

    -- Register cancer-support-community-atlanta (Playwright/Gnosis scraper)
    INSERT INTO sources (slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method)
    VALUES ('cancer-support-community-atlanta', 'Cancer Support Community Atlanta', 'https://cscatl.gnosishosting.net/Events/Calendar', 'organization', 'weekly', true, atlanta_portal_id, 'playwright')
    ON CONFLICT (slug) DO UPDATE SET is_active = true, owner_portal_id = EXCLUDED.owner_portal_id;

    -- Ensure existing sources have correct owner_portal_id
    UPDATE sources SET owner_portal_id = atlanta_portal_id
    WHERE slug IN ('dbsa-atlanta', 'ridgeview-institute', 'skyland-trail', 'chris-180')
      AND (owner_portal_id IS NULL OR owner_portal_id != atlanta_portal_id);

    -- Share all 7 sources platform-wide
    INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope, allowed_categories)
    SELECT s.id, atlanta_portal_id, 'all', NULL
    FROM sources s
    WHERE s.slug IN (
        'shepherd-center', 'northside-health-fairs', 'cancer-support-community-atlanta',
        'dbsa-atlanta', 'ridgeview-institute', 'skyland-trail', 'chris-180'
    )
    ON CONFLICT (source_id) DO UPDATE SET share_scope = 'all', updated_at = NOW();

    -- Subscribe emory-demo portal to all 7 sources
    INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, subscribed_categories, is_active)
    SELECT p.id, s.id, 'all', NULL, true
    FROM portals p
    JOIN sources s ON s.slug IN (
        'shepherd-center', 'northside-health-fairs', 'cancer-support-community-atlanta',
        'dbsa-atlanta', 'ridgeview-institute', 'skyland-trail', 'chris-180'
    )
    WHERE p.slug IN ('emory-demo', 'emory-test', 'emory')
    ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET is_active = true;
END $$;

-- Refresh materialized view to make sources available immediately
REFRESH MATERIALIZED VIEW portal_source_access;

COMMIT;
