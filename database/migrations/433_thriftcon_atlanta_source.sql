-- ============================================
-- MIGRATION 433: ThriftCon Atlanta Source
-- ============================================
-- Registers the official ThriftCon Atlanta landing page but keeps it inactive
-- until a future cycle is published.

DO $$
DECLARE
  atlanta_id UUID;
BEGIN
  SELECT id INTO atlanta_id
  FROM portals
  WHERE slug = 'atlanta';

  IF atlanta_id IS NULL THEN
    RAISE EXCEPTION 'Atlanta portal not found. Cannot register ThriftCon Atlanta source.';
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
    'thriftcon-atlanta',
    'ThriftCon Atlanta',
    'https://tickets.thriftcon.co/landing/thriftcon-atlanta',
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
  WHERE s.slug = 'thriftcon-atlanta'
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = EXCLUDED.owner_portal_id,
    share_scope = 'all';

  UPDATE festivals
  SET
    website = 'https://tickets.thriftcon.co/landing/thriftcon-atlanta',
    announced_2026 = true,
    announced_start = '2026-02-28',
    announced_end = '2026-02-28'
  WHERE slug = 'thriftcon-atlanta';
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
