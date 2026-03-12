-- ============================================
-- MIGRATION 329: College Park Skyhawks Schedule Source
-- ============================================
-- Official College Park Skyhawks 2025-26 home schedule, attributed to the
-- team's first-party schedule release.

DO $$
DECLARE
  atlanta_portal_id UUID;
BEGIN
  SELECT id INTO atlanta_portal_id
  FROM portals
  WHERE slug = 'atlanta'
  LIMIT 1;

  IF atlanta_portal_id IS NULL THEN
    RAISE NOTICE 'Atlanta portal not found. Skipping College Park Skyhawks source registration.';
    RETURN;
  END IF;

  INSERT INTO sources (
    slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method
  )
  VALUES (
    'college-park-skyhawks',
    'College Park Skyhawks',
    'https://cpskyhawks.gleague.nba.com/news/college-park-skyhawks-announce-2025-26-season-schedule',
    'sports_team',
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
