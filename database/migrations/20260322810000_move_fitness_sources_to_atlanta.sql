-- Move BeltLine Fitness, YMCA Atlanta, and Health Walks from atlanta-support
-- to the main atlanta portal. These are general fitness/wellness content,
-- not support services. They belong in the main feed.
--
-- Existing subscriptions (helpatl, atlanta-families, emory-demo) are preserved.
-- Events get re-attributed to atlanta portal so they appear in the main feed.

DO $$
DECLARE
  atlanta_id UUID;
  support_id UUID;
BEGIN
  SELECT id INTO atlanta_id FROM portals WHERE slug = 'atlanta';
  SELECT id INTO support_id FROM portals WHERE slug = 'atlanta-support';

  IF atlanta_id IS NULL OR support_id IS NULL THEN
    RAISE EXCEPTION 'Portal IDs not found';
  END IF;

  -- Transfer source ownership from atlanta-support to atlanta
  UPDATE sources
  SET owner_portal_id = atlanta_id
  WHERE slug IN ('beltline-fitness', 'ymca-atlanta', 'health-walks-atlanta')
    AND owner_portal_id = support_id;

  -- Re-attribute future events to atlanta portal
  UPDATE events
  SET portal_id = atlanta_id
  WHERE source_id IN (
    SELECT id FROM sources
    WHERE slug IN ('beltline-fitness', 'ymca-atlanta', 'health-walks-atlanta')
  )
  AND portal_id = support_id;

  -- Update sharing rules to reference new owner
  UPDATE source_sharing_rules
  SET owner_portal_id = atlanta_id
  WHERE source_id IN (
    SELECT id FROM sources
    WHERE slug IN ('beltline-fitness', 'ymca-atlanta', 'health-walks-atlanta')
  )
  AND owner_portal_id = support_id;

  -- Refresh materialized view so portal_source_access reflects new ownership
  REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
END $$;
