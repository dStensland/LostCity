-- Seed sport-specific Atlanta interest channels on top of the broader
-- sports groups pack. Keep these source-first and use only narrow
-- expressions for mixed sources so the channel set stays Atlanta-core.

DO $$
DECLARE
  atlanta_portal_id UUID;
BEGIN
  SELECT id INTO atlanta_portal_id
  FROM portals
  WHERE slug = 'atlanta'
  LIMIT 1;

  IF atlanta_portal_id IS NULL THEN
    RAISE NOTICE 'Atlanta portal not found. Skipping sport-specific interest channels.';
    RETURN;
  END IF;

  INSERT INTO interest_channels (
    portal_id,
    slug,
    name,
    channel_type,
    description,
    sort_order,
    is_active
  )
  VALUES
    (
      atlanta_portal_id,
      'atlanta-soccer-scene',
      'Soccer Scene',
      'topic',
      'Atlanta United, USMNT, soccer watch parties, and pickup soccer around the city.',
      100,
      true
    ),
    (
      atlanta_portal_id,
      'atlanta-basketball-scene',
      'Basketball Scene',
      'topic',
      'Hawks, Dream, Skyhawks, basketball watch parties, and public pickup runs in Atlanta.',
      110,
      true
    ),
    (
      atlanta_portal_id,
      'atlanta-racquet-sports',
      'Racquet Sports',
      'topic',
      'Pickleball and tennis sessions, classes, and open play across Atlanta.',
      120,
      true
    ),
    (
      atlanta_portal_id,
      'atlanta-ultimate-frisbee',
      'Ultimate Frisbee',
      'community',
      'Atlanta Hustle games and recurring ultimate pickup sessions around Atlanta.',
      130,
      true
    )
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
  JOIN sources s ON s.slug IN (
    'atlanta-united-fc',
    'atlutd-pubs',
    'usmnt'
  )
  WHERE c.portal_id = atlanta_portal_id
    AND c.slug = 'atlanta-soccer-scene'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'source'
        AND r.rule_payload ->> 'source_slug' = s.slug
    );

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'expression', jsonb_build_object('all_tags', jsonb_build_array('soccer', 'sports')), 20, true
  FROM interest_channels c
  WHERE c.portal_id = atlanta_portal_id
    AND c.slug = 'atlanta-soccer-scene'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'expression'
        AND r.rule_payload = jsonb_build_object('all_tags', jsonb_build_array('soccer', 'sports'))
    );

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'source', jsonb_build_object('source_id', s.id, 'source_slug', s.slug), 10, true
  FROM interest_channels c
  JOIN sources s ON s.slug IN (
    'atlanta-hawks',
    'atlanta-dream',
    'college-park-skyhawks',
    'hawks-bars'
  )
  WHERE c.portal_id = atlanta_portal_id
    AND c.slug = 'atlanta-basketball-scene'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'source'
        AND r.rule_payload ->> 'source_slug' = s.slug
    );

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'expression', jsonb_build_object('all_tags', jsonb_build_array('basketball', 'atlanta-dpr')), 20, true
  FROM interest_channels c
  WHERE c.portal_id = atlanta_portal_id
    AND c.slug = 'atlanta-basketball-scene'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'expression'
        AND r.rule_payload = jsonb_build_object('all_tags', jsonb_build_array('basketball', 'atlanta-dpr'))
    );

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'expression', jsonb_build_object('all_tags', jsonb_build_array('basketball', 'sports-social')), 30, true
  FROM interest_channels c
  WHERE c.portal_id = atlanta_portal_id
    AND c.slug = 'atlanta-basketball-scene'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'expression'
        AND r.rule_payload = jsonb_build_object('all_tags', jsonb_build_array('basketball', 'sports-social'))
    );

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'source', jsonb_build_object('source_id', s.id, 'source_slug', s.slug), 10, true
  FROM interest_channels c
  JOIN sources s ON s.slug IN (
    'atlanta-rec-center-pickleball',
    'bitsy-grant-tennis-center',
    'sharon-lester-tennis-center',
    'joseph-mcghee-tennis-center'
  )
  WHERE c.portal_id = atlanta_portal_id
    AND c.slug = 'atlanta-racquet-sports'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'source'
        AND r.rule_payload ->> 'source_slug' = s.slug
    );

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'expression', jsonb_build_object('any_title_terms', jsonb_build_array('piedmont park pickleball open play')), 20, true
  FROM interest_channels c
  WHERE c.portal_id = atlanta_portal_id
    AND c.slug = 'atlanta-racquet-sports'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'expression'
        AND r.rule_payload = jsonb_build_object('any_title_terms', jsonb_build_array('piedmont park pickleball open play'))
    );

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'source', jsonb_build_object('source_id', s.id, 'source_slug', s.slug), 10, true
  FROM interest_channels c
  JOIN sources s ON s.slug IN (
    'atlanta-hustle'
  )
  WHERE c.portal_id = atlanta_portal_id
    AND c.slug = 'atlanta-ultimate-frisbee'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'source'
        AND r.rule_payload ->> 'source_slug' = s.slug
    );

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'expression', jsonb_build_object('all_tags', jsonb_build_array('ultimate-frisbee', 'sports')), 20, true
  FROM interest_channels c
  WHERE c.portal_id = atlanta_portal_id
    AND c.slug = 'atlanta-ultimate-frisbee'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'expression'
        AND r.rule_payload = jsonb_build_object('all_tags', jsonb_build_array('ultimate-frisbee', 'sports'))
    );
END $$;
