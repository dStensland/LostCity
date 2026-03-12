-- ============================================
-- MIGRATION 360: Big Blue Swim Johns Creek Source
-- ============================================
-- Official Big Blue Swim School Johns Creek recurring lesson inventory.
--
-- Portal strategy:
--   Owner:       hooky
--   Subscribers: atlanta
--
-- Pattern role:
--   Swim/location recurring-program implementation backed by public lesson-tier
--   cards and enrollment preview links.
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
    RAISE EXCEPTION 'Atlanta portal not found. Cannot register Big Blue source.';
  END IF;

  INSERT INTO sources (
    slug, name, url,
    source_type, crawl_frequency, is_active,
    integration_method, owner_portal_id
  )
  VALUES (
    'big-blue-swim-johns-creek',
    'Big Blue Swim Johns Creek',
    'https://bigblueswimschool.com/locations/georgia/johns-creek/',
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

  SELECT id INTO src_id FROM sources WHERE slug = 'big-blue-swim-johns-creek';

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
    'Big Blue Swim School - Johns Creek, GA',
    'big-blue-swim-school-johns-creek',
    '10955 Jones Bridge Rd.',
    'Johns Creek',
    'Johns Creek',
    'GA',
    '30022',
    'fitness_center',
    'fitness',
    'https://bigblueswimschool.com/locations/georgia/johns-creek/',
    'Indoor swim school in Johns Creek offering recurring baby, child, adaptive, and drop-in swim lessons.'
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
