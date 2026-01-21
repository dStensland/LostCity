-- Available Filters Table
-- Stores filter options that have active events (refreshed during daily crawl)

-- Table to store available filter values with counts
CREATE TABLE IF NOT EXISTS available_filters (
  id SERIAL PRIMARY KEY,
  filter_type TEXT NOT NULL, -- 'category', 'subcategory', 'tag'
  filter_value TEXT NOT NULL,
  display_label TEXT NOT NULL,
  parent_value TEXT, -- for subcategories, the parent category
  event_count INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(filter_type, filter_value)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_available_filters_type ON available_filters(filter_type);
CREATE INDEX IF NOT EXISTS idx_available_filters_type_parent ON available_filters(filter_type, parent_value);

-- Function to refresh available filters from events table
-- Call this after each crawl run
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
    COALESCE(c.name, INITCAP(REPLACE(e.category, '_', ' '))),
    COUNT(*),
    COALESCE(c.display_order, 999)
  FROM events e
  LEFT JOIN categories c ON c.id = COALESCE(e.category_id, e.category)
  WHERE e.start_date >= today
    AND e.is_active = true
    AND (e.category IS NOT NULL OR e.category_id IS NOT NULL)
  GROUP BY COALESCE(e.category_id, e.category), c.name, c.display_order
  ORDER BY COUNT(*) DESC;

  -- Insert available subcategories with counts
  INSERT INTO available_filters (filter_type, filter_value, display_label, parent_value, event_count, display_order)
  SELECT
    'subcategory',
    COALESCE(e.subcategory_id, e.subcategory),
    COALESCE(s.name, INITCAP(REPLACE(SPLIT_PART(e.subcategory, '.', 2), '_', ' '))),
    SPLIT_PART(COALESCE(e.subcategory_id, e.subcategory), '.', 1),
    COUNT(*),
    COALESCE(s.display_order, 999)
  FROM events e
  LEFT JOIN subcategories s ON s.id = COALESCE(e.subcategory_id, e.subcategory)
  WHERE e.start_date >= today
    AND e.is_active = true
    AND (e.subcategory IS NOT NULL OR e.subcategory_id IS NOT NULL)
  GROUP BY COALESCE(e.subcategory_id, e.subcategory), s.name, s.display_order
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
    AND e.is_active = true
    AND e.tags IS NOT NULL
    AND array_length(e.tags, 1) > 0
  GROUP BY unnest(e.tags)
  HAVING COUNT(*) >= 2  -- Only show tags with at least 2 events
  ORDER BY COUNT(*) DESC;

  -- Update timestamp
  UPDATE available_filters SET updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Initial population
SELECT refresh_available_filters();
