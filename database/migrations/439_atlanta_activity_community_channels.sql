-- Add the next Atlanta-core activity/community channels on top of the
-- sport-specific interest channel tranche.

DO $$
DECLARE
  atlanta_portal_id UUID;
BEGIN
  SELECT id INTO atlanta_portal_id
  FROM portals
  WHERE slug = 'atlanta'
  LIMIT 1;

  IF atlanta_portal_id IS NULL THEN
    RAISE NOTICE 'Atlanta portal not found. Skipping activity community channels.';
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
      'atlanta-pickleball-community',
      'Pickleball',
      'community',
      'Indoor pickleball sessions, open play, and recurring pickleball meetups around Atlanta.',
      140,
      true
    ),
    (
      atlanta_portal_id,
      'atlanta-cycling-community',
      'Cycling',
      'community',
      'Recurring group rides, safety rides, and social bike rides around Atlanta.',
      150,
      true
    ),
    (
      atlanta_portal_id,
      'atlanta-adaptive-recreation',
      'Adaptive Recreation',
      'community',
      'Adaptive sports, fitness, swim, rowing, and recreation programs centered on Atlanta.',
      160,
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

  -- Pickleball: dedicated city pickleball source plus Piedmont open play.
  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'source', jsonb_build_object('source_id', s.id, 'source_slug', s.slug), 10, true
  FROM interest_channels c
  JOIN sources s ON s.slug IN ('atlanta-rec-center-pickleball')
  WHERE c.portal_id = atlanta_portal_id
    AND c.slug = 'atlanta-pickleball-community'
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
    AND c.slug = 'atlanta-pickleball-community'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'expression'
        AND r.rule_payload = jsonb_build_object('any_title_terms', jsonb_build_array('piedmont park pickleball open play'))
    );

  -- Cycling: only recurring ride-shaped events, not every event with a cycling tag.
  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'expression', jsonb_build_object(
    'all_tags', jsonb_build_array('cycling'),
    'any_title_terms', jsonb_build_array('group ride', 'safety ride', 'social bike ride', 'pizza ride')
  ), 10, true
  FROM interest_channels c
  WHERE c.portal_id = atlanta_portal_id
    AND c.slug = 'atlanta-cycling-community'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'expression'
        AND r.rule_payload = jsonb_build_object(
          'all_tags', jsonb_build_array('cycling'),
          'any_title_terms', jsonb_build_array('group ride', 'safety ride', 'social bike ride', 'pizza ride')
        )
    );

  -- Adaptive recreation: BlazeSports is a high-signal Atlanta community source
  -- that spans adaptive sports and fitness without polluting the main sports feed.
  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'source', jsonb_build_object('source_id', s.id, 'source_slug', s.slug), 10, true
  FROM interest_channels c
  JOIN sources s ON s.slug IN ('blazesports')
  WHERE c.portal_id = atlanta_portal_id
    AND c.slug = 'atlanta-adaptive-recreation'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'source'
        AND r.rule_payload ->> 'source_slug' = s.slug
    );
END $$;
