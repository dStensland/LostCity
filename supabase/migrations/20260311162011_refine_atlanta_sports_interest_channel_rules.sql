-- Tighten Atlanta sports channel rules so they stay Atlanta-core and avoid
-- metro/county drift from generic tags or broad source-level matches.

DO $$
DECLARE
  atlanta_portal_id UUID;
  public_play_channel_id UUID;
  run_clubs_channel_id UUID;
  watch_parties_channel_id UUID;
BEGIN
  SELECT id INTO atlanta_portal_id
  FROM portals
  WHERE slug = 'atlanta'
  LIMIT 1;

  IF atlanta_portal_id IS NULL THEN
    RAISE NOTICE 'Atlanta portal not found. Skipping sports channel refinement.';
    RETURN;
  END IF;

  SELECT id INTO public_play_channel_id
  FROM interest_channels
  WHERE portal_id = atlanta_portal_id
    AND slug = 'atlanta-public-play'
  LIMIT 1;

  SELECT id INTO run_clubs_channel_id
  FROM interest_channels
  WHERE portal_id = atlanta_portal_id
    AND slug = 'atlanta-run-clubs'
  LIMIT 1;

  SELECT id INTO watch_parties_channel_id
  FROM interest_channels
  WHERE portal_id = atlanta_portal_id
    AND slug = 'atlanta-watch-parties'
  LIMIT 1;

  IF public_play_channel_id IS NOT NULL THEN
    DELETE FROM interest_channel_rules
    WHERE channel_id = public_play_channel_id
      AND (
        (rule_type = 'tag' AND rule_payload ->> 'tag' = 'public-play')
        OR (rule_type = 'source' AND rule_payload ->> 'source_slug' = 'piedmont-park')
      );

    INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
    VALUES (
      public_play_channel_id,
      'expression',
      jsonb_build_object(
        'any_title_terms',
        jsonb_build_array('pickup soccer', 'ultimate frisbee pickup', 'pickleball open play')
      ),
      30,
      true
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF run_clubs_channel_id IS NOT NULL THEN
    DELETE FROM interest_channel_rules
    WHERE channel_id = run_clubs_channel_id
      AND rule_type = 'source'
      AND rule_payload ->> 'source_slug' = 'big-peach-running';
  END IF;

  IF watch_parties_channel_id IS NOT NULL THEN
    DELETE FROM interest_channel_rules
    WHERE channel_id = watch_parties_channel_id
      AND rule_type = 'source'
      AND rule_payload ->> 'source_slug' = 'park-tavern';
  END IF;
END $$;
