-- ============================================
-- MIGRATION 463: Hinman Dental Meeting Source
-- ============================================
-- Registers the official Hinman organizer source and seeds the matching 2026
-- Atlanta conference metadata.

DO $$
DECLARE
  atlanta_id UUID;
BEGIN
  SELECT id INTO atlanta_id
  FROM portals
  WHERE slug = 'atlanta';

  IF atlanta_id IS NULL THEN
    RAISE EXCEPTION 'Atlanta portal not found. Cannot register Hinman source.';
  END IF;

  INSERT INTO festivals (
    id,
    slug,
    name,
    website,
    typical_month,
    typical_duration_days,
    location,
    neighborhood,
    categories,
    free,
    festival_type,
    description,
    ticket_url,
    image_url,
    announced_2026,
    announced_start,
    announced_end,
    primary_type,
    experience_tags,
    audience,
    size_tier,
    indoor_outdoor,
    price_tier,
    portal_id
  )
  VALUES (
    'hinman-dental-meeting',
    'hinman-dental-meeting',
    'The Thomas P. Hinman Dental Meeting',
    'https://www.hinman.org/',
    3,
    3,
    'Georgia World Congress Center',
    'Downtown',
    '{learning,markets,health}',
    false,
    'conference',
    'The Thomas P. Hinman Dental Meeting is a destination dental conference for continuing education, exhibits, practice innovation, and professional networking in Atlanta.',
    'https://www.prereg.net/2026/hd',
    'https://www.prereg.net/2026/hd/imagesLocal/logoFull.jpg',
    true,
    '2026-03-12',
    '2026-03-14',
    'conference',
    '{healthcare,networking,workshops}',
    'industry',
    'major',
    'indoor',
    'premium',
    atlanta_id
  )
  ON CONFLICT (id) DO UPDATE SET
    website = EXCLUDED.website,
    ticket_url = EXCLUDED.ticket_url,
    image_url = EXCLUDED.image_url,
    announced_2026 = EXCLUDED.announced_2026,
    announced_start = EXCLUDED.announced_start,
    announced_end = EXCLUDED.announced_end,
    description = EXCLUDED.description,
    primary_type = EXCLUDED.primary_type,
    experience_tags = EXCLUDED.experience_tags,
    audience = EXCLUDED.audience,
    size_tier = EXCLUDED.size_tier,
    indoor_outdoor = EXCLUDED.indoor_outdoor,
    price_tier = EXCLUDED.price_tier,
    portal_id = EXCLUDED.portal_id;

  INSERT INTO sources (
    slug,
    name,
    url,
    source_type,
    crawl_frequency,
    is_active,
    owner_portal_id
  )
  VALUES (
    'hinman-dental-meeting',
    'The Thomas P. Hinman Dental Meeting',
    'https://www.hinman.org/',
    'festival',
    'weekly',
    true,
    atlanta_id
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    source_type = EXCLUDED.source_type,
    crawl_frequency = EXCLUDED.crawl_frequency,
    is_active = EXCLUDED.is_active,
    owner_portal_id = EXCLUDED.owner_portal_id;

  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  SELECT s.id, atlanta_id, 'all'
  FROM sources s
  WHERE s.slug = 'hinman-dental-meeting'
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = EXCLUDED.owner_portal_id,
    share_scope = 'all';
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
