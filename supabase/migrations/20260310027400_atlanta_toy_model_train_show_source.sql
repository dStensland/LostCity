-- ============================================
-- MIGRATION 20260310027400: Atlanta Toy and Model Train Show Source
-- ============================================
-- Adds the official Train Collectors Association event page for the
-- Terminus Chapter Toy and Model Train Show as an Atlanta-owned
-- unconventional convention source.

DO $$
DECLARE
  atlanta_id UUID;
BEGIN
  SELECT id INTO atlanta_id
  FROM portals
  WHERE slug = 'atlanta';

  IF atlanta_id IS NULL THEN
    RAISE EXCEPTION 'Atlanta portal not found. Cannot register Atlanta Toy and Model Train Show source.';
  END IF;

  INSERT INTO sources (
    slug,
    name,
    url,
    source_type,
    crawl_frequency,
    is_active,
    integration_method,
    owner_portal_id
  )
  VALUES (
    'atlanta-toy-model-train-show',
    'Atlanta Toy & Model Train Show',
    'https://www.tcatrains.org/event/tca-terminus-chapter-meet-7/',
    'festival',
    'weekly',
    true,
    'festival_schedule',
    atlanta_id
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    source_type = EXCLUDED.source_type,
    crawl_frequency = EXCLUDED.crawl_frequency,
    is_active = EXCLUDED.is_active,
    integration_method = EXCLUDED.integration_method,
    owner_portal_id = EXCLUDED.owner_portal_id;

  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  SELECT s.id, atlanta_id, 'all'
  FROM sources s
  WHERE s.slug = 'atlanta-toy-model-train-show'
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = EXCLUDED.owner_portal_id,
    share_scope = 'all';
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
