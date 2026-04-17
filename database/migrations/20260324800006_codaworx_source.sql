-- Add CODAworx as an open calls source for the Arts portal.
--
-- CODAworx (codaworx.com) is the primary platform for public art commissions,
-- connecting commissioners with artists for paid public art projects. It
-- aggregates RFQs and RFPs from municipalities, arts agencies, developers, and
-- private commissioners worldwide (primarily US and Canada).
--
-- Crawl strategy: JSON API (api.codaworx.com/api/directories/rfp via POST).
-- The site is an Angular SPA — HTML is empty; all listing data comes from the
-- guest-accessible REST API using a public X-Api-Key discovered in the bundle.
--
-- This is the highest-value commission source for the Arts portal:
--   - Almost exclusively paid public art commissions (RFQs/RFPs)
--   - Explicit budgets often stated ($10K - $1.5M+)
--   - ~30-70 active listings at any time
--   - No other open calls aggregator focuses on this niche
--
-- Crawled weekly by: crawlers/sources/open_calls_codaworx.py
-- Confidence tier: aggregated
-- Scope: national (US-focused, some international)

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'CODAworx (Open Calls)',
  'open-calls-codaworx',
  'api',
  'https://www.codaworx.com/directories/opencalls',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  source_type = 'api',
  url = EXCLUDED.url;
