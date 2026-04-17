-- Register CaFE (Call For Entry) as an open calls source for the Arts portal.
-- CaFE is the dominant national platform for artist open calls. Filtered to
-- Southeast region to surface regionally relevant opportunities.

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'CaFE - Call For Entry (Southeast)',
  'open-calls-cafe',
  'scrape',
  'https://artist.callforentry.org/festivals.php',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
