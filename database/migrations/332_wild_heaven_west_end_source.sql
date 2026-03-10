-- ============================================
-- Register Wild Heaven West End source
-- ============================================
-- The wild-heaven-west-end crawler was upgraded from a trivia stub
-- to a full events calendar scraper. Needs a source record to run.

DO $$
DECLARE
  atlanta_id  UUID;
  src_id      INTEGER;
BEGIN
  SELECT id INTO atlanta_id FROM portals WHERE slug = 'atlanta';

  IF atlanta_id IS NULL THEN
    RAISE EXCEPTION 'Atlanta portal not found.';
  END IF;

  INSERT INTO sources (
    slug, name, url,
    source_type, crawl_frequency, is_active,
    integration_method, owner_portal_id
  )
  VALUES (
    'wild-heaven-west-end',
    'Wild Heaven West End',
    'https://wildheavenbeer.com/west-end/events',
    'venue',
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

  SELECT id INTO src_id FROM sources WHERE slug = 'wild-heaven-west-end';
  RAISE NOTICE 'Registered Wild Heaven West End source (id=%)', src_id;

  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  VALUES (src_id, atlanta_id, 'all')
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = EXCLUDED.owner_portal_id,
    share_scope     = 'all';

END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
