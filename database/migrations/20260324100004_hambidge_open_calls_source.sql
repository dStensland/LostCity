-- Hambidge Center open calls source registration
--
-- The Hambidge Center is the oldest artist residency in the Southeast US,
-- located in Rabun Gap, North Georgia. Three application cycles per year.
-- Crawler: crawlers/sources/open_calls_hambidge.py

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'Hambidge Center (Open Calls)',
  'open-calls-hambidge',
  'scrape',
  'https://www.hambidge.org/residency',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
