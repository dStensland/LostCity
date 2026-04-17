-- Register Foundation for Contemporary Arts (FCA) as an open calls source.
--
-- FCA Emergency Grants is the only FCA program open for direct application.
-- Grants to Artists (nomination), Creative Research Grants (invitation), and
-- the Ellsworth Kelly Award (invitation) are excluded.
--
-- Owned by the arts-atlanta portal. Crawled weekly — program details are
-- stable and the deadline is rolling, so high frequency adds no value.

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'Foundation for Contemporary Arts (Open Calls)',
  'open-calls-fca',
  'scrape',
  'https://www.foundationforcontemporaryarts.org/grants',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
