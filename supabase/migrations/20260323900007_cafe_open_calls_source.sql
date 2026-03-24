-- Register CaFE (Call For Entry) as an open calls source for the Arts portal.
--
-- CaFE is the dominant national platform for artist open calls. This source
-- is filtered to the Southeast region (AL, AR, DE, FL, GA, KY, MD, MS, NC,
-- SC, TN, WV) to surface regionally relevant opportunities for Georgia artists.
--
-- Confidence tier: "aggregated" — CaFE is an aggregator, not a primary source.
-- Crawl module: open_calls_cafe

INSERT INTO sources (name, slug, source_type, url, is_active, owner_portal_id, crawl_module)
SELECT
  'CaFE - Call For Entry (Georgia)',
  'open-calls-cafe',
  'aggregator',
  'https://artist.callforentry.org/festivals.php',
  true,
  id,
  'open_calls_cafe'
FROM portals WHERE slug = 'arts-atlanta'
ON CONFLICT (slug) DO NOTHING;
