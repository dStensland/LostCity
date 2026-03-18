-- Register 404 Weekend (404weekend.com) as a new source.
-- Multi-day Atlanta festival: parade, block party, gala, 5K, etc.
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency, owner_portal_id)
VALUES (
  '404-weekend',
  '404 Day Weekend',
  'https://404weekend.com',
  'scrape',
  true,
  'weekly',
  NULL
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url,
  name = EXCLUDED.name;
