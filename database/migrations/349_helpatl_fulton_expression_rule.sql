-- ============================================
-- MIGRATION 349: HelpATL Fulton expression rule
-- ============================================
-- Lets activist-hosted Fulton public meetings land in the Fulton County
-- Government channel when their tags and titles clearly indicate county process.

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
    AND slug = 'fulton-county-government'
  LIMIT 1;

  IF target_channel_id IS NULL THEN
    RAISE NOTICE 'Fulton County Government channel not found. Skipping.';
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
        'fulton county',
        'board of registrations',
        'board of elections',
        'board of commissioners'
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
        'fulton county',
        'board of registrations',
        'board of elections',
        'board of commissioners'
      )
  );
END $$;
