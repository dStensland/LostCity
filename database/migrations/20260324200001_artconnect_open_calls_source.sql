-- Register ArtConnect as a source for the Arts portal open calls board.
-- ArtConnect (artconnect.com/opportunities) is a large international aggregator
-- of artist opportunities: open calls, residencies, commissions, grants,
-- fellowships, and awards. It populates the "National & International" section
-- of the Arts portal Open Calls board.
--
-- metadata.scope = "international" on every call from this source enables the
-- two-section board layout (local/regional vs national/international).

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'ArtConnect (Open Calls)',
  'open-calls-artconnect',
  'scrape',
  'https://www.artconnect.com/opportunities',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
