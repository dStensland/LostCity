-- 20260322500012_helpatl_wave2_news_sources.sql
-- Wave-2 civic news sources for HelpATL.
--
-- Lower volume but high quality: suburban governance, equity journalism,
-- consumer protection, and civil liberties.
--
-- All sources are created under the Atlanta portal so HelpATL inherits them
-- automatically via its parent_portal_id = Atlanta. Do NOT reassign portal_id
-- for any existing sources.
--
-- ON CONFLICT only updates feed_url and is_active — never portal_id.

BEGIN;

INSERT INTO network_sources (portal_id, name, slug, feed_url, website_url, description, categories)
VALUES
  (
    -- NOTE: 'rough-draft-atlanta' slug already exists, owned by the Atlanta portal
    -- and used for venue editorial mention ingestion (see editorial_ingest.py).
    -- Using '-civic' suffix here to avoid slug collision for the civic news feed version.
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'Rough Draft Atlanta',
    'rough-draft-atlanta-civic',
    'https://roughdraftatlanta.com/feed/',
    'https://roughdraftatlanta.com',
    'Suburban municipal governance — Sandy Springs, Dunwoody, Brookhaven',
    ARRAY['news', 'civic', 'community']
  ),
  (
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'The Atlanta Voice',
    'atlanta-voice',
    'https://theatlantavoice.com/feed/',
    'https://theatlantavoice.com',
    'Community equity, education, local government',
    ARRAY['news', 'civic', 'community']
  ),
  (
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'Georgia Watch',
    'georgia-watch',
    'https://georgiawatch.org/feed/',
    'https://georgiawatch.org',
    'Consumer protection, utility regulation, healthcare affordability',
    ARRAY['news', 'civic', 'politics']
  ),
  (
    (SELECT id FROM portals WHERE slug = 'atlanta'),
    'ACLU of Georgia',
    'aclu-georgia',
    'https://www.acluga.org/en/news/feed',
    'https://www.acluga.org',
    'Civil liberties, legislative tracking, criminal justice',
    ARRAY['news', 'civic', 'politics']
  )
ON CONFLICT (slug) DO UPDATE
SET
  feed_url   = EXCLUDED.feed_url,
  is_active  = true,
  updated_at = now();
-- Intentionally NOT updating portal_id on conflict — existing ownership is preserved.

COMMIT;
