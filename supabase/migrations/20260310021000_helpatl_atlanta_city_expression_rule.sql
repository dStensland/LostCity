-- ============================================
-- MIGRATION 350: HelpATL Atlanta city expression rule
-- ============================================
-- Lets activist-hosted Atlanta city public meetings land in the City of
-- Atlanta Government channel when their tags and titles clearly indicate city
-- process or a councilmember-led workshop.

DO $$
DECLARE
  helpatl_id UUID;
  target_channel_id UUID;
BEGIN
  SELECT id INTO helpatl_id
  FROM portals
  WHERE slug = 'helpatl'
  LIMIT 1;

  IF helpatl_id IS NULL THEN
    RAISE NOTICE 'HelpATL portal not found. Skipping.';
    RETURN;
  END IF;

  SELECT id INTO target_channel_id
  FROM interest_channels
  WHERE portal_id = helpatl_id
    AND slug = 'atlanta-city-government'
  LIMIT 1;

  IF target_channel_id IS NULL THEN
    RAISE NOTICE 'City of Atlanta Government channel not found. Skipping.';
    RETURN;
  END IF;

  INSERT INTO interest_channel_rules (
    channel_id,
    rule_type,
    rule_payload,
    priority,
    is_active
  )
  SELECT
    target_channel_id,
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
  WHERE NOT EXISTS (
    SELECT 1
    FROM interest_channel_rules r
    WHERE r.channel_id = target_channel_id
      AND r.rule_type = 'expression'
      AND r.rule_payload -> 'all_tags' = jsonb_build_array('government', 'public-meeting')
      AND r.rule_payload -> 'any_title_terms' = jsonb_build_array(
        'city district',
        'councilmember',
        'city council',
        'atlanta city hall'
      )
  );
END $$;
