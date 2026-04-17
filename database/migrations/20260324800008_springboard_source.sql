-- Add Springboard for the Arts as an open calls source for the Arts portal.
--
-- Springboard for the Arts (springboardforthearts.org) is a St. Paul, MN-based
-- nonprofit arts service organization. Their opportunities board aggregates
-- ~30-70 active listings from Midwest arts organizations — residencies,
-- open calls, grants, fellowships, and artist fair applications. Most listings
-- are Midwest-regional (Minnesota focus) with some national scope.
--
-- Data comes from the WordPress REST API (no auth required):
--   /wp-json/wp/v2/opportunities?per_page=100&acf_format=standard
--
-- Crawled weekly by: crawlers/sources/open_calls_springboard.py
-- Confidence tier: aggregated (listings originate with third-party organizations)
-- Geographic scope: national (Midwest-regional primary, national secondary)

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'Springboard for the Arts (Open Calls)',
  'open-calls-springboard',
  'scrape',
  'https://springboardforthearts.org/resources/opportunities/',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
