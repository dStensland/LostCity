-- ============================================
-- MIGRATION 337: Refresh Gwinnett Stripers source metadata
-- ============================================
-- Align the existing source with the MiLB API-backed Python crawler.

UPDATE sources
SET name = 'Gwinnett Stripers',
    url = 'https://www.milb.com/gwinnett/schedule',
    source_type = 'sports_team',
    crawl_frequency = 'weekly',
    is_active = true,
    integration_method = 'python'
WHERE slug = 'gwinnett-stripers';

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
