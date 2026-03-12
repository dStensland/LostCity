-- ============================================
-- MIGRATION 345: Reactivate Vista Yoga
-- ============================================
-- Vista Yoga now publishes a live public "Upcoming Workshops & Events" page on
-- vistayoga.com with dated Mindbody wellness inventory.

DO $$
DECLARE
  atlanta_portal_id UUID;
BEGIN
  SELECT id INTO atlanta_portal_id
  FROM portals
  WHERE slug = 'atlanta'
  LIMIT 1;

  IF atlanta_portal_id IS NULL THEN
    RAISE NOTICE 'Atlanta portal not found. Skipping Vista Yoga reactivation.';
    RETURN;
  END IF;

  INSERT INTO sources (
    slug, name, url, source_type, crawl_frequency, is_active, owner_portal_id, integration_method
  )
  VALUES (
    'vista-yoga',
    'Vista Yoga',
    'https://vistayoga.com/workshops-and-events/upcoming/',
    'venue',
    'weekly',
    true,
    atlanta_portal_id,
    'playwright'
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
