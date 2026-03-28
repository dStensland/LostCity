-- Register youth sports and suburban parks sources.
-- Sources: Sandy Springs Parks & Rec, Henry County Parks & Rec, i9 Sports Atlanta
-- All owned by the atlanta-families (Hooky) portal with Atlanta base subscription.

DO $$
DECLARE
  hooky_id   UUID;
  atlanta_id UUID;
  src_id     INTEGER;
BEGIN
  SELECT id INTO hooky_id   FROM portals WHERE slug = 'atlanta-families';
  SELECT id INTO atlanta_id FROM portals WHERE slug = 'atlanta';

  IF hooky_id IS NULL THEN
    RAISE EXCEPTION 'atlanta-families portal not found. Run family portal migration first.';
  END IF;

  IF atlanta_id IS NULL THEN
    RAISE EXCEPTION 'Atlanta portal not found.';
  END IF;

  -- -------------------------------------------------------------------------
  -- Sandy Springs Parks & Recreation (Rec1)
  -- -------------------------------------------------------------------------
  INSERT INTO sources (
    slug, name, url,
    source_type, crawl_frequency, is_active,
    integration_method, owner_portal_id
  )
  VALUES (
    'sandy-springs-parks-rec',
    'Sandy Springs Recreation & Parks',
    'https://secure.rec1.com/GA/sandy-springs-ga/catalog',
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

  SELECT id INTO src_id FROM sources WHERE slug = 'sandy-springs-parks-rec';

  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  VALUES (src_id, hooky_id, 'all')
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = EXCLUDED.owner_portal_id,
    share_scope     = EXCLUDED.share_scope;

  INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
  VALUES (atlanta_id, src_id, 'all', true)
  ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
    subscription_scope = EXCLUDED.subscription_scope,
    is_active          = EXCLUDED.is_active;

  -- -------------------------------------------------------------------------
  -- Henry County Parks & Recreation (Rec1)
  -- -------------------------------------------------------------------------
  INSERT INTO sources (
    slug, name, url,
    source_type, crawl_frequency, is_active,
    integration_method, owner_portal_id
  )
  VALUES (
    'henry-county-parks-rec',
    'Henry County Parks & Recreation',
    'https://secure.rec1.com/GA/henry-county-ga/catalog',
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

  SELECT id INTO src_id FROM sources WHERE slug = 'henry-county-parks-rec';

  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  VALUES (src_id, hooky_id, 'all')
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = EXCLUDED.owner_portal_id,
    share_scope     = EXCLUDED.share_scope;

  INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
  VALUES (atlanta_id, src_id, 'all', true)
  ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
    subscription_scope = EXCLUDED.subscription_scope,
    is_active          = EXCLUDED.is_active;

  -- -------------------------------------------------------------------------
  -- i9 Sports Atlanta (multi-franchise youth leagues)
  -- -------------------------------------------------------------------------
  INSERT INTO sources (
    slug, name, url,
    source_type, crawl_frequency, is_active,
    integration_method, owner_portal_id
  )
  VALUES (
    'i9-sports-atlanta',
    'i9 Sports Atlanta',
    'https://www.i9sports.com/atlanta-youth-sports-leagues',
    'organization',
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

  SELECT id INTO src_id FROM sources WHERE slug = 'i9-sports-atlanta';

  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  VALUES (src_id, hooky_id, 'all')
  ON CONFLICT (source_id) DO UPDATE SET
    owner_portal_id = EXCLUDED.owner_portal_id,
    share_scope     = EXCLUDED.share_scope;

  INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
  VALUES (atlanta_id, src_id, 'all', true)
  ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
    subscription_scope = EXCLUDED.subscription_scope,
    is_active          = EXCLUDED.is_active;

END $$;

REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
