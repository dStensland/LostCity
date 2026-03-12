-- ============================================
-- MIGRATION 360: Weird Atlanta Festival Sources
-- ============================================
-- Registers long-tail Atlanta / metro festival sources that already have
-- festival records but were missing crawlable source ownership and
-- festival-schedule profile coverage.

DO $$
DECLARE
  atlanta_id UUID;
BEGIN
  SELECT id INTO atlanta_id
  FROM portals
  WHERE slug = 'atlanta';

  IF atlanta_id IS NULL THEN
    RAISE EXCEPTION 'Atlanta portal not found. Cannot register weird festival sources.';
  END IF;

  INSERT INTO sources (
    slug,
    name,
    url,
    source_type,
    crawl_frequency,
    is_active,
    integration_method,
    owner_portal_id
  )
  SELECT
    seed.slug,
    seed.name,
    seed.url,
    'festival',
    'weekly',
    true,
    'festival_schedule',
    atlanta_id
  FROM (
    VALUES
      ('atlanta-fringe-festival', 'Atlanta Fringe Festival', 'https://www.atlantafringe.org'),
      ('monsterama-con', 'Monsterama Con', 'https://monsteramacon.com/monsterama-program-schedule/'),
      ('oddities-curiosities-expo', 'Oddities & Curiosities Expo', 'https://odditiesandcuriositiesexpo.com/schedule-%2F-tickets'),
      ('world-oddities-expo-atlanta', 'World Oddities Expo Atlanta', 'https://worldodditiesexpo.com/atlanta-ga/'),
      ('beltline-lantern-parade', 'Atlanta BeltLine Lantern Parade', 'https://beltline.org/art/lantern-parade/'),
      ('jordancon', 'JordanCon', 'https://www.jordancon.org/activities/programming/'),
      ('repticon-atlanta', 'Repticon Atlanta', 'https://repticon.com/georgia/atlanta'),
      ('southeast-reptile-expo', 'Southeast Reptile Expo', 'https://www.southeastreptileexpo.com'),
      ('atlanta-brick-con', 'Atlanta Brick Con', 'https://atlantabrickcon.com'),
      ('southern-fried-gaming-expo', 'Southern-Fried Gaming Expo', 'https://www.southernfriedgamingexpo.com'),
      ('frolicon', 'Frolicon', 'https://frolicon.com/registration/')
  ) AS seed(slug, name, url)
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    source_type = EXCLUDED.source_type,
    crawl_frequency = EXCLUDED.crawl_frequency,
    is_active = true,
    integration_method = EXCLUDED.integration_method,
    owner_portal_id = EXCLUDED.owner_portal_id;

  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  SELECT s.id, atlanta_id, 'all'
  FROM sources s
  WHERE s.slug IN (
    'atlanta-fringe-festival',
    'monsterama-con',
    'oddities-curiosities-expo',
    'world-oddities-expo-atlanta',
    'beltline-lantern-parade',
    'jordancon',
    'repticon-atlanta',
    'southeast-reptile-expo',
    'atlanta-brick-con',
    'southern-fried-gaming-expo',
    'frolicon'
  )
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = EXCLUDED.owner_portal_id,
    share_scope = 'all';
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
