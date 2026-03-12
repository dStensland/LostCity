-- ============================================
-- MIGRATION 455: SMU Steel Summit Source
-- ============================================
-- Registers the official summit/venue pages as an Atlanta-owned source and
-- seeds the matching festival metadata.

DO $$
DECLARE
  atlanta_id UUID;
BEGIN
  SELECT id INTO atlanta_id
  FROM portals
  WHERE slug = 'atlanta';

  IF atlanta_id IS NULL THEN
    RAISE EXCEPTION 'Atlanta portal not found. Cannot register SMU Steel Summit source.';
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
    announced_2026,
    announced_start,
    announced_end,
    primary_type,
    experience_tags,
    audience,
    size_tier,
    indoor_outdoor,
    price_tier
  )
  VALUES (
    'smu-steel-summit',
    'smu-steel-summit',
    'SMU Steel Summit',
    'https://smusteelsummit.com/',
    8,
    3,
    'Georgia International Convention Center',
    'College Park',
    '{industry,business,conventions}',
    false,
    'conference',
    'Major North American steel-industry conference focused on analysis, networking, trade, and manufacturing strategy.',
    'http://www.events.crugroup.com/smusteelsummit/register',
    true,
    '2026-08-24',
    '2026-08-26',
    'conference',
    '{networking,business}',
    'adults',
    'major',
    'indoor',
    'premium'
  )
  ON CONFLICT (id) DO UPDATE SET
    website = EXCLUDED.website,
    ticket_url = EXCLUDED.ticket_url,
    announced_2026 = EXCLUDED.announced_2026,
    announced_start = EXCLUDED.announced_start,
    announced_end = EXCLUDED.announced_end,
    description = EXCLUDED.description,
    primary_type = EXCLUDED.primary_type,
    experience_tags = EXCLUDED.experience_tags,
    audience = EXCLUDED.audience,
    size_tier = EXCLUDED.size_tier,
    indoor_outdoor = EXCLUDED.indoor_outdoor,
    price_tier = EXCLUDED.price_tier;

  INSERT INTO sources (
    slug,
    name,
    url,
    source_type,
    integration_method,
    crawl_frequency,
    is_active,
    owner_portal_id
  )
  VALUES (
    'smu-steel-summit',
    'SMU Steel Summit',
    'https://smusteelsummit.com/',
    'festival',
    'festival_schedule',
    'weekly',
    true,
    atlanta_id
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    source_type = EXCLUDED.source_type,
    integration_method = EXCLUDED.integration_method,
    crawl_frequency = EXCLUDED.crawl_frequency,
    is_active = EXCLUDED.is_active,
    owner_portal_id = EXCLUDED.owner_portal_id;

  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  SELECT s.id, atlanta_id, 'all'
  FROM sources s
  WHERE s.slug = 'smu-steel-summit'
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = EXCLUDED.owner_portal_id,
    share_scope = 'all';
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
