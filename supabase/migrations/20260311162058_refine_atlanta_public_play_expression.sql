-- Narrow the Atlanta public-play channel expression so it keeps Atlanta-core
-- Piedmont pickup rows without pulling in suburban pickleball open-play titles.

UPDATE interest_channel_rules r
SET
  rule_payload = jsonb_build_object(
    'any_title_terms',
    jsonb_build_array('pickup soccer', 'ultimate frisbee pickup')
  ),
  updated_at = now()
FROM interest_channels c
JOIN portals p ON p.id = c.portal_id
WHERE r.channel_id = c.id
  AND p.slug = 'atlanta'
  AND c.slug = 'atlanta-public-play'
  AND r.rule_type = 'expression'
  AND r.rule_payload = jsonb_build_object(
    'any_title_terms',
    jsonb_build_array('pickup soccer', 'ultimate frisbee pickup', 'pickleball open play')
  );
