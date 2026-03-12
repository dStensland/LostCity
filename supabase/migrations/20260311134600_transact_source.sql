-- Mirror of database/migrations/461_transact_source.sql
DO $$
DECLARE
  atlanta_id UUID;
BEGIN
  SELECT id INTO atlanta_id
  FROM portals
  WHERE slug = 'atlanta';

  IF atlanta_id IS NULL THEN
    RAISE EXCEPTION 'Atlanta portal not found. Cannot register TRANSACT source.';
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
    'transact',
    'transact',
    'TRANSACT',
    'https://www.transactshow.com/',
    3,
    3,
    'Georgia World Congress Center',
    'Downtown',
    '{technology,learning,markets}',
    false,
    'conference',
    'TRANSACT is a destination payments and fintech conference for issuers, acquirers, merchants, processors, and financial technology operators at Georgia World Congress Center.',
    'https://transactshow.com/register/',
    'https://transactshow.com/wp-content/uploads/2023/11/T26_LogoLockup_WHT_605x182.png',
    true,
    '2026-03-18',
    '2026-03-20',
    'conference',
    '{technology,networking,workshops}',
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
    'transact',
    'TRANSACT',
    'https://www.transactshow.com/',
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
  WHERE s.slug = 'transact'
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = EXCLUDED.owner_portal_id,
    share_scope = 'all';
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
