-- Register Poets & Writers as an open-calls source for the Arts portal.
--
-- P&W's grants database (pw.org/grants) is a national aggregator of writing
-- contests, prizes, grants, fellowships, and residencies. It is literary-focused
-- (poetry, fiction, creative nonfiction, translation) and crawled weekly.
--
-- Crawler: crawlers/sources/open_calls_pw.py
-- Table:   open_calls (not events)

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'Poets & Writers (Open Calls)',
  'open-calls-pw',
  'scrape',
  'https://www.pw.org/grants',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
