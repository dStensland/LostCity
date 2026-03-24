-- Register The Bakery ATL as an open calls source attributed to the Arts portal.
-- crawl_module maps to crawlers/sources/open_calls_bakery_atl.py via auto-discovery.

INSERT INTO sources (name, slug, source_type, url, is_active, owner_portal_id, crawl_module)
SELECT
  'The Bakery ATL (Open Calls)',
  'open-calls-bakery-atl',
  'organization',
  'https://thebakeryatlanta.com/open-calls',
  true,
  id,
  'open_calls_bakery_atl'
FROM portals WHERE slug = 'arts-atlanta'
ON CONFLICT (slug) DO NOTHING;
