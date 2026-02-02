-- ============================================
-- MIGRATION 096: Visit Decatur Georgia Source
-- ============================================
-- Official Decatur tourism website with community events calendar
-- URL: https://visitdecaturga.com/events/

INSERT INTO sources (
    slug,
    name,
    website,
    description,
    source_type,
    crawl_frequency,
    is_active,
    priority,
    default_city,
    default_state,
    default_neighborhood,
    extraction_method,
    requires_playwright
) VALUES (
    'visit-decatur',
    'Visit Decatur Georgia',
    'https://visitdecaturga.com',
    'Official tourism site for Decatur, Georgia featuring community events, festivals, and activities in Downtown Decatur and surrounding neighborhoods.',
    'tourism',
    'daily',
    true,
    60,  -- Medium-high priority for official tourism site
    'Decatur',
    'GA',
    'Downtown Decatur',
    'playwright',
    true
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    website = EXCLUDED.website,
    description = EXCLUDED.description,
    source_type = EXCLUDED.source_type,
    crawl_frequency = EXCLUDED.crawl_frequency,
    is_active = EXCLUDED.is_active,
    priority = EXCLUDED.priority,
    default_city = EXCLUDED.default_city,
    default_state = EXCLUDED.default_state,
    default_neighborhood = EXCLUDED.default_neighborhood,
    extraction_method = EXCLUDED.extraction_method,
    requires_playwright = EXCLUDED.requires_playwright,
    updated_at = NOW();

-- Update existing events from visitdecaturga.com if any were created before this migration
UPDATE events
SET source_id = (SELECT id FROM sources WHERE slug = 'visit-decatur')
WHERE source_url LIKE '%visitdecaturga.com%'
AND source_id IS NULL;
