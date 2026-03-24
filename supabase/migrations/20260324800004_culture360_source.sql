-- Register Culture360 ASEF as an open-calls source for the Arts portal.
--
-- Culture360 is the Asia-Europe Foundation's (ASEF) cultural exchange platform.
-- It publishes ~50-80 active opportunities at any time covering open calls,
-- residencies, and grants focused on cross-cultural exchange between Asia-Pacific
-- and European arts practitioners.
--
-- The crawler uses a two-phase strategy:
--   1. POST-paginated index (3 pages × ~16 cards) to collect listings
--   2. Detail page fetch per listing for description + application URL
--
-- Confidence tier: aggregated (Culture360 curates other organizations' calls).
-- Scope: international (ASEF mandate is Asia-Europe exchange).
--
-- Crawler: crawlers/sources/open_calls_culture360.py
-- Table:   open_calls (not events)

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'Culture360 ASEF (Opportunities)',
  'open-calls-culture360',
  'scrape',
  'https://culture360.asef.org/opportunities/',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
