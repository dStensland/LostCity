-- ============================================
-- MIGRATION 313: Refresh Big Peach Running Source Metadata
-- ============================================
-- Point Big Peach Running Co at the official social group-runs page.

UPDATE sources
SET
  url = 'https://www.bigpeachrunningco.com/group-runs/',
  crawl_frequency = 'weekly',
  integration_method = 'python',
  is_active = true
WHERE slug = 'big-peach-running';

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
