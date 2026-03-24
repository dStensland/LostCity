-- Play Submissions Helper — monthly open calls aggregator for playwrights.
-- First theatrical/playwriting source in the open calls corpus.
-- Free page publishes ~35 opportunities per month with direct submit links.
INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'Play Submissions Helper',
  'open-calls-play-submissions',
  'scrape',
  'https://playsubmissionshelper.com/current/',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
