-- Subscribe HelpATL to DeKalb Library and move ownership to atlanta portal.

DO $$
DECLARE
  helpatl_id UUID;
  atlanta_id UUID;
  support_id UUID;
  src RECORD;
BEGIN
  SELECT id INTO helpatl_id FROM portals WHERE slug = 'helpatl';
  SELECT id INTO atlanta_id FROM portals WHERE slug = 'atlanta';
  SELECT id INTO support_id FROM portals WHERE slug = 'atlanta-support';

  -- Move dekalb-library from atlanta-support to atlanta
  UPDATE sources SET owner_portal_id = atlanta_id
  WHERE slug = 'dekalb-library' AND owner_portal_id = support_id;

  UPDATE events SET portal_id = atlanta_id
  WHERE source_id = (SELECT id FROM sources WHERE slug = 'dekalb-library')
    AND portal_id = support_id;

  -- Ensure sharing rule exists for dekalb-library
  INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
  SELECT id, atlanta_id, 'all'
  FROM sources WHERE slug = 'dekalb-library'
  ON CONFLICT (source_id) DO UPDATE SET share_scope = 'all', owner_portal_id = atlanta_id;

  -- Subscribe HelpATL to dekalb-library
  FOR src IN SELECT id FROM sources WHERE slug = 'dekalb-library'
  LOOP
    INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
    VALUES (helpatl_id, src.id, 'all', true)
    ON CONFLICT (subscriber_portal_id, source_id) DO UPDATE SET
      subscription_scope = 'all', is_active = true;
  END LOOP;

  -- Refresh materialized view
  REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
END $$;
