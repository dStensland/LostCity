-- Goblin Day: per-group slug for shareable URLs + list_id on recommendations
-- for group-scoped public recommendations.
--
-- Keep this file mirrored in database/migrations and supabase/migrations.

-- 1. goblin_lists.slug (nullable; recommendations lists stay NULL)
ALTER TABLE goblin_lists
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2. Backfill slugs for existing non-recommendations lists.
--    Derives a dashed lowercase slug from name and resolves per-user
--    collisions by suffixing -2, -3, ...
DO $$
DECLARE
  rec RECORD;
  base_slug TEXT;
  candidate TEXT;
  n INT;
BEGIN
  FOR rec IN
    SELECT id, user_id, name
    FROM goblin_lists
    WHERE is_recommendations = false AND slug IS NULL
    ORDER BY created_at ASC
  LOOP
    base_slug := lower(regexp_replace(rec.name, '[^a-zA-Z0-9]+', '-', 'g'));
    base_slug := trim(both '-' from base_slug);
    IF base_slug = '' THEN
      base_slug := 'group';
    END IF;

    candidate := base_slug;
    n := 2;
    WHILE EXISTS (
      SELECT 1 FROM goblin_lists
      WHERE user_id = rec.user_id
        AND slug = candidate
        AND is_recommendations = false
    ) LOOP
      candidate := base_slug || '-' || n;
      n := n + 1;
    END LOOP;

    UPDATE goblin_lists SET slug = candidate WHERE id = rec.id;
  END LOOP;
END $$;

-- 3. Per-user unique slug (recommendations lists excluded)
CREATE UNIQUE INDEX IF NOT EXISTS idx_goblin_lists_user_slug
  ON goblin_lists (user_id, slug)
  WHERE is_recommendations = false AND slug IS NOT NULL;

-- 4. goblin_watchlist_recommendations.list_id — lets public group-scoped
--    recommendations target a specific group. Queue-wide recommendations
--    keep list_id = NULL and behave unchanged.
ALTER TABLE goblin_watchlist_recommendations
  ADD COLUMN IF NOT EXISTS list_id INTEGER
    REFERENCES goblin_lists(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_watchlist_rec_list
  ON goblin_watchlist_recommendations (list_id)
  WHERE list_id IS NOT NULL;
