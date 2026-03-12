-- Normalize stale event categories, clean up leftover specials, and
-- align live portal filters with the current taxonomy.

-- 1. Normalize obvious legacy category buckets in live event data.
UPDATE events
SET category_id = CASE
    WHEN category_id IN ('meetup', 'gaming', 'markets') THEN 'community'
    WHEN category_id IN ('dance', 'tours') THEN 'learning'
    ELSE category_id
  END,
  updated_at = NOW()
WHERE category_id IN ('meetup', 'gaming', 'markets', 'dance', 'tours');

-- 2. Specials should not persist as event content kinds.
UPDATE events
SET content_kind = 'event',
  updated_at = NOW()
WHERE content_kind = 'special'
  AND is_active = true
  AND start_date >= CURRENT_DATE;

-- 3. Fix live portal filters that still point at stale or overly broad buckets.
UPDATE portals
SET filters = jsonb_set(
    COALESCE(filters, '{}'::jsonb),
    '{categories}',
    '["art","theater"]'::jsonb,
    true
  )
WHERE slug = 'arts-atlanta';

UPDATE portals
SET filters = jsonb_set(
    jsonb_set(
      COALESCE(filters, '{}'::jsonb),
      '{categories}',
      '["family","community","art","theater","food_drink","learning","outdoors"]'::jsonb,
      true
    ),
    '{exclude_categories}',
    '["nightlife"]'::jsonb,
    true
  )
WHERE slug = 'atlanta-families';

UPDATE portals
SET filters = jsonb_set(
    COALESCE(filters, '{}'::jsonb),
    '{categories}',
    '["art","community","family","fitness","learning","outdoors"]'::jsonb,
    true
  )
WHERE slug = 'hooky';

-- 4. Normalize saved user preferences so old categories stop affecting
-- personalization and portal-scoped feeds.
WITH normalized_preferences AS (
  SELECT
    user_id,
    ARRAY(
      SELECT DISTINCT
        CASE category
          WHEN 'meetup' THEN 'community'
          WHEN 'gaming' THEN 'community'
          WHEN 'markets' THEN 'community'
          WHEN 'dance' THEN 'learning'
          WHEN 'tours' THEN 'learning'
          WHEN 'outdoor' THEN 'outdoors'
          ELSE category
        END
      FROM unnest(COALESCE(favorite_categories, '{}'::text[])) AS category
    ) AS favorite_categories
  FROM user_preferences
  WHERE favorite_categories && ARRAY['meetup', 'gaming', 'markets', 'dance', 'tours', 'outdoor']
)
UPDATE user_preferences up
SET favorite_categories = np.favorite_categories,
  updated_at = NOW()
FROM normalized_preferences np
WHERE up.user_id = np.user_id;
