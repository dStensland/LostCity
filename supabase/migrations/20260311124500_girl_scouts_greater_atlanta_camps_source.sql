-- ============================================
-- MIGRATION 366: Girl Scouts Greater Atlanta Camps Source
-- ============================================
-- Official Girl Scouts of Greater Atlanta summer camp inventory.
--
-- Portal strategy:
--   Owner:       hooky
--   Subscribers: atlanta
--
-- Pattern role:
--   Official camp network using public WordPress REST inventory and detail-page
--   session tables.
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
    RAISE EXCEPTION 'Atlanta portal not found. Cannot register Girl Scouts Greater Atlanta camps source.';
  END IF;

  INSERT INTO sources (
    slug, name, url,
    source_type, crawl_frequency, is_active,
    integration_method, owner_portal_id
  )
  VALUES (
    'girl-scouts-greater-atlanta-camps',
    'Girl Scouts Greater Atlanta Camps',
    'https://girlscoutsummer.com/',
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

  SELECT id INTO src_id FROM sources WHERE slug = 'girl-scouts-greater-atlanta-camps';

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
    'Camp Timber Ridge',
    'camp-timber-ridge',
    '5540 N Allen Rd SE',
    'Mableton',
    'Mableton',
    'GA',
    '30126',
    'campground',
    'outdoors',
    'https://girlscoutsummer.com/timber-ridge-camp/',
    'Girl Scouts of Greater Atlanta camp offering day and sleepaway summer sessions at Camp Timber Ridge.'
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

  INSERT INTO venues (
    name, slug, address, neighborhood, city, state, zip,
    venue_type, spot_type, website, description
  )
  VALUES (
    'Camp Meriwether',
    'camp-meriwether',
    '653 Meadows Boone Rd',
    'Luthersville',
    'Luthersville',
    'GA',
    '30251',
    'campground',
    'outdoors',
    'https://girlscoutsummer.com/meriwether-camp/',
    'Girl Scouts of Greater Atlanta sleepaway camp offering adventure and equestrian summer sessions at Camp Meriwether.'
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
