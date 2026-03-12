-- ============================================
-- MIGRATION 20260311133200: Atlanta Home Show Source Tuning
-- ============================================

DO $$
DECLARE
  atlanta_id UUID;
BEGIN
  SELECT id INTO atlanta_id
  FROM portals
  WHERE slug = 'atlanta';

  IF atlanta_id IS NULL THEN
    RAISE EXCEPTION 'Atlanta portal not found. Cannot tune Atlanta Home Show source.';
  END IF;

  UPDATE sources
  SET
    url = 'https://www.atlantahomeshow.com/attendee-info/show-info',
    integration_method = 'festival_schedule',
    crawl_frequency = 'weekly',
    is_active = true,
    owner_portal_id = atlanta_id
  WHERE slug = 'atlanta-home-show';

  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  SELECT s.id, atlanta_id, 'all'
  FROM sources s
  WHERE s.slug = 'atlanta-home-show'
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = EXCLUDED.owner_portal_id,
    share_scope = 'all';
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
