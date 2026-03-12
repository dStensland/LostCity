-- Refine the first Phase 2 sports groups tranche:
-- 1) tighten tennis community so it does not pull junior camps or Cobb ALTA rows
-- 2) remove the over-broad Atlanta Track Club source rule from run clubs
-- 3) add a clean source-shaped social sports leagues channel

DO $$
DECLARE
  atlanta_portal_id UUID;
  tennis_channel_id UUID;
  run_channel_id UUID;
BEGIN
  SELECT id INTO atlanta_portal_id
  FROM portals
  WHERE slug = 'atlanta'
  LIMIT 1;

  IF atlanta_portal_id IS NULL THEN
    RAISE NOTICE 'Atlanta portal not found. Skipping Phase 2 groups refinement.';
    RETURN;
  END IF;

  SELECT id INTO tennis_channel_id
  FROM interest_channels
  WHERE portal_id = atlanta_portal_id
    AND slug = 'atlanta-tennis-community'
  LIMIT 1;

  SELECT id INTO run_channel_id
  FROM interest_channels
  WHERE portal_id = atlanta_portal_id
    AND slug = 'atlanta-run-clubs'
  LIMIT 1;

  IF tennis_channel_id IS NOT NULL THEN
    UPDATE interest_channels
    SET description = 'Adult tennis community sessions, cardio tennis, drills, and league-adjacent meetups around Atlanta.',
        updated_at = now()
    WHERE id = tennis_channel_id;

    UPDATE interest_channel_rules
    SET is_active = false
    WHERE channel_id = tennis_channel_id
      AND rule_type = 'source'
      AND (rule_payload ->> 'source_slug') IN (
        'bitsy-grant-tennis-center',
        'sharon-lester-tennis-center',
        'joseph-mcghee-tennis-center',
        'chastain-park-tennis-center',
        'washington-park-tennis-center'
      );

    UPDATE interest_channel_rules
    SET is_active = false
    WHERE channel_id = tennis_channel_id
      AND rule_type = 'expression'
      AND rule_payload = jsonb_build_object(
        'title_regex',
        '(^alta\\b|serve\\s*&\\s*social|cardio tennis|stroke of the week)'
      );

    INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
    SELECT tennis_channel_id, 'expression', jsonb_build_object(
      'title_regex',
      '(serve\\s*&\\s*social|cardio tennis|stroke of the week|intermediate drills|ball championships)'
    ), 20, true
    WHERE NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = tennis_channel_id
        AND r.rule_type = 'expression'
        AND r.rule_payload = jsonb_build_object(
          'title_regex',
          '(serve\\s*&\\s*social|cardio tennis|stroke of the week|intermediate drills|ball championships)'
        )
    );
  END IF;

  IF run_channel_id IS NOT NULL THEN
    UPDATE interest_channel_rules
    SET is_active = false
    WHERE channel_id = run_channel_id
      AND rule_type = 'source'
      AND (rule_payload ->> 'source_slug') = 'atlanta-track-club';
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
  VALUES (
    atlanta_portal_id,
    'atlanta-social-sports-leagues',
    'Social Sports Leagues',
    'community',
    'Venue-owned skee-ball, bocce, duckpin, curling, and other adult social sports leagues around Atlanta.',
    170,
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
  SELECT c.id, 'expression', jsonb_build_object(
    'title_regex',
    '(skee-ball league|duckpin bowling league|bocce league|curling night)'
  ), 10, true
  FROM interest_channels c
  WHERE c.portal_id = atlanta_portal_id
    AND c.slug = 'atlanta-social-sports-leagues'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'expression'
        AND r.rule_payload = jsonb_build_object(
          'title_regex',
          '(skee-ball league|duckpin bowling league|bocce league|curling night)'
        )
    );
END $$;
