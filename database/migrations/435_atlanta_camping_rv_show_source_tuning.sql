-- ============================================
-- MIGRATION 435: Atlanta Camping & RV Show Source Tuning
-- ============================================
-- Retunes the existing Atlanta Camping & RV Show source to the official
-- show-details page and reactivates it for the published 2027 cycle.

DO $$
DECLARE
  atlanta_id UUID;
BEGIN
  SELECT id INTO atlanta_id
  FROM portals
  WHERE slug = 'atlanta';

  IF atlanta_id IS NULL THEN
    RAISE EXCEPTION 'Atlanta portal not found. Cannot tune Atlanta Camping & RV Show source.';
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
    'atlanta-camping-rv-show',
    'Atlanta Camping & RV Show',
    'https://atlantarvshow.com/our-show/',
    'festival',
    'weekly',
    true,
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
  WHERE s.slug = 'atlanta-camping-rv-show'
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = EXCLUDED.owner_portal_id,
    share_scope = 'all';
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
