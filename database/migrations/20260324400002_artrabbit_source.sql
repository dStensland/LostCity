-- Register ArtRabbit as a source for the Arts portal open calls board.
-- ArtRabbit (artrabbit.com/artist-opportunities) is a UK-based international
-- arts platform that curates ~70 hand-picked open calls, commissions,
-- residencies, grants, and prizes for artists, curators, and writers worldwide.
--
-- All calls from this source carry metadata.scope = "international" to enable
-- the two-section board layout (local/regional vs national/international).

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'ArtRabbit (Open Calls)',
  'open-calls-artrabbit',
  'scrape',
  'https://www.artrabbit.com/artist-opportunities',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
