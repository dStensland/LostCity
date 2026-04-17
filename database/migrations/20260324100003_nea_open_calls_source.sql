INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'National Endowment for the Arts (Open Calls)',
  'open-calls-nea',
  'scrape',
  'https://www.arts.gov/grants',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
