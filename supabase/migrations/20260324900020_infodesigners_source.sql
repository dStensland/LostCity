INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'InfoDesigners.eu (Design Competitions)',
  'open-calls-infodesigners',
  'scrape',
  'https://www.infodesigners.eu/latest-competitions/1',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
