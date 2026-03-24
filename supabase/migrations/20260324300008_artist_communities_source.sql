-- Artist Communities Alliance open calls source registration
--
-- ACA is the field organization for the artist residency sector. Their directory
-- lists 300+ open call listings from member programs worldwide. Individual open
-- call pages are static Drupal HTML discovered via sitemap.
-- Confidence tier: aggregated (ACA is a directory, not the issuing org).
-- Crawler: crawlers/sources/open_calls_artist_communities.py

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'Artist Communities Alliance Directory (Open Calls)',
  'open-calls-artist-communities',
  'scrape',
  'https://artistcommunities.org/directory/open-calls',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
