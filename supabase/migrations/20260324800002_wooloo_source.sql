-- Register Wooloo.org as a source for the Arts portal open calls board.
--
-- Wooloo.org is an international community platform for artist opportunities:
-- open calls, residencies, competitions, grants, and exhibitions. It skews
-- heavily toward European and international calls, complementing ArtRabbit
-- and ArtConnect for the "National & International" section of the Open Calls
-- board.
--
-- Coverage: ~17 publicly accessible listings per crawl (the full catalog is
-- gated behind registration). The crawler captures all listings exposed to
-- anonymous visitors by iterating all 16 paginated index pages via the site's
-- AJAX fragment endpoint and de-duplicating by Wooloo opportunity ID.
--
-- confidence_tier: "aggregated" (Wooloo is not the primary source for any
-- listing — it aggregates calls posted by arts organizations globally).
-- metadata.scope: "international" (enables two-section board layout).

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'Wooloo.org (Open Calls)',
  'open-calls-wooloo',
  'scrape',
  'https://www.wooloo.org/searchindex',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
