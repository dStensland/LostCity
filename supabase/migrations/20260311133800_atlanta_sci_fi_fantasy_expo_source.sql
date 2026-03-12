-- ============================================
-- MIGRATION 20260311133800: Atlanta Sci-Fi & Fantasy Expo Source
-- ============================================
-- Registers the official Atlanta Sci-Fi & Fantasy Expo source and seeds the
-- matching festival metadata for the current 2026 cycle.

DO $$
DECLARE
  atlanta_id UUID;
BEGIN
  SELECT id INTO atlanta_id
  FROM portals
  WHERE slug = 'atlanta';

  IF atlanta_id IS NULL THEN
    RAISE EXCEPTION 'Atlanta portal not found. Cannot register Atlanta Sci-Fi & Fantasy Expo source.';
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
    price_tier
  )
  VALUES (
    'atlanta-sci-fi-fantasy-expo',
    'atlanta-sci-fi-fantasy-expo',
    'Atlanta Sci-Fi & Fantasy Expo',
    'https://atlantascifiexpo.com/',
    3,
    2,
    'Northlake Mall',
    'Northlake',
    '{conventions,markets,arts}',
    true,
    'convention',
    'Free metro fan convention focused on sci-fi, fantasy, cosplay, gaming, workshops, vendors, and creator community culture.',
    'https://www.eventbrite.com/e/atlanta-sci-fi-and-fantasy-expo-tickets-1969890924784',
    'https://img.evbuc.com/https%3A%2F%2Fcdn.evbuc.com%2Fimages%2F1170912289%2F243711478499%2F1%2Foriginal.20251113-200940?crop=focalpoint&fit=crop&w=1000&auto=format%2Ccompress&q=75&sharp=10&fp-x=0.489&fp-y=0.019&s=9e3bc7e8c2e77b1b098129b8310072ae',
    true,
    '2026-03-14',
    '2026-03-15',
    'convention',
    '{fandom,shopping}',
    'all_ages',
    'mid',
    'indoor',
    'free'
  )
  ON CONFLICT (id) DO UPDATE SET
    website = EXCLUDED.website,
    announced_2026 = EXCLUDED.announced_2026,
    announced_start = EXCLUDED.announced_start,
    announced_end = EXCLUDED.announced_end,
    ticket_url = EXCLUDED.ticket_url,
    image_url = EXCLUDED.image_url,
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
    crawl_frequency,
    is_active,
    owner_portal_id
  )
  VALUES (
    'atlanta-sci-fi-fantasy-expo',
    'Atlanta Sci-Fi & Fantasy Expo',
    'https://atlantascifiexpo.com/',
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
  WHERE s.slug = 'atlanta-sci-fi-fantasy-expo'
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = EXCLUDED.owner_portal_id,
    share_scope = 'all';
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
