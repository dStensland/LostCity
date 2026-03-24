-- Source registration for FestHome film festival open calls crawler.
--
-- FestHome (festhome.com) is a global film festival submission platform.
-- Crawls the listing AJAX endpoint + detail pages.
-- call_type="submission", eligibility="International", confidence_tier="aggregated"

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'FestHome (Film Festivals)',
  'open-calls-festhome',
  'scrape',
  'https://www.festhome.com/festivales/listado',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
