-- Extend available_filters for genres and vibes.
-- Also ensures the table exists (migration 026 may not have been applied).

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS available_filters (
  id SERIAL PRIMARY KEY,
  filter_type TEXT NOT NULL,        -- 'category', 'genre', 'tag', 'vibe'
  filter_value TEXT NOT NULL,
  display_label TEXT NOT NULL,
  parent_value TEXT,                -- for genres: the parent category_id
  event_count INTEGER DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(filter_type, filter_value, parent_value)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_available_filters_type ON available_filters(filter_type);
CREATE INDEX IF NOT EXISTS idx_available_filters_type_parent ON available_filters(filter_type, parent_value);

-- Replace refresh function with genre + vibe support
-- NOTE: events table has no is_active column; we filter by start_date and canonical_event_id IS NULL
CREATE OR REPLACE FUNCTION refresh_available_filters()
RETURNS void AS $$
DECLARE
  today DATE := CURRENT_DATE;
BEGIN
  -- Clear existing filters
  DELETE FROM available_filters;

  -- ─── Categories ────────────────────────────────────────────────────────────
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

  -- ─── Genres (NEW) ──────────────────────────────────────────────────────────
  -- Unnest events.genres[], parent_value = category_id for UI grouping
  INSERT INTO available_filters (filter_type, filter_value, display_label, parent_value, event_count, display_order)
  SELECT
    'genre',
    g.genre,
    COALESCE(td.label, INITCAP(REPLACE(g.genre, '-', ' '))),
    g.category_id,
    g.cnt,
    COALESCE(td.display_order, 999)
  FROM (
    SELECT
      unnest(e.genres) AS genre,
      e.category_id,
      COUNT(*) AS cnt
    FROM events e
    WHERE e.start_date >= today
      AND e.canonical_event_id IS NULL
      AND e.genres IS NOT NULL
      AND array_length(e.genres, 1) > 0
      AND e.category_id IS NOT NULL
    GROUP BY unnest(e.genres), e.category_id
    HAVING COUNT(*) >= 2
  ) g
  LEFT JOIN taxonomy_definitions td ON td.id = g.genre AND td.taxonomy_type = 'genre'
  ORDER BY g.cnt DESC;

  -- ─── Tags ──────────────────────────────────────────────────────────────────
  INSERT INTO available_filters (filter_type, filter_value, display_label, event_count, display_order)
  SELECT
    'tag',
    t.tag,
    INITCAP(REPLACE(t.tag, '-', ' ')),
    t.cnt,
    0
  FROM (
    SELECT unnest(e.tags) AS tag, COUNT(*) AS cnt
    FROM events e
    WHERE e.start_date >= today
      AND e.canonical_event_id IS NULL
      AND e.tags IS NOT NULL
      AND array_length(e.tags, 1) > 0
    GROUP BY unnest(e.tags)
    HAVING COUNT(*) >= 2
  ) t
  ORDER BY t.cnt DESC;

  -- ─── Vibes (NEW) ──────────────────────────────────────────────────────────
  -- Count active venues per vibe for spots filter UI
  INSERT INTO available_filters (filter_type, filter_value, display_label, event_count, display_order)
  SELECT
    'vibe',
    vibe_val,
    COALESCE(td.label, INITCAP(REPLACE(vibe_val, '-', ' '))),
    COUNT(*),
    COALESCE(td.display_order, 999)
  FROM venues v,
    LATERAL unnest(v.vibes) AS vibe_val
  LEFT JOIN taxonomy_definitions td ON td.id = vibe_val AND td.taxonomy_type = 'venue_vibe'
  WHERE v.active = true
    AND v.vibes IS NOT NULL
    AND array_length(v.vibes, 1) > 0
  GROUP BY vibe_val, td.label, td.display_order
  ORDER BY COUNT(*) DESC;

  -- Update timestamp
  UPDATE available_filters SET updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Run initial refresh to populate
SELECT refresh_available_filters();
