-- Register Hyperallergic as an open-calls source for the Arts portal.
--
-- Hyperallergic publishes a monthly roundup post listing 16–27 curated artist
-- opportunities: residencies, fellowships, grants, open calls, and commissions.
-- The crawler fetches the /tag/opportunities/ tag page, identifies the most
-- recent monthly roundup post, and extracts individual listings from the post body.
--
-- Confidence tier: aggregated (Hyperallergic curates other orgs' calls).
-- Scope: national (US and international opportunities).
--
-- Crawler: crawlers/sources/open_calls_hyperallergic.py
-- Table:   open_calls (not events)

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'Hyperallergic (Monthly Opportunities)',
  'open-calls-hyperallergic',
  'scrape',
  'https://hyperallergic.com/tag/opportunities/',
  true,
  'monthly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
