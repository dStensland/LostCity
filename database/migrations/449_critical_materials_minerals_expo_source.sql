-- ============================================
-- MIGRATION 449: Critical Materials & Minerals Expo Source
-- ============================================
-- Registers the official organizer attend page as an Atlanta-owned organizer
-- source.

DO $$
DECLARE
  atlanta_id UUID;
BEGIN
  SELECT id INTO atlanta_id
  FROM portals
  WHERE slug = 'atlanta';

  IF atlanta_id IS NULL THEN
    RAISE EXCEPTION 'Atlanta portal not found. Cannot register Critical Materials source.';
  END IF;

  INSERT INTO sources (
    slug,
    name,
    url,
    source_type,
    integration_method,
    crawl_frequency,
    is_active,
    owner_portal_id
  )
  VALUES (
    'critical-materials-minerals-expo',
    'Critical Materials & Minerals Expo',
    'https://criticalmineralsexpona.com/register-attend',
    'festival',
    'festival_schedule',
    'weekly',
    true,
    atlanta_id
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    source_type = EXCLUDED.source_type,
    integration_method = EXCLUDED.integration_method,
    crawl_frequency = EXCLUDED.crawl_frequency,
    is_active = EXCLUDED.is_active,
    owner_portal_id = EXCLUDED.owner_portal_id;

  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  SELECT s.id, atlanta_id, 'all'
  FROM sources s
  WHERE s.slug = 'critical-materials-minerals-expo'
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = EXCLUDED.owner_portal_id,
    share_scope = 'all';
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
