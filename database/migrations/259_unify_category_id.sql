-- Unify category / category_id
-- The events table has two overlapping columns: `category` (text) and `category_id` (text FK).
-- Crawlers wrote to `category`, the web read `category_id`, and COALESCE bridged them.
-- This migration consolidates to just `category_id`.

-- Step 1: Normalize orphan category values that don't exist in categories table
UPDATE events SET category = 'food_drink' WHERE category = 'food' AND category_id IS NULL;
UPDATE events SET category = 'community' WHERE category IN ('social', 'support_group', 'home', 'mystery', 'pop_culture') AND category_id IS NULL;
UPDATE events SET category = 'art' WHERE category = 'museums' AND category_id IS NULL;
UPDATE events SET category = 'theater' WHERE category = 'performing-arts' AND category_id IS NULL;
UPDATE events SET category = 'community' WHERE category = 'festival' AND category_id IS NULL;

-- Step 2: Backfill category_id from category where missing
UPDATE events
SET category_id = category
WHERE category_id IS NULL
  AND category IS NOT NULL;

-- Step 3: Drop dependent objects that reference the `category` column
DROP VIEW IF EXISTS events_deduplicated;
DROP TRIGGER IF EXISTS events_search_vector_trigger ON events;
DROP MATERIALIZED VIEW IF EXISTS search_suggestions;

-- Step 4: Drop the legacy column
ALTER TABLE events DROP COLUMN IF EXISTS category;

-- Step 5: Update search vector function to use category_id instead of category
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

-- Step 6: Recreate trigger with category_id instead of category
CREATE TRIGGER events_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, tags, category_id, description, raw_text, genres
  ON events
  FOR EACH ROW
  EXECUTE FUNCTION events_search_vector_update();

-- Step 7: Recreate events_deduplicated view without the dropped `category` column
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

-- Step 8: Recreate search_suggestions materialized view using category_id
CREATE MATERIALIZED VIEW search_suggestions AS
WITH event_titles AS (
  SELECT DISTINCT title AS text, 'event'::text AS type, count(*) AS frequency
  FROM events
  WHERE start_date >= CURRENT_DATE AND canonical_event_id IS NULL
  GROUP BY title
), venue_names AS (
  SELECT name AS text, 'venue'::text AS type, count(*) AS frequency
  FROM venues
  WHERE active = true
  GROUP BY name
), neighborhoods AS (
  SELECT DISTINCT neighborhood AS text, 'neighborhood'::text AS type, count(*) AS frequency
  FROM venues
  WHERE neighborhood IS NOT NULL AND active = true
  GROUP BY neighborhood
), producers AS (
  SELECT name AS text, 'organizer'::text AS type, COALESCE(total_events_tracked, 1) AS frequency
  FROM organizations
  WHERE hidden = false
), categories AS (
  SELECT DISTINCT category_id AS text, 'category'::text AS type, count(*) AS frequency
  FROM events
  WHERE category_id IS NOT NULL AND start_date >= CURRENT_DATE
  GROUP BY category_id
), tags AS (
  SELECT unnest(tags) AS text, 'tag'::text AS type, count(*) AS frequency
  FROM events
  WHERE start_date >= CURRENT_DATE AND tags IS NOT NULL
  GROUP BY unnest(tags)
  HAVING count(*) >= 3
), vibes AS (
  SELECT DISTINCT unnest(vibes) AS text, 'vibe'::text AS type, count(*) AS frequency
  FROM venues
  WHERE vibes IS NOT NULL AND active = true
  GROUP BY unnest(vibes)
  HAVING count(*) >= 2
), festival_names AS (
  SELECT DISTINCT name AS text, 'festival'::text AS type, 1::bigint AS frequency
  FROM festivals
)
SELECT text, type, frequency FROM event_titles WHERE text IS NOT NULL AND length(text) > 0
UNION ALL
SELECT text, type, frequency FROM venue_names WHERE text IS NOT NULL AND length(text) > 0
UNION ALL
SELECT text, type, frequency FROM neighborhoods WHERE text IS NOT NULL AND length(text) > 0
UNION ALL
SELECT text, type, frequency FROM producers WHERE text IS NOT NULL AND length(text) > 0
UNION ALL
SELECT text, type, frequency FROM categories WHERE text IS NOT NULL AND length(text) > 0
UNION ALL
SELECT text, type, frequency FROM tags WHERE text IS NOT NULL AND length(text) > 0
UNION ALL
SELECT text, type, frequency FROM vibes WHERE text IS NOT NULL AND length(text) > 0
UNION ALL
SELECT text, type, frequency FROM festival_names WHERE text IS NOT NULL AND length(text) > 0;

-- Step 9: Update refresh_available_filters() to use only category_id
CREATE OR REPLACE FUNCTION refresh_available_filters()
RETURNS void AS $$
DECLARE
  today DATE := CURRENT_DATE;
BEGIN
  -- Clear existing filters
  DELETE FROM available_filters;

  -- Insert available categories with counts (using category_id only)
  INSERT INTO available_filters (filter_type, filter_value, display_label, event_count, display_order)
  SELECT
    'category',
    e.category_id,
    COALESCE(c.name, INITCAP(REPLACE(e.category_id, '_', ' '))),
    COUNT(*),
    COALESCE(c.display_order, 999)
  FROM events e
  LEFT JOIN categories c ON c.id = e.category_id
  WHERE e.start_date >= today
    AND e.canonical_event_id IS NULL
    AND e.category_id IS NOT NULL
  GROUP BY e.category_id, c.name, c.display_order
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
