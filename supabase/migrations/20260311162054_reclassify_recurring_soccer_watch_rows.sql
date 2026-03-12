-- Reclassify Atlanta recurring soccer watch rows into Sports for the consumer feed.
-- These templates were upgraded to sports/watch-party metadata, but legacy rows
-- remain in nightlife because smart updates do not currently promote nightlife -> sports.

UPDATE events
SET
  category_id = 'sports',
  tags = ARRAY(
    SELECT DISTINCT tag
    FROM unnest(
      coalesce(tags, ARRAY[]::text[])
      || ARRAY['sports', 'watch-party', 'soccer']
    ) AS tag
  ),
  updated_at = now()
WHERE source_id = 349
  AND is_active = true
  AND start_date >= current_date
  AND title IN (
    'EPL Saturday Morning Watch at Brewhouse Cafe',
    'EPL Sunday Morning Watch at Brewhouse Cafe',
    'EPL Morning Watch at Fado Midtown',
    'EPL Morning Watch at Ri Ra at Ri Ra Irish Pub Midtown'
  );
