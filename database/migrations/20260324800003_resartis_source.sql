-- Res Artis open calls source registration.
--
-- Res Artis is the worldwide network of artist residency organizations (600+
-- member orgs, 80+ countries). Their open calls listing aggregates active
-- opportunities from member programs globally — primarily residencies.
--
-- Confidence tier: aggregated (Res Artis is a directory, not the issuing org).
-- Scope: international — all calls are cross-border by nature.
-- Crawler: crawlers/sources/open_calls_resartis.py
--
-- The index page shows ~300-320 current (non-expired) open calls across 2 pages.
-- Detail pages provide ISO-format deadlines and structured application links.

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'Res Artis (Worldwide Artist Residency Network)',
  'open-calls-resartis',
  'scrape',
  'https://resartis.org/open-calls/',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
