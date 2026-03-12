-- MIGRATION 353: Add HelpATL Georgia Democracy Watch channel
-- Captures statewide election-board and democracy-process events that affect
-- Atlanta users without over-broadening into generic activism.

DO $$
DECLARE
  helpatl_id UUID;
  watch_channel_id UUID;
BEGIN
  SELECT id
  INTO helpatl_id
  FROM portals
  WHERE slug = 'helpatl'
  LIMIT 1;

  IF helpatl_id IS NULL THEN
    RAISE NOTICE 'helpatl portal not found; skipping georgia-democracy-watch channel';
    RETURN;
  END IF;

  UPDATE interest_channels
  SET name = 'Georgia Democracy Watch',
      channel_type = 'jurisdiction',
      description = 'State Election Board meetings, statewide election days, and Georgia democracy process that affects Atlanta voters.',
      sort_order = 42,
      is_active = true
  WHERE portal_id = helpatl_id
    AND slug = 'georgia-democracy-watch';

  IF NOT EXISTS (
    SELECT 1
    FROM interest_channels
    WHERE portal_id = helpatl_id
      AND slug = 'georgia-democracy-watch'
  ) THEN
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
      helpatl_id,
      'georgia-democracy-watch',
      'Georgia Democracy Watch',
      'jurisdiction',
      'State Election Board meetings, statewide election days, and Georgia democracy process that affects Atlanta voters.',
      42,
      true
    );
  END IF;

  SELECT id
  INTO watch_channel_id
  FROM interest_channels
  WHERE portal_id = helpatl_id
    AND slug = 'georgia-democracy-watch'
  LIMIT 1;

  IF watch_channel_id IS NULL THEN
    RAISE NOTICE 'georgia-democracy-watch channel missing after upsert; skipping rule insert';
    RETURN;
  END IF;

  UPDATE interest_channel_rules
  SET is_active = true,
      priority = 20,
      rule_payload = jsonb_build_object(
        'any_tags', jsonb_build_array('election'),
        'any_title_terms', jsonb_build_array(
          'state election board',
          'general primary election',
          'nonpartisan election',
          'runoff election',
          'special election'
        )
      )
  WHERE interest_channel_rules.channel_id = watch_channel_id
    AND rule_type = 'expression'
    AND rule_payload -> 'any_tags' = jsonb_build_array('election');

  IF NOT EXISTS (
    SELECT 1
    FROM interest_channel_rules r
    WHERE r.channel_id = watch_channel_id
      AND r.rule_type = 'expression'
      AND r.rule_payload -> 'any_tags' = jsonb_build_array('election')
      AND r.rule_payload -> 'any_title_terms' = jsonb_build_array(
        'state election board',
        'general primary election',
        'nonpartisan election',
        'runoff election',
        'special election'
      )
  ) THEN
    INSERT INTO interest_channel_rules (
      channel_id,
      rule_type,
      rule_payload,
      priority,
      is_active
    )
    VALUES (
      watch_channel_id,
      'expression',
      jsonb_build_object(
        'any_tags', jsonb_build_array('election'),
        'any_title_terms', jsonb_build_array(
          'state election board',
          'general primary election',
          'nonpartisan election',
          'runoff election',
          'special election'
        )
      ),
      20,
      true
    );
  END IF;
END $$;
