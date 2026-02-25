-- 265: Add per-post categories to network_posts
--
-- Previously, categories lived only on network_sources (the publication),
-- causing filtering issues — e.g., ALL posts from a multi-category source
-- like Rough Draft Atlanta appeared under "Arts" even if they were food reviews.
--
-- This migration adds a categories column directly on network_posts and
-- backfills it from source categories as a starting point. The backfill
-- script (backfill_post_categories.py) then reclassifies using keyword
-- matching for more accurate per-post categorization.

-- Add the column
ALTER TABLE network_posts
  ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}';

-- GIN index for efficient array containment queries (used by @> operator)
CREATE INDEX IF NOT EXISTS idx_network_posts_categories
  ON network_posts USING GIN (categories);

-- Coarse backfill: copy source-level categories to posts that have none
UPDATE network_posts np
SET categories = ns.categories
FROM network_sources ns
WHERE np.source_id = ns.id
  AND (np.categories IS NULL OR np.categories = '{}');
