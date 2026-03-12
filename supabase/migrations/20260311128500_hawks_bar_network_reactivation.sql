-- ============================================
-- MIGRATION 327: Reactivate Atlanta Hawks Bar Network
-- ============================================
-- The official Hawks bar-network page now publishes current watch-party and
-- participating-bar data through public JSON feeds.

DO $$
DECLARE
  atlanta_portal_id UUID;
BEGIN
  SELECT id INTO atlanta_portal_id
  FROM portals
  WHERE slug = 'atlanta'
  LIMIT 1;

  IF atlanta_portal_id IS NULL THEN
    RAISE NOTICE 'Atlanta portal not found. Skipping Atlanta Hawks Bar Network reactivation.';
    RETURN;
  END IF;

  INSERT INTO sources (
    slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method
  )
  VALUES (
    'hawks-bars',
    'Atlanta Hawks Bar Network',
    'https://www.nba.com/hawks/barnetwork',
    'organization',
    'weekly',
    true,
    atlanta_portal_id,
    'python'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    source_type = EXCLUDED.source_type,
    crawl_frequency = EXCLUDED.crawl_frequency,
    is_active = EXCLUDED.is_active,
    owner_portal_id = EXCLUDED.owner_portal_id,
    integration_method = EXCLUDED.integration_method;
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
