-- Add ArtInfoLand as an open calls source for the Arts portal.
-- ArtInfoLand is an Australia-based international aggregator listing ~410 active
-- artist opportunities across grants, residencies, fellowships, scholarships,
-- exhibitions, competitions, and open calls.

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'ArtInfoLand',
  'open-calls-artinfoland',
  'scrape',
  'https://artinfoland.com/opportunities/',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
