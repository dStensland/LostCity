-- Kill Subcategories
-- Removes the deprecated subcategory system (replaced by genres in migration 165).
-- Handles dependent objects: events_deduplicated view, events_search_vector_trigger.

-- Step 1: Remove FK constraint first (may have been added by migration 001)
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_subcategory_id_fkey;

-- Step 2: Drop dependent objects that reference subcategory columns
DROP VIEW IF EXISTS events_deduplicated;

DROP TRIGGER IF EXISTS events_search_vector_trigger ON events;

-- Step 3: Drop deprecated columns from events
ALTER TABLE events DROP COLUMN IF EXISTS subcategory;
ALTER TABLE events DROP COLUMN IF EXISTS subcategory_id;

-- Step 4: Drop the subcategories table
DROP TABLE IF EXISTS subcategories;

-- Step 5: Recreate search vector trigger WITHOUT subcategory in column list
CREATE TRIGGER events_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, tags, category, description, raw_text, genres
  ON events
  FOR EACH ROW
  EXECUTE FUNCTION events_search_vector_update();

-- Step 6: Recreate events_deduplicated view WITHOUT subcategory columns
CREATE OR REPLACE VIEW events_deduplicated AS
SELECT
  id, source_id, venue_id, title, description,
  start_date, start_time, end_date, end_time, is_all_day,
  category,
  tags, price_min, price_max, price_note, is_free,
  source_url, ticket_url, image_url, raw_text,
  extraction_confidence, is_recurring, recurrence_rule,
  content_hash, canonical_event_id,
  created_at, updated_at,
  category_id,
  organization_id AS producer_id,
  attendee_count, is_live, is_featured, is_trending, portal_id
FROM events
WHERE canonical_event_id IS NULL;

-- Step 7: Clean up any existing subcategory rows from available_filters (if table exists)
DELETE FROM available_filters WHERE filter_type = 'subcategory';

-- Step 8: Replace refresh_available_filters() without subcategory block
CREATE OR REPLACE FUNCTION refresh_available_filters()
RETURNS void AS $$
DECLARE
  today DATE := CURRENT_DATE;
BEGIN
  -- Clear existing filters
  DELETE FROM available_filters;

  -- Insert available categories with counts
  INSERT INTO available_filters (filter_type, filter_value, display_label, event_count, display_order)
  SELECT
    'category',
    COALESCE(e.category_id, e.category),
    COALESCE(c.name, INITCAP(REPLACE(COALESCE(e.category_id, e.category), '_', ' '))),
    COUNT(*),
    COALESCE(c.display_order, 999)
  FROM events e
  LEFT JOIN categories c ON c.id = COALESCE(e.category_id, e.category)
  WHERE e.start_date >= today
    AND e.canonical_event_id IS NULL
    AND (e.category IS NOT NULL OR e.category_id IS NOT NULL)
  GROUP BY COALESCE(e.category_id, e.category), c.name, c.display_order
  ORDER BY COUNT(*) DESC;

  -- Insert available tags with counts (unnest the tags array)
  INSERT INTO available_filters (filter_type, filter_value, display_label, event_count, display_order)
  SELECT
    'tag',
    unnest(e.tags),
    INITCAP(REPLACE(unnest(e.tags), '-', ' ')),
    COUNT(*),
    0
  FROM events e
  WHERE e.start_date >= today
    AND e.canonical_event_id IS NULL
    AND e.tags IS NOT NULL
    AND array_length(e.tags, 1) > 0
  GROUP BY unnest(e.tags)
  HAVING COUNT(*) >= 2  -- Only show tags with at least 2 events
  ORDER BY COUNT(*) DESC;

  -- Update timestamp
  UPDATE available_filters SET updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Step 9: Drop the index on the now-removed column
DROP INDEX IF EXISTS idx_events_subcategory_id;
