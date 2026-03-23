-- Subscribe HelpATL to existing civic sources from atlanta-support and atlanta portals
-- These sources already produce events; HelpATL just needs subscriptions.

DO $$
DECLARE
  helpatl_id UUID;
  src RECORD;
  civic_slugs TEXT[] := ARRAY[
    -- From atlanta-support portal: mental health & peer support
    'griefshare-atlanta',
    'dbsa-atlanta',
    'cancer-support-community-atl',
    'divorcecare-atlanta',
    'mha-georgia',
    'nami-georgia',
    -- From atlanta-support portal: community services
    'food-well-alliance',
    'city-of-refuge',
    'wrcdv',
    'empowerline',
    'vetlanta',
    'dekalb-public-health',
    -- From atlanta portal: libraries (highest single-source ROI)
    'fulton-library',
    -- From atlanta portal: community programs
    'ymca-atlanta',
    -- From atlanta portal: youth volunteering
    'pebble-tossers'
  ];
BEGIN
  SELECT id INTO helpatl_id FROM portals WHERE slug = 'helpatl';
  IF helpatl_id IS NULL THEN
    RAISE EXCEPTION 'HelpATL portal not found';
  END IF;

  FOR src IN
    SELECT s.id, s.slug, s.owner_portal_id
    FROM sources s
    WHERE s.slug = ANY(civic_slugs)
      AND s.is_active = true
  LOOP
    -- Ensure sharing rule exists (owner shares with scope 'all')
    -- ON CONFLICT only updates share_scope, never changes owner_portal_id
    INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
    VALUES (src.id, src.owner_portal_id, 'all')
    ON CONFLICT (source_id) DO UPDATE SET
      share_scope = 'all';

    -- Subscribe HelpATL
    INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
    VALUES (helpatl_id, src.id, 'all', true)
    ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
      subscription_scope = 'all',
      is_active = true;

    RAISE NOTICE 'Subscribed HelpATL to source: % (id: %)', src.slug, src.id;
  END LOOP;
END $$;

-- Refresh the materialized view so queries pick up new subscriptions
REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
