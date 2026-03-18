-- Register 404 Day (404day.com) as a new source.
-- Annual free outdoor music festival at Piedmont Park, April 4th.
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency, owner_portal_id)
VALUES (
  '404-day',
  '404 Day Festival',
  'https://404day.com',
  'scrape',
  true,
  'weekly',
  NULL
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url,
  name = EXCLUDED.name;
