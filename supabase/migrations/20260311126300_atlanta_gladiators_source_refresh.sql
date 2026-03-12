-- ============================================
-- MIGRATION 334: Refresh Atlanta Gladiators source metadata
-- ============================================
-- Align the existing source with the official homepage-driven Python crawler.

UPDATE sources
SET name = 'Atlanta Gladiators',
    url = 'https://atlantagladiators.com/',
    source_type = 'sports_team',
    crawl_frequency = 'weekly',
    is_active = true,
    integration_method = 'python'
WHERE slug = 'atlanta-gladiators';

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
