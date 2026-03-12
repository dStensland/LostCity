-- Refine Hooky's family sports channels after the first live materialization.

DO $$
DECLARE
  swim_channel_id UUID;
  cheer_channel_id UUID;
BEGIN
  SELECT ic.id
  INTO swim_channel_id
  FROM interest_channels ic
  JOIN portals p ON p.id = ic.portal_id
  WHERE p.slug = 'hooky'
    AND ic.slug = 'hooky-swim-lessons'
  LIMIT 1;

  SELECT ic.id
  INTO cheer_channel_id
  FROM interest_channels ic
  JOIN portals p ON p.id = ic.portal_id
  WHERE p.slug = 'hooky'
    AND ic.slug = 'hooky-cheer-gymnastics'
  LIMIT 1;

  IF swim_channel_id IS NOT NULL THEN
    UPDATE interest_channels
    SET
      name = 'Swim & Aquatics',
      description = 'Kids swim lessons, family sensory swim, artistic swimming, and youth aquatics programs across metro Atlanta.',
      updated_at = now()
    WHERE id = swim_channel_id;

    UPDATE interest_channel_rules
    SET is_active = false
    WHERE channel_id = swim_channel_id
      AND rule_type = 'expression'
      AND rule_payload = jsonb_build_object(
        'all_tags', jsonb_build_array('water-sports'),
        'any_tags', jsonb_build_array('kids', 'preschool', 'toddler', 'tween', 'accessible')
      );

    INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
    SELECT swim_channel_id, 'expression', jsonb_build_object(
      'all_tags', jsonb_build_array('water-sports'),
      'any_tags', jsonb_build_array('kids', 'preschool', 'toddler', 'tween', 'accessible'),
      'any_title_terms', jsonb_build_array('swim', 'aquatic', 'artistic swimming', 'underwater')
    ), 20, true
    WHERE NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = swim_channel_id
        AND r.rule_type = 'expression'
        AND r.rule_payload = jsonb_build_object(
          'all_tags', jsonb_build_array('water-sports'),
          'any_tags', jsonb_build_array('kids', 'preschool', 'toddler', 'tween', 'accessible'),
          'any_title_terms', jsonb_build_array('swim', 'aquatic', 'artistic swimming', 'underwater')
        )
    );
  END IF;

  IF cheer_channel_id IS NOT NULL THEN
    UPDATE interest_channel_rules
    SET is_active = false
    WHERE channel_id = cheer_channel_id
      AND rule_type = 'expression'
      AND rule_payload = jsonb_build_object(
        'title_regex',
        '(cheer|gymnast|tumbling|acro)',
        'any_tags', jsonb_build_array('kids', 'preschool', 'elementary', 'tween', 'teen', 'toddler')
      );

    INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
    SELECT cheer_channel_id, 'expression', jsonb_build_object(
      'title_regex',
      '\\m(cheer|gymnast|tumbling|acro)\\M',
      'any_tags', jsonb_build_array('kids', 'preschool', 'elementary', 'tween', 'teen', 'toddler')
    ), 10, true
    WHERE NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = cheer_channel_id
        AND r.rule_type = 'expression'
        AND r.rule_payload = jsonb_build_object(
          'title_regex',
          '\\m(cheer|gymnast|tumbling|acro)\\M',
          'any_tags', jsonb_build_array('kids', 'preschool', 'elementary', 'tween', 'teen', 'toddler')
        )
    );
  END IF;
END $$;
