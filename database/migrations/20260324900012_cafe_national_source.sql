-- Register CaFE (Call For Entry) national open calls source for the Arts portal.
-- This is the national complement to open-calls-cafe (Southeast only). It hits
-- the same AJAX endpoint but with no region filter, returning all 348+ open
-- calls from across the US and internationally eligible submissions.
--
-- Dedup note: calls that appear in both crawlers are caught by content-hash
-- dedup in insert_open_call() and updated in place, never double-inserted.

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'CaFE - Call For Entry (National)',
  'open-calls-cafe-national',
  'scrape',
  'https://artist.callforentry.org/festivals.php',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
