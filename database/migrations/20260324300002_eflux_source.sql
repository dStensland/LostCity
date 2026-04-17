-- Register e-flux as a source for the Arts portal open calls board.
--
-- e-flux (e-flux.com) is the most widely read art world communication
-- platform globally. Their announcements include a substantial volume of
-- open calls, residency programs, fellowships, grants, and commissions
-- posted directly by institutions worldwide.
--
-- The crawler targets three e-flux categories:
--   - "Call for applications" (~446 articles total, ~287 currently active)
--   - "Fellowship"            (~99 articles)
--   - "Grants"                (~48 articles)
--
-- All calls carry metadata.scope = "international", enabling the two-section
-- board layout (local/regional vs national/international) in the Arts portal.
-- Confidence tier: "aggregated" — e-flux is an announcements platform for
-- the posting institutions, not the primary source.

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'e-flux (Open Calls)',
  'open-calls-eflux',
  'scrape',
  'https://www.e-flux.com/announcements/',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
