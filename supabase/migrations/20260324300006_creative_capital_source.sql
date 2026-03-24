-- Creative Capital open calls source registration
--
-- Creative Capital is a national nonprofit (est. 1999) providing unrestricted
-- project grants up to $50,000 plus the new State of the Art Prize ($10,000/state).
-- Open calls run approximately every two years. No application fee.
-- Crawler: crawlers/sources/open_calls_creative_capital.py

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'Creative Capital (Open Calls)',
  'open-calls-creative-capital',
  'scrape',
  'https://creative-capital.org/apply',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
