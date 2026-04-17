-- Yaddo open calls source registration
--
-- Yaddo is one of the oldest artist residency programs in the US, founded in 1900
-- in Saratoga Springs, NY. Two fixed annual deadlines: January 5 and August 1.
-- Room, board, and studio provided at no cost. $35 application fee (waivable).
-- Crawler: crawlers/sources/open_calls_yaddo.py

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'Yaddo (Open Calls)',
  'open-calls-yaddo',
  'scrape',
  'https://yaddo.org/apply',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
