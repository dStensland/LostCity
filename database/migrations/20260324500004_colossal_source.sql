-- Register Colossal as an open-calls source for the Arts portal.
--
-- Colossal (thisiscolossal.com) publishes monthly opportunity roundup posts
-- listing ~25–40 curated artist opportunities: open calls, grants, fellowships,
-- and residencies. Posts are titled "Month YYYY Opportunities: Open Calls,
-- Residencies, and Grants for Artists" and published near the end of each month.
--
-- The crawler fetches the /category/opportunities/ page, identifies the most
-- recent monthly roundup post by title pattern, fetches that post, and extracts
-- individual listings from the body (div.entry-content paragraphs).
--
-- Crawl frequency: monthly — one new post per month, published end of month.
--
-- Confidence tier: aggregated (Colossal curates other orgs' calls).
-- Scope: national + international (listings span U.S. and international calls).
--
-- Crawler: crawlers/sources/open_calls_colossal.py
-- Table:   open_calls (not events)

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'Colossal (Monthly Opportunities)',
  'open-calls-colossal',
  'scrape',
  'https://www.thisiscolossal.com/category/opportunities/',
  true,
  'monthly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
