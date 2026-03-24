-- Register Artwork Archive as a source for the Arts portal open calls board.
--
-- Artwork Archive (artworkarchive.com/call-for-entry) is an artist portfolio
-- and inventory management platform that also runs a public opportunities
-- board. Organizations list open calls, exhibitions, residencies, grants, and
-- competitions. Because Artwork Archive aggregates calls from many
-- organizations, confidence_tier is "aggregated".
--
-- The site is behind Cloudflare; the crawler uses cloudscraper to bypass it.

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'Artwork Archive (Open Calls)',
  'open-calls-artwork-archive',
  'scrape',
  'https://www.artworkarchive.com/call-for-entry',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
