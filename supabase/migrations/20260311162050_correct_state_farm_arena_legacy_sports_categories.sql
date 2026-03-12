-- Correct legacy State Farm Arena rows that were misclassified as sports.

UPDATE events
SET category_id = 'music',
    tags = ARRAY['concert', 'live-music', 'arena-show', 'state-farm-arena', 'downtown'],
    updated_at = NOW()
WHERE is_active = TRUE
  AND source_id = (SELECT id FROM sources WHERE slug = 'state-farm-arena')
  AND title IN ('Hbcu Awarefest', 'MANÁ');

UPDATE events
SET category_id = 'nightlife',
    tags = ARRAY['comedy', 'standup', 'state-farm-arena', 'downtown'],
    updated_at = NOW()
WHERE is_active = TRUE
  AND source_id = (SELECT id FROM sources WHERE slug = 'state-farm-arena')
  AND title = 'Gabriel Iglesias';
