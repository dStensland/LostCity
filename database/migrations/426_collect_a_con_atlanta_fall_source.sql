-- ============================================
-- MIGRATION 426: Collect-A-Con Atlanta (Fall) Source
-- ============================================
-- Adds the official Atlanta fall page as an Atlanta-owned convention source
-- and updates the festival metadata to the current 2026 cycle.

DO $$
DECLARE
  atlanta_id UUID;
BEGIN
  SELECT id INTO atlanta_id
  FROM portals
  WHERE slug = 'atlanta';

  IF atlanta_id IS NULL THEN
    RAISE EXCEPTION 'Atlanta portal not found. Cannot register Collect-A-Con Atlanta (Fall) source.';
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
    'collect-a-con-atlanta-fall',
    'Collect-A-Con Atlanta (Fall)',
    'https://collectaconusa.com/atlanta-2/',
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
  WHERE s.slug = 'collect-a-con-atlanta-fall'
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = EXCLUDED.owner_portal_id,
    share_scope = 'all';

  UPDATE festivals
  SET
    website = 'https://collectaconusa.com/atlanta-2/',
    ticket_url = 'https://www.universe.com/events/collect-a-con-atlanta-2-ga-tickets-WHVL4T?unii-trigger-open=WHVL4T',
    image_url = 'https://collectaconusa.com/wp-content/uploads/2025/11/SHOW21-SEP-26-27-2026_ATLANTA_2.png',
    location = 'Georgia World Congress Center',
    neighborhood = 'Downtown',
    announced_2026 = true,
    announced_start = '2026-09-26',
    announced_end = '2026-09-27'
  WHERE slug = 'collect-a-con-atlanta-fall';
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
