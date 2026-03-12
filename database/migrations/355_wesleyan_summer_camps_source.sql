-- ============================================
-- MIGRATION 355: Wesleyan Summer Camps Source
-- ============================================
-- Official Wesleyan School summer camp offerings hub with server-rendered camp
-- cards, grade/category filters, and CampBrain registration.
--
-- Portal strategy:
--   Owner:       hooky
--   Subscribers: atlanta
--
-- Pattern role:
--   First school summer-hub implementation for family programming.
-- ============================================

DO $$
DECLARE
  hooky_id   UUID;
  atlanta_id UUID;
  src_id     INTEGER;
BEGIN
  SELECT id INTO hooky_id FROM portals WHERE slug = 'hooky';
  SELECT id INTO atlanta_id FROM portals WHERE slug = 'atlanta';

  IF hooky_id IS NULL THEN
    RAISE EXCEPTION 'Hooky portal not found. Run migration 322 first.';
  END IF;

  IF atlanta_id IS NULL THEN
    RAISE EXCEPTION 'Atlanta portal not found. Cannot register Wesleyan source.';
  END IF;

  INSERT INTO sources (
    slug, name, url,
    source_type, crawl_frequency, is_active,
    integration_method, owner_portal_id
  )
  VALUES (
    'wesleyan-summer-camps',
    'Wesleyan Summer Camps',
    'https://www.wesleyanschool.org/camps-clinics/summer-camp-offerings',
    'venue',
    'weekly',
    true,
    'requests',
    hooky_id
  )
  ON CONFLICT (slug) DO UPDATE SET
    name               = EXCLUDED.name,
    url                = EXCLUDED.url,
    source_type        = EXCLUDED.source_type,
    crawl_frequency    = EXCLUDED.crawl_frequency,
    is_active          = EXCLUDED.is_active,
    integration_method = EXCLUDED.integration_method,
    owner_portal_id    = EXCLUDED.owner_portal_id;

  SELECT id INTO src_id FROM sources WHERE slug = 'wesleyan-summer-camps';

  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  VALUES (src_id, hooky_id, 'all')
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = EXCLUDED.owner_portal_id,
    share_scope = EXCLUDED.share_scope;

  INSERT INTO source_subscriptions (
    subscriber_portal_id, source_id, subscription_scope, is_active
  )
  VALUES (atlanta_id, src_id, 'all', true)
  ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
    subscription_scope = EXCLUDED.subscription_scope,
    is_active = EXCLUDED.is_active;

  INSERT INTO venues (
    name, slug, address, neighborhood, city, state, zip,
    venue_type, spot_type, website, description
  )
  VALUES (
    'Wesleyan School',
    'wesleyan-school',
    '5405 Spalding Dr',
    'Peachtree Corners',
    'Peachtree Corners',
    'GA',
    '30092',
    'institution',
    'education',
    'https://www.wesleyanschool.org/',
    'Independent school in Peachtree Corners hosting summer camps, clinics, and youth enrichment programs.'
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    neighborhood = EXCLUDED.neighborhood,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    zip = EXCLUDED.zip,
    venue_type = EXCLUDED.venue_type,
    spot_type = EXCLUDED.spot_type,
    website = EXCLUDED.website,
    description = EXCLUDED.description;
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
