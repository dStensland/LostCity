-- The Submission Grinder — dominant literary market aggregator.
-- Covers fiction, poetry, and nonfiction submission opportunities worldwide.
-- 19,000+ total markets, ~3,200 currently open for submissions.
-- Uses direct JSON POST to /Search/Byfilter/Search — no Playwright required.
INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'The Submission Grinder',
  'open-calls-submission-grinder',
  'scrape',
  'https://thegrinder.diabolicalplots.com/Search/ByFilter',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
