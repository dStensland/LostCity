-- Migration: add Poets & Writers Literary Magazines as an open-calls source
--
-- Covers two P&W pages:
--   /open-reading-periods         — curated list of currently-accepting magazines
--   /literary_magazines?reading_period_status=1  — full DB filtered to open now
--
-- call_type: "submission" (manuscript submissions to literary journals)
-- Owner:     arts-atlanta portal
-- Frequency: weekly (reading periods change frequently during submission seasons)

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'Poets & Writers (Literary Magazines)',
  'open-calls-pw-magazines',
  'scrape',
  'https://www.pw.org/literary_magazines',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active      = true,
  url            = EXCLUDED.url,
  crawl_frequency = EXCLUDED.crawl_frequency;
