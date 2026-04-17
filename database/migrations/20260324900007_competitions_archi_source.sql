-- Source registration for Competitions.archi open calls aggregator.
-- An international directory of ~3,000+ architecture and design competitions.
-- Opens an entirely new discipline (architecture/design) in the open calls board.
INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES (
  'Competitions.archi (Architecture & Design)',
  'open-calls-competitions-archi',
  'scrape',
  'https://competitions.archi/cat/open/',
  true,
  'weekly',
  (SELECT id FROM portals WHERE slug = 'arts-atlanta')
)
ON CONFLICT (slug) DO UPDATE SET
  is_active = true,
  url = EXCLUDED.url;
