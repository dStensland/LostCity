-- ============================================
-- MIGRATION 293: HelpATL Civic Source Federation
-- ============================================
-- Move civic/volunteer source ownership from Atlanta to HelpATL.
-- Set up sharing rules so Atlanta retains access via subscriptions.
-- Backfill events.portal_id so HelpATL feed renders content.
-- Seed interest channels on HelpATL's portal.

DO $$
DECLARE
  atlanta_id UUID;
  helpatl_id UUID;
  civic_source_slugs TEXT[] := ARRAY[
    'atlanta-city-meetings',
    'fulton-county-meetings',
    'dekalb-county-meetings',
    'hands-on-atlanta',
    'united-way-atlanta',
    'atlanta-community-food-bank',
    'park-pride'
  ];
  src RECORD;
BEGIN
  SELECT id INTO atlanta_id FROM portals WHERE slug = 'atlanta';
  SELECT id INTO helpatl_id FROM portals WHERE slug = 'helpatl';

  IF atlanta_id IS NULL OR helpatl_id IS NULL THEN
    RAISE NOTICE 'Atlanta or HelpATL portal not found. Skipping.';
    RETURN;
  END IF;

  -- ---------------------------------------------------------------
  -- 0. Backfill any remaining portal_id IS NULL events to Atlanta.
  --    All active sources have owner_portal_id set (CHECK constraint from mig 107).
  --    This catches legacy events that predate the trigger.
  -- ---------------------------------------------------------------
  UPDATE events
  SET portal_id = atlanta_id
  WHERE portal_id IS NULL;

  RAISE NOTICE 'Backfilled % orphan events to Atlanta',
    (SELECT count(*) FROM events WHERE portal_id = atlanta_id AND updated_at > now() - interval '1 second');

  -- ---------------------------------------------------------------
  -- 1. Transfer source ownership to HelpATL
  -- ---------------------------------------------------------------
  UPDATE sources
  SET owner_portal_id = helpatl_id,
      updated_at = now()
  WHERE slug = ANY(civic_source_slugs)
    AND is_active = true;

  RAISE NOTICE 'Transferred % civic sources to HelpATL',
    (SELECT count(*) FROM sources WHERE slug = ANY(civic_source_slugs) AND owner_portal_id = helpatl_id);

  -- ---------------------------------------------------------------
  -- 2. Create sharing rules (owner = HelpATL, share_scope = 'all')
  --    so other portals can subscribe to these sources.
  -- ---------------------------------------------------------------
  FOR src IN
    SELECT id FROM sources
    WHERE slug = ANY(civic_source_slugs)
      AND is_active = true
  LOOP
    INSERT INTO source_sharing_rules (source_id, owner_portal_id, share_scope)
    VALUES (src.id, helpatl_id, 'all')
    ON CONFLICT (source_id)
    DO UPDATE SET
      owner_portal_id = helpatl_id,
      share_scope = 'all',
      updated_at = now();
  END LOOP;

  -- ---------------------------------------------------------------
  -- 3. Create subscriptions: Atlanta subscribes to civic sources
  --    so Atlanta's feed retains access to civic content.
  -- ---------------------------------------------------------------
  FOR src IN
    SELECT id FROM sources
    WHERE slug = ANY(civic_source_slugs)
      AND is_active = true
  LOOP
    INSERT INTO source_subscriptions (subscriber_portal_id, source_id, subscription_scope, is_active)
    VALUES (atlanta_id, src.id, 'all', true)
    ON CONFLICT (subscriber_portal_id, source_id)
    DO UPDATE SET
      subscription_scope = 'all',
      is_active = true;
  END LOOP;

  -- ---------------------------------------------------------------
  -- 4. Backfill events.portal_id for existing civic source events
  --    so HelpATL's portal scope picks them up.
  -- ---------------------------------------------------------------
  UPDATE events e
  SET portal_id = helpatl_id
  FROM sources s
  WHERE e.source_id = s.id
    AND s.slug = ANY(civic_source_slugs)
    AND s.is_active = true
    AND (e.portal_id IS NULL OR e.portal_id = atlanta_id);

  RAISE NOTICE 'Backfilled % events to HelpATL portal_id',
    (SELECT count(*) FROM events e JOIN sources s ON e.source_id = s.id
     WHERE s.slug = ANY(civic_source_slugs) AND e.portal_id = helpatl_id);

  -- ---------------------------------------------------------------
  -- 5. Seed interest channels for HelpATL
  -- ---------------------------------------------------------------
  INSERT INTO interest_channels (portal_id, slug, name, channel_type, description, sort_order, is_active)
  VALUES
    (helpatl_id, 'atlanta-city-government', 'City of Atlanta Government', 'jurisdiction',
     'City council and city government meetings and civic updates.', 10, true),
    (helpatl_id, 'fulton-county-government', 'Fulton County Government', 'jurisdiction',
     'Fulton County commission and public meetings.', 20, true),
    (helpatl_id, 'dekalb-county-government', 'DeKalb County Government', 'jurisdiction',
     'DeKalb County board and public meetings.', 30, true),
    (helpatl_id, 'school-board-watch', 'School Board Watch', 'institution',
     'Track school board and district meetings.', 40, true),
    (helpatl_id, 'volunteer-opportunities-atl', 'Volunteer Opportunities', 'topic',
     'Volunteer events and service opportunities across Atlanta.', 50, true)
  ON CONFLICT (portal_id, slug) WHERE portal_id IS NOT NULL
  DO UPDATE SET
    name = EXCLUDED.name,
    channel_type = EXCLUDED.channel_type,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = now();

  -- Channel rules: jurisdiction source links
  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'source', jsonb_build_object('source_id', s.id, 'source_slug', s.slug), 10, true
  FROM interest_channels c
  JOIN sources s ON s.slug = 'atlanta-city-meetings'
  WHERE c.portal_id = helpatl_id AND c.slug = 'atlanta-city-government'
    AND NOT EXISTS (
      SELECT 1 FROM interest_channel_rules r
      WHERE r.channel_id = c.id AND r.rule_type = 'source' AND r.rule_payload ->> 'source_slug' = s.slug
    );

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'source', jsonb_build_object('source_id', s.id, 'source_slug', s.slug), 10, true
  FROM interest_channels c
  JOIN sources s ON s.slug = 'fulton-county-meetings'
  WHERE c.portal_id = helpatl_id AND c.slug = 'fulton-county-government'
    AND NOT EXISTS (
      SELECT 1 FROM interest_channel_rules r
      WHERE r.channel_id = c.id AND r.rule_type = 'source' AND r.rule_payload ->> 'source_slug' = s.slug
    );

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'source', jsonb_build_object('source_id', s.id, 'source_slug', s.slug), 10, true
  FROM interest_channels c
  JOIN sources s ON s.slug = 'dekalb-county-meetings'
  WHERE c.portal_id = helpatl_id AND c.slug = 'dekalb-county-government'
    AND NOT EXISTS (
      SELECT 1 FROM interest_channel_rules r
      WHERE r.channel_id = c.id AND r.rule_type = 'source' AND r.rule_payload ->> 'source_slug' = s.slug
    );

  -- School board: tag-based rule (no dedicated crawlers yet)
  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'tag', jsonb_build_object('tag', 'school-board'), 50, true
  FROM interest_channels c
  WHERE c.portal_id = helpatl_id AND c.slug = 'school-board-watch'
    AND NOT EXISTS (
      SELECT 1 FROM interest_channel_rules r
      WHERE r.channel_id = c.id AND r.rule_type = 'tag' AND r.rule_payload ->> 'tag' = 'school-board'
    );

  -- Volunteer: source + tag rules
  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'source', jsonb_build_object('source_id', s.id, 'source_slug', s.slug), 10, true
  FROM interest_channels c
  JOIN sources s ON s.slug IN ('hands-on-atlanta', 'united-way-atlanta', 'atlanta-community-food-bank', 'park-pride')
  WHERE c.portal_id = helpatl_id AND c.slug = 'volunteer-opportunities-atl'
    AND NOT EXISTS (
      SELECT 1 FROM interest_channel_rules r
      WHERE r.channel_id = c.id AND r.rule_type = 'source' AND r.rule_payload ->> 'source_slug' = s.slug
    );

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'tag', jsonb_build_object('tag', 'volunteer'), 30, true
  FROM interest_channels c
  WHERE c.portal_id = helpatl_id AND c.slug = 'volunteer-opportunities-atl'
    AND NOT EXISTS (
      SELECT 1 FROM interest_channel_rules r
      WHERE r.channel_id = c.id AND r.rule_type = 'tag' AND r.rule_payload ->> 'tag' = 'volunteer'
    );

END $$;

-- ---------------------------------------------------------------
-- 6. Remove federation_scope from portal settings — all portals now work
--    explicitly (owned + subscribed sources only). No more inherited_public fallback.
-- ---------------------------------------------------------------
UPDATE portals
SET settings = settings - 'federation_scope',
    updated_at = now()
WHERE settings ? 'federation_scope';

-- ---------------------------------------------------------------
-- 7. Refresh the materialized view so all portals see the new access
-- ---------------------------------------------------------------
REFRESH MATERIALIZED VIEW CONCURRENTLY portal_source_access;
