-- 20260314183005_category_consolidation.sql
-- Phase B: Standardize on category_id, eliminate the category/category_id split.
--
-- The events table has two overlapping columns: `category` (text) and `category_id` (text FK).
-- Crawlers wrote to `category`, the insert pipeline renames it to `category_id` at insert time.
-- This migration ensures all rows have `category_id` populated.
--
-- Column drop is DEFERRED to a follow-up migration after 1 week.

-- Step 1: Normalize orphan category values that don't match the categories table
UPDATE events SET category = 'food_drink'  WHERE category = 'food'             AND category_id IS NULL;
UPDATE events SET category = 'community'   WHERE category IN ('social', 'support_group', 'home', 'mystery', 'pop_culture') AND category_id IS NULL;
UPDATE events SET category = 'art'         WHERE category = 'museums'           AND category_id IS NULL;
UPDATE events SET category = 'theater'     WHERE category = 'performing-arts'   AND category_id IS NULL;
UPDATE events SET category = 'community'   WHERE category = 'festival'          AND category_id IS NULL;

-- Step 2: Backfill category_id from category where missing
UPDATE events
SET category_id = category
WHERE category_id IS NULL
  AND category IS NOT NULL;

-- Step 3: Update search vector function to use category_id instead of category
CREATE OR REPLACE FUNCTION events_search_vector_update()
RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.category_id, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.genres, ' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.raw_text, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Recreate trigger to fire on category_id changes (not category)
DROP TRIGGER IF EXISTS events_search_vector_trigger ON events;
CREATE TRIGGER events_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, tags, category_id, description, raw_text, genres
  ON events
  FOR EACH ROW
  EXECUTE FUNCTION events_search_vector_update();

-- Step 5: Recreate events_deduplicated view with category_id instead of category
DROP VIEW IF EXISTS events_deduplicated;
CREATE OR REPLACE VIEW events_deduplicated AS
SELECT
  id, source_id, venue_id, title, description,
  start_date, start_time, end_date, end_time, is_all_day,
  category_id,
  tags, price_min, price_max, price_note, is_free,
  source_url, ticket_url, image_url, raw_text,
  extraction_confidence, is_recurring, recurrence_rule,
  content_hash, canonical_event_id,
  created_at, updated_at,
  organization_id AS producer_id,
  attendee_count, is_live, is_featured, is_trending, portal_id
FROM events
WHERE canonical_event_id IS NULL;

-- Note: Column drop (ALTER TABLE events DROP COLUMN IF EXISTS category)
-- is DEFERRED to a follow-up migration after confirming no regressions.
