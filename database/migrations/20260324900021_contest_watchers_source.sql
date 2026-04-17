-- Register Contest Watchers as an open calls source for the Arts portal.
--
-- Contest Watchers (contestwatchers.com) is a curated aggregator of creative
-- competitions across visual arts, design, photography, filmmaking,
-- architecture, fashion, industrial design, interior design, multimedia,
-- sculpture, and more. Approximately 51 currently-open contests at any time,
-- refreshed weekly. All competitions are international in scope.
--
-- The WP REST API requires authentication; the crawler scrapes the HTML
-- listing and detail pages directly. Weekly crawl frequency is appropriate
-- given the ~51 contest volume and the site's weekly update cadence.

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'Contest Watchers (Creative Competitions)',
  'open-calls-contest-watchers',
  'scrape',
  'https://www.contestwatchers.com/category/open/',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
