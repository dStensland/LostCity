-- Phase 2: family/program sports handoff for Hooky.
--
-- Hooky already owns the family-program sources and swim-school sources.
-- This tranche makes the sports subset legible as first-class channels
-- instead of leaving it buried inside generic family/program inventory.

DO $$
DECLARE
  hooky_portal_id UUID;
BEGIN
  SELECT id INTO hooky_portal_id
  FROM portals
  WHERE slug = 'hooky'
  LIMIT 1;

  IF hooky_portal_id IS NULL THEN
    RAISE NOTICE 'Hooky portal not found. Skipping family sports channels.';
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
      hooky_portal_id,
      'hooky-swim-lessons',
      'Swim Lessons',
      'topic',
      'Kids swim lessons, family sensory swim, and youth aquatics programs across metro Atlanta.',
      100,
      true
    ),
    (
      hooky_portal_id,
      'hooky-youth-sports',
      'Youth Sports',
      'topic',
      'Baseball, football, soccer, basketball, tennis, and similar youth sports programs and camps.',
      110,
      true
    ),
    (
      hooky_portal_id,
      'hooky-cheer-gymnastics',
      'Cheer & Gymnastics',
      'topic',
      'Youth cheer, gymnastics, tumbling, and acro programs for Atlanta-area families.',
      120,
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

  -- Swim lessons: dedicated swim-school sources.
  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'source', jsonb_build_object('source_id', s.id, 'source_slug', s.slug), 10, true
  FROM interest_channels c
  JOIN sources s ON s.slug IN ('swim-atlanta', 'goldfish-swim')
  WHERE c.portal_id = hooky_portal_id
    AND c.slug = 'hooky-swim-lessons'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'source'
        AND r.rule_payload ->> 'source_slug' = s.slug
    );

  -- Swim lessons: family-program swim rows that are clearly youth/family.
  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'expression', jsonb_build_object(
    'all_tags', jsonb_build_array('water-sports'),
    'any_tags', jsonb_build_array('kids', 'preschool', 'toddler', 'tween', 'accessible')
  ), 20, true
  FROM interest_channels c
  WHERE c.portal_id = hooky_portal_id
    AND c.slug = 'hooky-swim-lessons'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'expression'
        AND r.rule_payload = jsonb_build_object(
          'all_tags', jsonb_build_array('water-sports'),
          'any_tags', jsonb_build_array('kids', 'preschool', 'toddler', 'tween', 'accessible')
        )
    );

  -- Youth sports: title shape + youth signals keeps adult league rows out.
  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'expression', jsonb_build_object(
    'title_regex',
    '((junior|youth|tot|boys?|girls?|kids?).*(baseball|softball|flag football|football|soccer|basketball|tennis|pickleball|volleyball|golf|lacrosse))|((baseball|softball|flag football|football|soccer|basketball|tennis|pickleball|volleyball|golf|lacrosse).*(ages?\\s*\\d|camp|clinic|training|skills|connection))',
    'any_tags', jsonb_build_array('kids', 'preschool', 'elementary', 'tween', 'teen', 'toddler')
  ), 10, true
  FROM interest_channels c
  WHERE c.portal_id = hooky_portal_id
    AND c.slug = 'hooky-youth-sports'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'expression'
        AND r.rule_payload = jsonb_build_object(
          'title_regex',
          '((junior|youth|tot|boys?|girls?|kids?).*(baseball|softball|flag football|football|soccer|basketball|tennis|pickleball|volleyball|golf|lacrosse))|((baseball|softball|flag football|football|soccer|basketball|tennis|pickleball|volleyball|golf|lacrosse).*(ages?\\s*\\d|camp|clinic|training|skills|connection))',
          'any_tags', jsonb_build_array('kids', 'preschool', 'elementary', 'tween', 'teen', 'toddler')
        )
    );

  -- Cheer/gymnastics: youth-only movement/sports programs, not adult classes.
  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'expression', jsonb_build_object(
    'title_regex',
    '(cheer|gymnast|tumbling|acro)',
    'any_tags', jsonb_build_array('kids', 'preschool', 'elementary', 'tween', 'teen', 'toddler')
  ), 10, true
  FROM interest_channels c
  WHERE c.portal_id = hooky_portal_id
    AND c.slug = 'hooky-cheer-gymnastics'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'expression'
        AND r.rule_payload = jsonb_build_object(
          'title_regex',
          '(cheer|gymnast|tumbling|acro)',
          'any_tags', jsonb_build_array('kids', 'preschool', 'elementary', 'tween', 'teen', 'toddler')
        )
    );
END $$;
