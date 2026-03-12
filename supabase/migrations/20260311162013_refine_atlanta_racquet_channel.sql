-- Tighten Atlanta racquet sports so it keeps public tennis signal without
-- inheriting junior camp inventory from the city racquet center sources.

DO $$
DECLARE
  racquet_channel_id UUID;
BEGIN
  SELECT c.id
  INTO racquet_channel_id
  FROM interest_channels c
  JOIN portals p ON p.id = c.portal_id
  WHERE p.slug = 'atlanta'
    AND c.slug = 'atlanta-racquet-sports'
  LIMIT 1;

  IF racquet_channel_id IS NULL THEN
    RAISE NOTICE 'Atlanta racquet channel not found. Skipping refinement.';
    RETURN;
  END IF;

  DELETE FROM interest_channel_rules
  WHERE channel_id = racquet_channel_id
    AND rule_type = 'source'
    AND rule_payload ->> 'source_slug' IN (
      'bitsy-grant-tennis-center',
      'sharon-lester-tennis-center',
      'joseph-mcghee-tennis-center'
    );

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT racquet_channel_id, 'expression', jsonb_build_object('all_tags', jsonb_build_array('tennis', 'clinic')), 30, true
  WHERE NOT EXISTS (
    SELECT 1
    FROM interest_channel_rules r
    WHERE r.channel_id = racquet_channel_id
      AND r.rule_type = 'expression'
      AND r.rule_payload = jsonb_build_object('all_tags', jsonb_build_array('tennis', 'clinic'))
  );

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT racquet_channel_id, 'expression', jsonb_build_object('all_tags', jsonb_build_array('tennis', 'tournament')), 40, true
  WHERE NOT EXISTS (
    SELECT 1
    FROM interest_channel_rules r
    WHERE r.channel_id = racquet_channel_id
      AND r.rule_type = 'expression'
      AND r.rule_payload = jsonb_build_object('all_tags', jsonb_build_array('tennis', 'tournament'))
  );
END $$;
