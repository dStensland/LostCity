-- Goblin Queue Groups — extend goblin_lists and goblin_list_movies
-- for curated movie groups in the watchlist queue

-- 1. goblin_lists — add description, sort_order, is_recommendations
ALTER TABLE goblin_lists
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS sort_order integer,
  ADD COLUMN IF NOT EXISTS is_recommendations boolean NOT NULL DEFAULT false;

-- 2. goblin_list_movies — add sort_order and note
ALTER TABLE goblin_list_movies
  ADD COLUMN IF NOT EXISTS sort_order integer,
  ADD COLUMN IF NOT EXISTS note text;

-- 3. Indexes for efficient ordering
CREATE INDEX IF NOT EXISTS idx_goblin_lists_user_sort
  ON goblin_lists (user_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_goblin_list_movies_list_sort
  ON goblin_list_movies (list_id, sort_order);

-- 4. Unique constraint: only one recommendations list per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_goblin_lists_user_recommendations
  ON goblin_lists (user_id) WHERE is_recommendations = true;
