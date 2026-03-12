-- ============================================
-- MIGRATION 364: Unconventional Convention Sources
-- ============================================
-- Adds organizer-backed Atlanta / metro convention discovery sources that are
-- useful because they surface niche hobby and industry gatherings before
-- generic consumer listicles do.

DO $$
DECLARE
  atlanta_id UUID;
BEGIN
  SELECT id INTO atlanta_id
  FROM portals
  WHERE slug = 'atlanta';

  IF atlanta_id IS NULL THEN
    RAISE EXCEPTION 'Atlanta portal not found. Cannot register unconventional convention sources.';
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
  SELECT
    seed.slug,
    seed.name,
    seed.url,
    'festival',
    'weekly',
    seed.is_active,
    'festival_schedule',
    atlanta_id
  FROM (
    VALUES
      ('bellpoint-gem-show', 'Bellpoint Gem Show', 'https://bellpointgemshow.com/pages/show-dates', true),
      ('verticon', 'VERTICON', 'https://verticon.org/attendee-faq/', false),
      ('ga-mineral-society-show', 'Georgia Mineral Society Show', 'https://gamineral.org/showmain.html', true),
      ('atlanta-bead-show', 'Atlanta Bead Show', 'https://beadshows.com/georgia-bead-shows/', false)
  ) AS seed(slug, name, url, is_active)
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
  WHERE s.slug IN (
    'bellpoint-gem-show',
    'verticon',
    'ga-mineral-society-show',
    'atlanta-bead-show'
  )
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = EXCLUDED.owner_portal_id,
    share_scope = 'all';
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
