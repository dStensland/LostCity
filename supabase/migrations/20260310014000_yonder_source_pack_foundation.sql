-- ============================================
-- MIGRATION 20260310014000: Yonder Source Pack Foundation
-- ============================================
-- 1. Register the missing crawlable outdoor/adventure sources needed by Yonder
-- 2. Keep ownership with Atlanta so the data enriches the shared network
-- 3. Ensure those sources are shareable to future child portals like Yonder
-- 4. Refresh portal_source_access after source-sharing changes

DO $$
DECLARE
  atlanta_id UUID;
  src RECORD;
  yonder_source_slugs TEXT[] := ARRAY[
    'atlanta-outdoor-club',
    'blk-hiking-club',
    'rei-atlanta',
    'atlanta-parks-rec'
  ];
BEGIN
  SELECT id INTO atlanta_id FROM portals WHERE slug = 'atlanta';

  IF atlanta_id IS NULL THEN
    RAISE NOTICE 'Atlanta portal not found. Skipping.';
    RETURN;
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
  VALUES
    (
      'atlanta-outdoor-club',
      'Atlanta Outdoor Club',
      'https://www.atlantaoutdoorclub.com/event/',
      'organization',
      'daily',
      true,
      'scrape',
      atlanta_id
    ),
    (
      'blk-hiking-club',
      'BLK Hiking Club Atlanta',
      'https://www.blkhikingclub.com/atlanta',
      'organization',
      'daily',
      true,
      'scrape',
      atlanta_id
    ),
    (
      'rei-atlanta',
      'REI Atlanta Classes & Events',
      'https://www.rei.com/events?location=Atlanta%2C+GA',
      'venue',
      'daily',
      true,
      'scrape',
      atlanta_id
    ),
    (
      'atlanta-parks-rec',
      'Atlanta Parks & Recreation',
      'https://www.atlantaga.gov/Home/Components/Calendar/Event/Index',
      'organization',
      'daily',
      true,
      'scrape',
      atlanta_id
    )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    source_type = EXCLUDED.source_type,
    crawl_frequency = EXCLUDED.crawl_frequency,
    is_active = true,
    integration_method = EXCLUDED.integration_method,
    owner_portal_id = atlanta_id;

  FOR src IN
    SELECT id FROM sources WHERE slug = ANY(yonder_source_slugs) AND is_active = true
  LOOP
    INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
    VALUES (src.id, atlanta_id, 'all')
    ON CONFLICT (source_id) DO UPDATE SET
      owner_portal_id = atlanta_id,
      share_scope = 'all';
  END LOOP;

  RAISE NOTICE 'Yonder source foundation registered and shared from Atlanta';
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
