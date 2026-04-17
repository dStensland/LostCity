-- Register Re-Title as a source for the Arts portal open calls board.
--
-- Re-Title (re-title.com/opportunities/) is a UK-based international
-- contemporary art listing platform that has curated open calls, residencies,
-- commissions, grants, fellowships, and prizes for artists and curators since
-- 2007. It hand-selects ~50-100 active listings at any time from arts
-- organizations worldwide.
--
-- Re-Title is NOT the primary source for any listing — it aggregates calls
-- posted by arts organizations globally. confidence_tier is "aggregated".
-- metadata.scope is "international" on all crawled calls, enabling the
-- two-section board layout (local/regional vs national/international).
--
-- Note: re-title.com is behind aggressive Cloudflare bot management. The
-- crawler uses cloudscraper for TLS fingerprint bypass and gracefully skips
-- a run (returning 0,0,0) if the IP is blocked, rather than hard-failing.
--
-- Crawled weekly by: crawlers/sources/open_calls_retitle.py

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'Re-Title (International Open Calls)',
  'open-calls-retitle',
  'scrape',
  'https://www.re-title.com/opportunities/',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
