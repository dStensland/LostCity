-- ============================================
-- MIGRATION 411: Atlanta Black Expo Source
-- ============================================
-- Registers the official Atlanta Black Expo homepage as an Atlanta-owned
-- expo source and aligns the festival record with the announced 2026 dates.
-- The source stays inactive until the official site publishes a future cycle.

DO $$
DECLARE
  atlanta_id UUID;
BEGIN
  SELECT id INTO atlanta_id
  FROM portals
  WHERE slug = 'atlanta';

  IF atlanta_id IS NULL THEN
    RAISE EXCEPTION 'Atlanta portal not found. Cannot register Atlanta Black Expo source.';
  END IF;

  INSERT INTO sources (
    slug,
    name,
    url,
    source_type,
    crawl_frequency,
    is_active,
    owner_portal_id
  )
  VALUES (
    'atlanta-black-expo',
    'Atlanta Black Expo',
    'https://atlblackexpo.com/',
    'festival',
    'weekly',
    false,
    atlanta_id
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    source_type = EXCLUDED.source_type,
    crawl_frequency = EXCLUDED.crawl_frequency,
    is_active = EXCLUDED.is_active,
    owner_portal_id = EXCLUDED.owner_portal_id;

  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  SELECT s.id, atlanta_id, 'all'
  FROM sources s
  WHERE s.slug = 'atlanta-black-expo'
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = EXCLUDED.owner_portal_id,
    share_scope = 'all';

  UPDATE festivals
  SET
    website = 'https://atlblackexpo.com/',
    ticket_url = 'https://atlblackexpo.com/tickets',
    image_url = 'https://atlblackexpo.com/wp-content/uploads/2025/07/2026-ABE-STD-Square.png',
    announced_2026 = true,
    announced_start = '2026-02-20',
    announced_end = '2026-02-22'
  WHERE slug = 'atlanta-black-expo';
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
