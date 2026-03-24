-- Register The Bakery ATL as an open calls source attributed to the Arts portal.

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'The Bakery ATL (Open Calls)',
  'open-calls-bakery-atl',
  'scrape',
  'https://thebakeryatlanta.com/open-calls',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
