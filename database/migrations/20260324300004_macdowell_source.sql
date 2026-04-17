-- MacDowell open calls source registration
--
-- MacDowell is one of the most prestigious artist residency programs in the US,
-- founded in 1907 in Peterborough, NH. Two application cycles per year
-- (Spring/Summer and Fall/Winter). No residency fees; need-based stipends available.
-- Crawler: crawlers/sources/open_calls_macdowell.py

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'MacDowell (Open Calls)',
  'open-calls-macdowell',
  'scrape',
  'https://www.macdowell.org/apply',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
