-- Register Creative Capital artist opportunities directory as an open-calls source.
--
-- Creative Capital maintains a curated list of ~110 artist opportunities from
-- organizations across the US, paginated across ~5 pages. This source covers
-- the full directory at /artist-resources/artist-opportunities/ — distinct from
-- the existing 'open-calls-creative-capital' source which only tracks Creative
-- Capital's own biennial grant cycle.
--
-- Confidence tier: aggregated (Creative Capital curates other orgs' calls).
-- Scope: national (US opportunities).
-- Deadline handling: rolling deadlines are included with deadline=NULL;
--   specific past deadlines are skipped.
--
-- Crawler: crawlers/sources/open_calls_creative_capital_dir.py
-- Table:   open_calls (not events)

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'Creative Capital (Artist Opportunities Directory)',
  'open-calls-creative-capital-dir',
  'scrape',
  'https://creative-capital.org/artist-resources/artist-opportunities/',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
