-- ============================================
-- MIGRATION 368: Mister John's Music Summer Camp Source
-- ============================================
-- Official Mister John's Music Atlanta summer camp page.
--
-- Portal strategy:
--   Owner:       hooky
--   Subscribers: atlanta
--
-- Pattern role:
--   Static official arts-camp page with explicit weekly themes, dated sessions,
--   visible ages, hours, and embedded first-party registration.
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
    RAISE EXCEPTION 'Atlanta portal not found. Cannot register Mister John''s Music Summer Camp source.';
  END IF;

  INSERT INTO sources (
    slug, name, url,
    source_type, crawl_frequency, is_active,
    integration_method, owner_portal_id
  )
  VALUES (
    'mister-johns-music-summer-camp',
    'Mister John''s Music Summer Camp',
    'https://misterjohnsmusic.com/summer-camp-atl/',
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

  SELECT id INTO src_id FROM sources WHERE slug = 'mister-johns-music-summer-camp';

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
END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
