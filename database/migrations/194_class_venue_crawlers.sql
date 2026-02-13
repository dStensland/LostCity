-- Migration 194: Activate class/enrichment venue crawlers
-- Purpose:
--   1) Activate 6 class venue sources that now have working crawlers
--   2) Deactivate dead venue (Hotlanta Glassblowing - domain expired)
--   3) Share non-commercial class sources platform-wide

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
        RAISE EXCEPTION 'Atlanta portal is required before running migration 194';
    END IF;

    -- Activate sources with working crawlers
    UPDATE sources SET
        is_active = true,
        integration_method = 'rest_api',
        crawl_frequency = 'daily',
        owner_portal_id = atlanta_portal_id
    WHERE slug IN (
        'callanwolde-fine-arts-center',
        'spruill-center-for-the-arts'
    );

    UPDATE sources SET
        is_active = true,
        integration_method = 'playwright',
        crawl_frequency = 'daily',
        owner_portal_id = atlanta_portal_id
    WHERE slug IN (
        'cooks-warehouse',
        'mudfire-pottery-studio',
        'sndbath'
    );

    UPDATE sources SET
        is_active = true,
        integration_method = 'rest_api',
        crawl_frequency = 'daily',
        owner_portal_id = atlanta_portal_id
    WHERE slug = 'mass-collective';

    -- Deactivate dead venue (domain redirects to unrelated site)
    UPDATE sources SET is_active = false
    WHERE slug = 'hotlanta-glassblowing';

    -- Share non-commercial community arts sources platform-wide
    INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope, allowed_categories)
    SELECT s.id, atlanta_portal_id, 'all', NULL
    FROM sources s
    WHERE s.slug IN (
        'callanwolde-fine-arts-center',
        'spruill-center-for-the-arts',
        'sndbath'
    )
    ON CONFLICT (source_id) DO UPDATE
    SET owner_portal_id = EXCLUDED.owner_portal_id,
        share_scope = 'all',
        allowed_categories = NULL,
        updated_at = NOW();
END $$;

REFRESH MATERIALIZED VIEW portal_source_access;

COMMIT;
