-- MIGRATION 352: Reactivate HelpATL Atlanta/Fulton crossover expression rules
-- Keeps activist-hosted public-process events discoverable in the relevant
-- jurisdiction channels after portal reprovisioning.

DO $$
DECLARE
  helpatl_id UUID;
  atlanta_channel_id UUID;
  fulton_channel_id UUID;
BEGIN
  SELECT id
  INTO helpatl_id
  FROM portals
  WHERE slug = 'helpatl'
  LIMIT 1;

  IF helpatl_id IS NULL THEN
    RAISE NOTICE 'helpatl portal not found; skipping city/fulton expression repair';
    RETURN;
  END IF;

  SELECT id
  INTO atlanta_channel_id
  FROM interest_channels
  WHERE portal_id = helpatl_id
    AND slug = 'atlanta-city-government'
  LIMIT 1;

  SELECT id
  INTO fulton_channel_id
  FROM interest_channels
  WHERE portal_id = helpatl_id
    AND slug = 'fulton-county-government'
  LIMIT 1;

  IF atlanta_channel_id IS NOT NULL THEN
    UPDATE interest_channel_rules
    SET is_active = true,
        priority = 20,
        rule_payload = jsonb_build_object(
          'all_tags', jsonb_build_array('government', 'public-meeting'),
          'any_title_terms', jsonb_build_array(
            'city district',
            'councilmember',
            'city council',
            'atlanta city hall'
          )
        )
    WHERE channel_id = atlanta_channel_id
      AND rule_type = 'expression'
      AND rule_payload -> 'all_tags' = jsonb_build_array('government', 'public-meeting')
      AND rule_payload -> 'any_title_terms' = jsonb_build_array(
        'city district',
        'councilmember',
        'city council',
        'atlanta city hall'
      );

    IF NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules
      WHERE channel_id = atlanta_channel_id
        AND rule_type = 'expression'
        AND rule_payload -> 'all_tags' = jsonb_build_array('government', 'public-meeting')
        AND rule_payload -> 'any_title_terms' = jsonb_build_array(
          'city district',
          'councilmember',
          'city council',
          'atlanta city hall'
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
        atlanta_channel_id,
        'expression',
        jsonb_build_object(
          'all_tags', jsonb_build_array('government', 'public-meeting'),
          'any_title_terms', jsonb_build_array(
            'city district',
            'councilmember',
            'city council',
            'atlanta city hall'
          )
        ),
        20,
        true
      );
    END IF;
  END IF;

  IF fulton_channel_id IS NOT NULL THEN
    UPDATE interest_channel_rules
    SET is_active = true,
        priority = 20,
        rule_payload = jsonb_build_object(
          'all_tags', jsonb_build_array('government', 'public-meeting'),
          'any_title_terms', jsonb_build_array(
            'fulton county',
            'board of registrations',
            'board of elections',
            'board of commissioners'
          )
        )
    WHERE channel_id = fulton_channel_id
      AND rule_type = 'expression'
      AND rule_payload -> 'all_tags' = jsonb_build_array('government', 'public-meeting')
      AND rule_payload -> 'any_title_terms' = jsonb_build_array(
        'fulton county',
        'board of registrations',
        'board of elections',
        'board of commissioners'
      );

    IF NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules
      WHERE channel_id = fulton_channel_id
        AND rule_type = 'expression'
        AND rule_payload -> 'all_tags' = jsonb_build_array('government', 'public-meeting')
        AND rule_payload -> 'any_title_terms' = jsonb_build_array(
          'fulton county',
          'board of registrations',
          'board of elections',
          'board of commissioners'
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
        fulton_channel_id,
        'expression',
        jsonb_build_object(
          'all_tags', jsonb_build_array('government', 'public-meeting'),
          'any_title_terms', jsonb_build_array(
            'fulton county',
            'board of registrations',
            'board of elections',
            'board of commissioners'
          )
        ),
        20,
        true
      );
    END IF;
  END IF;
END $$;
