UPDATE events
SET
    category_id = 'sports',
    tags = ARRAY(
        SELECT DISTINCT tag
        FROM unnest(coalesce(events.tags, ARRAY[]::text[]) || ARRAY['sports']) AS tag
    ),
    updated_at = NOW()
WHERE source_id = (
    SELECT id FROM sources WHERE slug = 'piedmont-park'
)
  AND is_active = true
  AND start_date >= CURRENT_DATE
  AND title IN (
      'Piedmont Park Pickleball Open Play',
      'Piedmont Park Pickup Soccer',
      'Piedmont Park Ultimate Frisbee Pickup'
  )
  AND category_id = 'fitness';
