-- Interest Channels Atlanta pilot seed

DO $$
DECLARE
  atlanta_portal_id UUID;
BEGIN
  SELECT id INTO atlanta_portal_id
  FROM portals
  WHERE slug = 'atlanta'
  LIMIT 1;

  IF atlanta_portal_id IS NULL THEN
    RAISE NOTICE 'Atlanta portal not found. Skipping interest channel seed.';
    RETURN;
  END IF;

  INSERT INTO interest_channels (portal_id, slug, name, channel_type, description, sort_order, is_active)
  VALUES
    (atlanta_portal_id, 'atlanta-city-government', 'City of Atlanta Government', 'jurisdiction', 'City council and city government meetings and civic updates.', 10, true),
    (atlanta_portal_id, 'fulton-county-government', 'Fulton County Government', 'jurisdiction', 'Fulton County commission and public meetings.', 20, true),
    (atlanta_portal_id, 'dekalb-county-government', 'DeKalb County Government', 'jurisdiction', 'DeKalb County board and public meetings.', 30, true),
    (atlanta_portal_id, 'school-board-watch', 'School Board Watch', 'institution', 'Track school board and district meetings as sources are onboarded.', 40, true),
    (atlanta_portal_id, 'volunteer-opportunities-atl', 'Volunteer Opportunities', 'topic', 'Volunteer events and service opportunities across Atlanta.', 50, true)
  ON CONFLICT (portal_id, slug) WHERE portal_id IS NOT NULL
  DO UPDATE SET
    name = EXCLUDED.name,
    channel_type = EXCLUDED.channel_type,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = now();

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'source', jsonb_build_object('source_id', s.id, 'source_slug', s.slug), 10, true
  FROM interest_channels c
  JOIN sources s ON s.slug = 'atlanta-city-meetings'
  WHERE c.portal_id = atlanta_portal_id
    AND c.slug = 'atlanta-city-government'
    AND NOT EXISTS (
      SELECT 1 FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'source'
        AND r.rule_payload ->> 'source_slug' = s.slug
    );

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'source', jsonb_build_object('source_id', s.id, 'source_slug', s.slug), 10, true
  FROM interest_channels c
  JOIN sources s ON s.slug = 'fulton-county-meetings'
  WHERE c.portal_id = atlanta_portal_id
    AND c.slug = 'fulton-county-government'
    AND NOT EXISTS (
      SELECT 1 FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'source'
        AND r.rule_payload ->> 'source_slug' = s.slug
    );

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'source', jsonb_build_object('source_id', s.id, 'source_slug', s.slug), 10, true
  FROM interest_channels c
  JOIN sources s ON s.slug = 'dekalb-county-meetings'
  WHERE c.portal_id = atlanta_portal_id
    AND c.slug = 'dekalb-county-government'
    AND NOT EXISTS (
      SELECT 1 FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'source'
        AND r.rule_payload ->> 'source_slug' = s.slug
    );

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'tag', jsonb_build_object('tag', 'school-board'), 50, true
  FROM interest_channels c
  WHERE c.portal_id = atlanta_portal_id
    AND c.slug = 'school-board-watch'
    AND NOT EXISTS (
      SELECT 1 FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'tag'
        AND r.rule_payload ->> 'tag' = 'school-board'
    );

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'source', jsonb_build_object('source_id', s.id, 'source_slug', s.slug), 10, true
  FROM interest_channels c
  JOIN sources s ON s.slug IN (
    'hands-on-atlanta',
    'united-way-atlanta',
    'atlanta-community-food-bank',
    'park-pride',
    'atlanta-toolbank'
  )
  WHERE c.portal_id = atlanta_portal_id
    AND c.slug = 'volunteer-opportunities-atl'
    AND NOT EXISTS (
      SELECT 1 FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'source'
        AND r.rule_payload ->> 'source_slug' = s.slug
    );

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'tag', jsonb_build_object('tag', 'volunteer'), 30, true
  FROM interest_channels c
  WHERE c.portal_id = atlanta_portal_id
    AND c.slug = 'volunteer-opportunities-atl'
    AND NOT EXISTS (
      SELECT 1 FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'tag'
        AND r.rule_payload ->> 'tag' = 'volunteer'
    );
END $$;
