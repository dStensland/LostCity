-- Register 8 Atlanta gallery exhibition crawlers as sources.
--
-- These sources feed the exhibitions entity type for the Arts portal
-- (Lost City: Arts). Each gallery is a unique venue in Atlanta with
-- an active exhibition program.
--
-- NOTE: exhibitions-atlanta-photography and exhibitions-poem88 have
-- domain/site issues as of 2026-03-25 and return 0 results until
-- their new web presence is identified. is_active=false for those two.

INSERT INTO sources (name, slug, source_type, url, is_active, crawl_frequency, owner_portal_id)
VALUES
  (
    'MOCA GA (Exhibitions)',
    'exhibitions-moca-ga',
    'scrape',
    'https://www.mocaga.org',
    true,
    'weekly',
    (SELECT id FROM portals WHERE slug = 'arts-atlanta')
  ),
  (
    'Atlanta Center for Photography (Exhibitions)',
    'exhibitions-atlanta-photography',
    'scrape',
    'https://www.atlantaphotography.org',
    false,
    'weekly',
    (SELECT id FROM portals WHERE slug = 'arts-atlanta')
  ),
  (
    'Besharat Contemporary (Exhibitions)',
    'exhibitions-besharat',
    'scrape',
    'https://www.besharatcontemporary.com',
    true,
    'weekly',
    (SELECT id FROM portals WHERE slug = 'arts-atlanta')
  ),
  (
    'ZuCot Gallery (Exhibitions)',
    'exhibitions-zucot',
    'scrape',
    'https://www.zucotgallery.com',
    true,
    'weekly',
    (SELECT id FROM portals WHERE slug = 'arts-atlanta')
  ),
  (
    'Poem 88 (Exhibitions)',
    'exhibitions-poem88',
    'scrape',
    'http://www.poem88.com',
    false,
    'weekly',
    (SELECT id FROM portals WHERE slug = 'arts-atlanta')
  ),
  (
    'Hathaway Contemporary Gallery (Exhibitions)',
    'exhibitions-hathaway',
    'scrape',
    'https://www.hathawaygallery.com',
    true,
    'weekly',
    (SELECT id FROM portals WHERE slug = 'arts-atlanta')
  ),
  (
    'Mason Fine Art (Exhibitions)',
    'exhibitions-mason-fine-art',
    'scrape',
    'https://masonfineartandevents.com',
    true,
    'weekly',
    (SELECT id FROM portals WHERE slug = 'arts-atlanta')
  ),
  (
    'Alan Avery Art Company (Exhibitions)',
    'exhibitions-alan-avery',
    'scrape',
    'https://www.alanaveryartcompany.com',
    true,
    'weekly',
    (SELECT id FROM portals WHERE slug = 'arts-atlanta')
  )
ON CONFLICT (slug) DO UPDATE SET
  is_active = EXCLUDED.is_active,
  url = EXCLUDED.url,
  owner_portal_id = EXCLUDED.owner_portal_id;
