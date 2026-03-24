-- Register NYFA Source (New York Foundation for the Arts) as an open calls source
-- for the Arts portal. NYFA Source is one of the most widely used national
-- aggregators for artist opportunities: grants, residencies, fellowships, open
-- calls, competitions, and exhibition proposals.
--
-- Crawl frequency: weekly (board refreshes continuously but most deadlines are
-- weeks to months out; weekly is sufficient to capture new listings promptly).

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'NYFA Source (Open Calls)',
  'open-calls-nyfa',
  'scrape',
  'https://www.nyfa.org/opportunities/',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url,
  crawl_frequency = EXCLUDED.crawl_frequency;
