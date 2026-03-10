-- ============================================
-- MIGRATION 331: West End Comedy Fest Source
-- ============================================
-- West End Comedy Fest is an annual 3-day comedy festival in Atlanta's
-- West End neighborhood. The 5th annual festival (2026) ran March 6-8
-- across two venues: Wild Heaven West End (Garden Room + Lounge) and
-- Plywood Place (933 Lee St SW).
--
-- Data source: westendcomedyfest.com/schedule
-- Access: requests + BeautifulSoup (falls back to hardcoded schedule
--         when live scraping yields no results)
-- Event types: dated comedy shows, festival programming
-- Expected yield: ~16 shows per annual festival window
--
-- Portal strategy:
--   Owner: atlanta (primary consumer portal — local festival, comedy category)
-- ============================================

DO $$
DECLARE
  atlanta_id  UUID;
  src_id      INTEGER;
BEGIN
  SELECT id INTO atlanta_id FROM portals WHERE slug = 'atlanta';

  IF atlanta_id IS NULL THEN
    RAISE EXCEPTION 'Atlanta portal not found. Cannot register source.';
  END IF;

  -- ---------------------------------------------------------------
  -- 1. Register source
  -- ---------------------------------------------------------------

  INSERT INTO sources (
    slug, name, url,
    source_type, crawl_frequency, is_active,
    integration_method, owner_portal_id
  )
  VALUES (
    'west-end-comedy-fest',
    'West End Comedy Fest',
    'https://www.westendcomedyfest.com/schedule',
    'festival',
    'weekly',
    true,
    'beautifulsoup',
    atlanta_id
  )
  ON CONFLICT (slug) DO UPDATE SET
    name               = EXCLUDED.name,
    url                = EXCLUDED.url,
    source_type        = EXCLUDED.source_type,
    integration_method = EXCLUDED.integration_method,
    owner_portal_id    = EXCLUDED.owner_portal_id,
    is_active          = true;

  SELECT id INTO src_id FROM sources WHERE slug = 'west-end-comedy-fest';

  RAISE NOTICE 'Registered West End Comedy Fest source (id=%)', src_id;

  -- ---------------------------------------------------------------
  -- 2. Sharing rules — source is public, share with all portals
  -- ---------------------------------------------------------------

  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  VALUES (src_id, atlanta_id, 'all')
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = EXCLUDED.owner_portal_id,
    share_scope     = 'all';

  RAISE NOTICE 'Sharing rules created for West End Comedy Fest';

END $$;

-- ---------------------------------------------------------------
-- 3. Refresh portal_source_access materialized view
-- ---------------------------------------------------------------
REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;

-- ---------------------------------------------------------------
-- Verification query (run post-migration to confirm)
-- ---------------------------------------------------------------
-- SELECT s.slug, s.name, s.is_active, s.integration_method, p.slug AS owner_portal
-- FROM sources s
-- LEFT JOIN portals p ON s.owner_portal_id = p.id
-- WHERE s.slug = 'west-end-comedy-fest';
