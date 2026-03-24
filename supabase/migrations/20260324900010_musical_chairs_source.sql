-- Musical Chairs (composer competitions + courses)
-- Adds ~80 international composer opportunities per crawl run.
-- Opens music composition as a new discipline in open calls coverage.

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'Musical Chairs (Composer Competitions)',
  'open-calls-musical-chairs',
  'scrape',
  'https://www.musicalchairs.info/composer/competitions',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
