-- Finish the Atlanta-core sports cleanup pass.
-- 1) Keep one canonical ESFNA tentpole row as Sports.
-- 2) Remove the stale duplicate ESFNA fitness row.
-- 3) Remove the leftover MJCCA pickleball-hours row from the public feed.

UPDATE events
SET
  category_id = 'sports',
  tags = ARRAY(
    SELECT DISTINCT tag
    FROM unnest(
      coalesce(tags, ARRAY[]::text[])
      || ARRAY['sports']
    ) AS tag
  ),
  updated_at = now()
WHERE source_id = 654
  AND is_active = true
  AND title = 'ESFNA Ethiopian Sports & Cultural Festival'
  AND category_id = 'community';

UPDATE events
SET
  is_active = false,
  updated_at = now()
WHERE source_id = 654
  AND is_active = true
  AND title = 'ESFNA Ethiopian Sports & Cultural Festival'
  AND category_id = 'fitness';

UPDATE events
SET
  is_active = false,
  updated_at = now()
WHERE source_id = 570
  AND is_active = true
  AND start_date >= current_date
  AND title = 'Abridged Hours for Erev Passover (pickleball)';
