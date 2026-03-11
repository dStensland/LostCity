-- MIGRATION 351: Reactivate HelpATL school board fallback tag rule
-- Ensures activist- and Mobilize-hosted school board meetings can flow into
-- School Board Watch when tagged with `school-board`.

DO $$
DECLARE
  helpatl_id UUID;
  school_board_channel_id UUID;
BEGIN
  SELECT id
  INTO helpatl_id
  FROM portals
  WHERE slug = 'helpatl'
  LIMIT 1;

  IF helpatl_id IS NULL THEN
    RAISE NOTICE 'helpatl portal not found; skipping school-board tag-rule repair';
    RETURN;
  END IF;

  SELECT id
  INTO school_board_channel_id
  FROM interest_channels
  WHERE portal_id = helpatl_id
    AND slug = 'school-board-watch'
  LIMIT 1;

  IF school_board_channel_id IS NULL THEN
    RAISE NOTICE 'school-board-watch channel not found on HelpATL; skipping tag-rule repair';
    RETURN;
  END IF;

  UPDATE interest_channel_rules
  SET is_active = true,
      priority = 50,
      rule_payload = jsonb_build_object('tag', 'school-board')
  WHERE channel_id = school_board_channel_id
    AND rule_type = 'tag'
    AND rule_payload ->> 'tag' = 'school-board';

  IF NOT EXISTS (
    SELECT 1
    FROM interest_channel_rules
    WHERE channel_id = school_board_channel_id
      AND rule_type = 'tag'
      AND rule_payload ->> 'tag' = 'school-board'
  ) THEN
    INSERT INTO interest_channel_rules (
      channel_id,
      rule_type,
      rule_payload,
      priority,
      is_active
    )
    VALUES (
      school_board_channel_id,
      'tag',
      jsonb_build_object('tag', 'school-board'),
      50,
      true
    );
  END IF;
END $$;
