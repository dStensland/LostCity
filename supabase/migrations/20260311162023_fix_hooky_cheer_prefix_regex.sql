-- Fix Hooky's cheer/gymnastics regex to match cheerleading/gymnastics
-- while still avoiding the lacrosse false positive.

DO $$
DECLARE
  cheer_channel_id UUID;
BEGIN
  SELECT ic.id
  INTO cheer_channel_id
  FROM interest_channels ic
  JOIN portals p ON p.id = ic.portal_id
  WHERE p.slug = 'hooky'
    AND ic.slug = 'hooky-cheer-gymnastics'
  LIMIT 1;

  IF cheer_channel_id IS NULL THEN
    RAISE NOTICE 'Hooky cheer/gymnastics channel not found. Skipping prefix regex fix.';
    RETURN;
  END IF;

  UPDATE interest_channel_rules
  SET is_active = false
  WHERE channel_id = cheer_channel_id
    AND rule_type = 'expression'
    AND rule_payload = jsonb_build_object(
      'title_regex',
      '\\b(cheer|gymnast|tumbling|acro)\\b',
      'any_tags', jsonb_build_array('kids', 'preschool', 'elementary', 'tween', 'teen', 'toddler')
    );

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT cheer_channel_id, 'expression', jsonb_build_object(
    'title_regex',
    '\\b(cheer|gymnast|tumbling|acro)',
    'any_tags', jsonb_build_array('kids', 'preschool', 'elementary', 'tween', 'teen', 'toddler')
  ), 10, true
  WHERE NOT EXISTS (
    SELECT 1
    FROM interest_channel_rules r
    WHERE r.channel_id = cheer_channel_id
      AND r.rule_type = 'expression'
      AND r.rule_payload = jsonb_build_object(
        'title_regex',
        '\\b(cheer|gymnast|tumbling|acro)',
        'any_tags', jsonb_build_array('kids', 'preschool', 'elementary', 'tween', 'teen', 'toddler')
      )
  );
END $$;
