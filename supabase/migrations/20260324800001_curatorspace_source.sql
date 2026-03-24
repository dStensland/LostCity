-- Add CuratorSpace as an open calls source for the Arts portal.
--
-- CuratorSpace (curatorspace.com) is a UK-based platform for visual art
-- and curatorial opportunities. Organizations post calls directly through
-- the platform; all submissions go through CuratorSpace's own system.
-- ~95 active listings at any time, sorted by deadline.
--
-- Crawled weekly by: crawlers/sources/open_calls_curatorspace.py
-- Confidence tier: aggregated
-- Scope: international (UK/EU-focused, worldwide submissions accepted)

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'CuratorSpace (UK Open Calls)',
  'open-calls-curatorspace',
  'scrape',
  'https://www.curatorspace.com/opportunities',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
