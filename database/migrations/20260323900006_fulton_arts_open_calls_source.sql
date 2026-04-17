-- Register Fulton County Arts & Culture (CFS) as an open calls source for the Arts portal.

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'Fulton County Arts & Culture (Open Calls)',
  'open-calls-fulton-arts',
  'scrape',
  'https://www.fultonarts.org/contract-for-services',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
