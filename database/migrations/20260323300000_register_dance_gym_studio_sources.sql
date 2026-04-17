-- Register iClassPro and JackRabbit dance/gymnastics studio sources.
--
-- Sources:
--   1. Buckhead Gymnastics Center (iClassPro, Atlanta) — gymnastics classes ages 4–12
--   2. Georgia Gymnastics Academy (JackRabbit, Suwanee) — gymnastics ages 18mo–adult
--   3. Atlanta School of Gymnastics (JackRabbit, Tucker) — gymnastics + tumbling
--   4. Gwinnett School of Dance (JackRabbit, Grayson) — ballet, jazz, lyrical, hip hop
--
-- All owned by atlanta-families portal; shared to atlanta portal.
-- Platform notes:
--   - iClassPro: open API at app.iclasspro.com/api/open/v1/{org_code}/classes
--   - JackRabbit: public OpeningsJS at app.jackrabbitclass.com/jr3.0/Openings/OpeningsJS

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
  -- 1. Buckhead Gymnastics Center (iClassPro)
  -- -------------------------------------------------------------------------
  INSERT INTO sources (
    slug, name, url,
    source_type, crawl_frequency, is_active,
    integration_method, owner_portal_id
  )
  VALUES (
    'buckhead-gymnastics',
    'Buckhead Gymnastics Center',
    'https://portal.iclasspro.com/buckheadgymnastics/classes',
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

  SELECT id INTO src_id FROM sources WHERE slug = 'buckhead-gymnastics';

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
  -- 2. Georgia Gymnastics Academy (JackRabbit, Suwanee)
  -- -------------------------------------------------------------------------
  INSERT INTO sources (
    slug, name, url,
    source_type, crawl_frequency, is_active,
    integration_method, owner_portal_id
  )
  VALUES (
    'georgia-gymnastics-academy',
    'Georgia Gymnastics Academy',
    'https://www.georgiagymnasticsacademy.com',
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

  SELECT id INTO src_id FROM sources WHERE slug = 'georgia-gymnastics-academy';

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
  -- 3. Atlanta School of Gymnastics (JackRabbit, Tucker)
  -- -------------------------------------------------------------------------
  INSERT INTO sources (
    slug, name, url,
    source_type, crawl_frequency, is_active,
    integration_method, owner_portal_id
  )
  VALUES (
    'atlanta-school-of-gymnastics',
    'Atlanta School of Gymnastics',
    'https://atlantaschoolofgymnastics.net',
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

  SELECT id INTO src_id FROM sources WHERE slug = 'atlanta-school-of-gymnastics';

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
  -- 4. Gwinnett School of Dance (JackRabbit, Grayson)
  -- -------------------------------------------------------------------------
  INSERT INTO sources (
    slug, name, url,
    source_type, crawl_frequency, is_active,
    integration_method, owner_portal_id
  )
  VALUES (
    'gwinnett-school-of-dance',
    'Gwinnett School of Dance',
    'https://www.gwinnettschoolofdance.com',
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

  SELECT id INTO src_id FROM sources WHERE slug = 'gwinnett-school-of-dance';

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

  RAISE NOTICE 'Registered 4 dance/gymnastics studio sources (iClassPro + JackRabbit).';
END $$;
