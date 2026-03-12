-- Seed Atlanta sports interest channels so the groups surface has a real
-- sports lane without leaking join-first leagues into the feed.

DO $$
DECLARE
  atlanta_portal_id UUID;
BEGIN
  SELECT id INTO atlanta_portal_id
  FROM portals
  WHERE slug = 'atlanta'
  LIMIT 1;

  IF atlanta_portal_id IS NULL THEN
    RAISE NOTICE 'Atlanta portal not found. Skipping sports interest channels.';
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
      atlanta_portal_id,
      'atlanta-watch-parties',
      'Watch Parties',
      'topic',
      'Official team-backed watch parties and high-signal public sports-viewing events across Atlanta.',
      60,
      true
    ),
    (
      atlanta_portal_id,
      'atlanta-public-play',
      'Pickup & Open Play',
      'community',
      'Public pickup, open gym, open play, and drop-in sports sessions around Atlanta.',
      70,
      true
    ),
    (
      atlanta_portal_id,
      'atlanta-run-clubs',
      'Run Clubs',
      'community',
      'Weekly run clubs, group runs, and track-workout meetups in Atlanta.',
      80,
      true
    ),
    (
      atlanta_portal_id,
      'atlanta-aquatics',
      'Aquatics',
      'topic',
      'Adult swim lessons, aquatic fitness, and open-swim sessions in Atlanta.',
      90,
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

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'source', jsonb_build_object('source_id', s.id, 'source_slug', s.slug), 10, true
  FROM interest_channels c
  JOIN sources s ON s.slug IN (
    'atlutd-pubs',
    'hawks-bars',
    'sports-social',
    'park-tavern'
  )
  WHERE c.portal_id = atlanta_portal_id
    AND c.slug = 'atlanta-watch-parties'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'source'
        AND r.rule_payload ->> 'source_slug' = s.slug
    );

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'tag', jsonb_build_object('tag', 'watch-party'), 20, true
  FROM interest_channels c
  WHERE c.portal_id = atlanta_portal_id
    AND c.slug = 'atlanta-watch-parties'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'tag'
        AND r.rule_payload ->> 'tag' = 'watch-party'
    );

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'source', jsonb_build_object('source_id', s.id, 'source_slug', s.slug), 10, true
  FROM interest_channels c
  JOIN sources s ON s.slug IN (
    'atlanta-rec-center-open-gym',
    'atlanta-rec-center-pickleball',
    'atlanta-natatorium-open-swim',
    'piedmont-park'
  )
  WHERE c.portal_id = atlanta_portal_id
    AND c.slug = 'atlanta-public-play'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'source'
        AND r.rule_payload ->> 'source_slug' = s.slug
    );

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'tag', jsonb_build_object('tag', 'public-play'), 20, true
  FROM interest_channels c
  WHERE c.portal_id = atlanta_portal_id
    AND c.slug = 'atlanta-public-play'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'tag'
        AND r.rule_payload ->> 'tag' = 'public-play'
    );

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'source', jsonb_build_object('source_id', s.id, 'source_slug', s.slug), 10, true
  FROM interest_channels c
  JOIN sources s ON s.slug IN (
    'big-peach-running'
  )
  WHERE c.portal_id = atlanta_portal_id
    AND c.slug = 'atlanta-run-clubs'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'source'
        AND r.rule_payload ->> 'source_slug' = s.slug
    );

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'expression', jsonb_build_object('any_tags', jsonb_build_array('run-club', 'group-run', 'track-workout')), 20, true
  FROM interest_channels c
  WHERE c.portal_id = atlanta_portal_id
    AND c.slug = 'atlanta-run-clubs'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'expression'
        AND r.rule_payload = jsonb_build_object('any_tags', jsonb_build_array('run-club', 'group-run', 'track-workout'))
    );

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'expression', jsonb_build_object('any_title_terms', jsonb_build_array('group run', 'run club', 'running club')), 30, true
  FROM interest_channels c
  WHERE c.portal_id = atlanta_portal_id
    AND c.slug = 'atlanta-run-clubs'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'expression'
        AND r.rule_payload = jsonb_build_object('any_title_terms', jsonb_build_array('group run', 'run club', 'running club'))
    );

  INSERT INTO interest_channel_rules (channel_id, rule_type, rule_payload, priority, is_active)
  SELECT c.id, 'source', jsonb_build_object('source_id', s.id, 'source_slug', s.slug), 10, true
  FROM interest_channels c
  JOIN sources s ON s.slug IN (
    'atlanta-adult-swim-lessons',
    'atlanta-aquatic-fitness',
    'atlanta-natatorium-open-swim'
  )
  WHERE c.portal_id = atlanta_portal_id
    AND c.slug = 'atlanta-aquatics'
    AND NOT EXISTS (
      SELECT 1
      FROM interest_channel_rules r
      WHERE r.channel_id = c.id
        AND r.rule_type = 'source'
        AND r.rule_payload ->> 'source_slug' = s.slug
    );
END $$;
