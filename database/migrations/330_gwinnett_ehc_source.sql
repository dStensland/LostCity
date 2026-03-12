-- ============================================
-- MIGRATION 330: Gwinnett Environmental & Heritage Center Source
-- ============================================
-- The Gwinnett Environmental & Heritage Center (GEHC) is a 102-acre
-- nature/heritage education campus in Buford, GA operated by Gwinnett
-- County Parks & Recreation. It offers:
--   - Nature programs: hikes, birding, wildlife encounters, astronomy
--   - Heritage programs: historic home tours, Civil War homeschool days
--   - Family events: scavenger hunts, festival days, Stop 'N' Play
--   - Camps: spring break camps, summer adventure camps
--   - STEAM programs: RoboThink robotics, science workshops
--
-- Data source: rec1.com (CivicRec) — Gwinnett County's parks registration platform
-- Access: requests + BeautifulSoup (JSON API, no Playwright required)
-- Event types: dated programs, camps, nature walks, family events
-- Expected yield: 30-70 future events per crawl run (seasonal)
--
-- Portal strategy:
--   Owner:       hooky (primary — family/education programming is core Hooky content)
--   Subscribers: atlanta (family events feed into Atlanta consumer portal)
--
-- Note: gwinnett-parks-rec covers the full Gwinnett rec1 catalog across all 40+
-- parks. This source focuses exclusively on the EHC facility, filtering by location
-- so the higher-quality program descriptions and age-band data are captured.
-- ============================================

DO $$
DECLARE
  hooky_id    UUID;
  atlanta_id  UUID;
  src_id      INTEGER;
BEGIN
  SELECT id INTO hooky_id   FROM portals WHERE slug = 'hooky';
  SELECT id INTO atlanta_id FROM portals WHERE slug = 'atlanta';

  IF hooky_id IS NULL THEN
    RAISE EXCEPTION 'Hooky portal not found. Run migration 322 first.';
  END IF;

  IF atlanta_id IS NULL THEN
    RAISE EXCEPTION 'Atlanta portal not found. Cannot register source.';
  END IF;

  -- ---------------------------------------------------------------
  -- 1. Register source
  -- ---------------------------------------------------------------

  INSERT INTO sources (
    slug, name, url,
    source_type, crawl_frequency, is_active,
    integration_method, owner_portal_id
  )
  VALUES (
    'gwinnett-ehc',
    'Gwinnett Environmental & Heritage Center',
    'https://secure.rec1.com/GA/gwinnett-county-parks-recreation/catalog',
    'venue',
    'weekly',
    true,
    'requests',
    hooky_id
  )
  ON CONFLICT (slug) DO UPDATE SET
    name              = EXCLUDED.name,
    url               = EXCLUDED.url,
    owner_portal_id   = EXCLUDED.owner_portal_id,
    integration_method = EXCLUDED.integration_method,
    is_active         = true;

  SELECT id INTO src_id FROM sources WHERE slug = 'gwinnett-ehc';

  RAISE NOTICE 'Registered Gwinnett EHC source (id=%)', src_id;

  -- ---------------------------------------------------------------
  -- 2. Sharing rules — share with all portals
  -- ---------------------------------------------------------------

  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  VALUES (src_id, hooky_id, 'all')
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = EXCLUDED.owner_portal_id,
    share_scope     = 'all';

  RAISE NOTICE 'Sharing rules created for Gwinnett EHC';

  -- ---------------------------------------------------------------
  -- 3. Atlanta subscription — family events from GEHC belong in
  --    the Atlanta consumer portal (family, outdoors, learning)
  -- ---------------------------------------------------------------

  INSERT INTO source_subscriptions (
    subscriber_portal_id, source_id, subscription_scope, is_active
  )
  VALUES (atlanta_id, src_id, 'all', true)
  ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
    subscription_scope = 'all',
    is_active          = true;

  RAISE NOTICE 'Atlanta subscribed to Gwinnett EHC';

  -- ---------------------------------------------------------------
  -- 4. Venue record for the EHC campus
  --    The crawler calls get_or_create_venue() with the same slug,
  --    so this record will be matched rather than duplicated.
  -- ---------------------------------------------------------------

  INSERT INTO venues (
    name, slug, address, neighborhood,
    city, state, zip,
    lat, lng,
    venue_type, spot_type,
    website
  )
  VALUES (
    'Gwinnett Environmental & Heritage Center',
    'gwinnett-environmental-heritage-center',
    '2020 Clean Water Dr',
    'Buford',
    'Buford', 'GA', '30519',
    34.0447, -84.0189,
    'park', 'park',
    'https://www.gwinnettcounty.com/government/departments/parks-recreation/parks/gwinnett-environmental-heritage-center'
  )
  ON CONFLICT (slug) DO NOTHING;

  RAISE NOTICE 'Gwinnett EHC venue record created (or already exists)';

END $$;

-- ---------------------------------------------------------------
-- 5. Refresh portal_source_access materialized view
-- ---------------------------------------------------------------
REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;

-- ---------------------------------------------------------------
-- Verification queries (run post-migration to confirm)
-- ---------------------------------------------------------------
-- SELECT s.slug, s.name, s.is_active, p.slug AS owner_portal
-- FROM sources s
-- LEFT JOIN portals p ON s.owner_portal_id = p.id
-- WHERE s.slug = 'gwinnett-ehc';
--
-- SELECT ss.subscriber_portal_id, p.slug AS subscriber, s.slug AS source
-- FROM source_subscriptions ss
-- JOIN sources s ON ss.source_id = s.id
-- JOIN portals p ON ss.subscriber_portal_id = p.id
-- WHERE s.slug = 'gwinnett-ehc' AND ss.is_active = true;
