-- Mirror of database/migrations/459_international_woodworking_fair_source_tuning.sql
DO $$
DECLARE
  atlanta_id UUID;
BEGIN
  SELECT id INTO atlanta_id
  FROM portals
  WHERE slug = 'atlanta';

  IF atlanta_id IS NULL THEN
    RAISE EXCEPTION 'Atlanta portal not found. Cannot tune International Woodworking Fair source.';
  END IF;

  UPDATE festivals
  SET
    website = 'https://iwfatlanta.com/',
    ticket_url = 'https://registration.experientevent.com/ShowIWF261/',
    image_url = 'https://iwfatlanta.com/wp-content/uploads/2026/01/iwf-business-rectangle-8.webp',
    announced_2026 = true,
    announced_start = '2026-08-25',
    announced_end = '2026-08-28',
    description = 'International Woodworking Fair is North America''s largest woodworking technology, machinery, materials, and design trade show, with four days of exhibits and conference programming at Georgia World Congress Center.'
  WHERE slug = 'international-woodworking-fair';

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
    'international-woodworking-fair',
    'International Woodworking Fair',
    'https://iwfatlanta.com/about-iwf/show-schedule/',
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
    owner_portal_id = EXCLUDED.owner_portal_id,
    integration_method = NULL;

  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  SELECT s.id, atlanta_id, 'all'
  FROM sources s
  WHERE s.slug = 'international-woodworking-fair'
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = EXCLUDED.owner_portal_id,
    share_scope = 'all';
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
