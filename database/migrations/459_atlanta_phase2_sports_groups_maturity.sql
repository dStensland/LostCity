-- Phase 2: deepen the Atlanta sports groups/community layer with
-- source-backed scene channels rather than broad topic sprawl.

DO $$
DECLARE
  atlanta_portal_id UUID;
BEGIN
  SELECT id INTO atlanta_portal_id
  FROM portals
  WHERE slug = 'atlanta'
  LIMIT 1;

  IF atlanta_portal_id IS NULL THEN
    RAISE NOTICE 'Atlanta portal not found. Skipping Phase 2 sports groups maturity tranche.';
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
      'atlanta-tennis-community',
      'Tennis Community',
      'community',
      'Adult tennis clinics, ALTA-style league play, and recurring tennis community sessions across Atlanta.',
      155,
      true
    ),
    (
      atlanta_portal_id,
      'atlanta-roller-derby-scene',
      'Roller Derby',
      'community',
      'Atlanta roller derby bouts and the community scene around the city''s derby culture.',
      165,
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

  -- Tennis community: future-proof official city-core tennis venues, plus a
  -- narrow title regex for adult league/community tennis rows that already
  -- exist in portal-accessible sources.
  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'source', jsonb_build_object('source_id', s.id, 'source_slug', s.slug), 10, true
  FROM interest_channels c
  JOIN sources s ON s.slug IN (
    'bitsy-grant-tennis-center',
    'sharon-lester-tennis-center',
    'joseph-mcghee-tennis-center',
    'chastain-park-tennis-center',
    'washington-park-tennis-center'
  )
  WHERE c.portal_id = atlanta_portal_id
    AND c.slug = 'atlanta-tennis-community'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'source'
        AND r.rule_payload ->> 'source_slug' = s.slug
    );

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'expression', jsonb_build_object(
    'title_regex',
    '(^alta\\b|serve\\s*&\\s*social|cardio tennis|stroke of the week)'
  ), 20, true
  FROM interest_channels c
  WHERE c.portal_id = atlanta_portal_id
    AND c.slug = 'atlanta-tennis-community'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'expression'
        AND r.rule_payload = jsonb_build_object(
          'title_regex',
          '(^alta\\b|serve\\s*&\\s*social|cardio tennis|stroke of the week)'
        )
    );

  -- Roller derby scene: keep it source-backed and Atlanta-core.
  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'source', jsonb_build_object('source_id', s.id, 'source_slug', s.slug), 10, true
  FROM interest_channels c
  JOIN sources s ON s.slug IN (
    'atlanta-roller-derby'
  )
  WHERE c.portal_id = atlanta_portal_id
    AND c.slug = 'atlanta-roller-derby-scene'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'source'
        AND r.rule_payload ->> 'source_slug' = s.slug
    );

  -- Run clubs already perform well, but explicit Atlanta Track Club coverage
  -- keeps the channel grounded in one of the city's strongest running orgs.
  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'source', jsonb_build_object('source_id', s.id, 'source_slug', s.slug), 15, true
  FROM interest_channels c
  JOIN sources s ON s.slug IN ('atlanta-track-club')
  WHERE c.portal_id = atlanta_portal_id
    AND c.slug = 'atlanta-run-clubs'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'source'
        AND r.rule_payload ->> 'source_slug' = s.slug
    );
END $$;
