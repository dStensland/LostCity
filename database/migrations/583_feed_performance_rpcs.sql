-- Migration 583: Feed performance RPCs and summary table
--
-- Problem: The city-pulse feed endpoint makes 26+ Supabase queries per cold
-- load. Three "count" queries are the worst offenders — they transfer hundreds
-- or thousands of event rows to the application layer just to count them by
-- category, genre, or tag. This migration replaces those with:
--
--   1. feed_category_counts — pre-computed summary table, refreshed post-crawl
--   2. refresh_feed_counts() — RPC called by the crawler after each run
--   3. get_venue_type_counts() — server-side venue type aggregation
--   4. count_open_spots() — server-side open-now count (no row transfer)
--   5. idx_events_source_date_feed — composite partial index for source-scoped
--      feed queries (canonical_event_id IS NULL, not class, not sensitive)
--   6. idx_events_active_future_feed — partial index for the tag-count endpoint
--
-- CONCURRENTLY indexes cannot run inside a transaction block. They are placed
-- at the end of this file, outside any transaction, matching the pattern used
-- in migrations 150 and 152.
--
-- Mirror this file in supabase/migrations/20260318160000_feed_performance_rpcs.sql
-- Update database/schema.sql when schema changes land in this file.


-- ============================================================
-- 1. feed_category_counts summary table
-- ============================================================

CREATE TABLE IF NOT EXISTS feed_category_counts (
  portal_id  UUID NOT NULL REFERENCES portals(id) ON DELETE CASCADE,
  window     TEXT NOT NULL CHECK (window IN ('today', 'week', 'coming_up')),
  dimension  TEXT NOT NULL CHECK (dimension IN ('category', 'genre', 'tag')),
  value      TEXT NOT NULL,
  cnt        INT  NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (portal_id, window, dimension, value)
);

-- RLS: public read (counts contain no PII)
ALTER TABLE feed_category_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read feed_category_counts"
  ON feed_category_counts
  FOR SELECT
  USING (true);


-- ============================================================
-- 2. refresh_feed_counts(p_portal_id) RPC
--
-- Recalculates all window/dimension counts for a portal.
-- Called by the crawler post-crawl script (crawlers/scripts/post_crawl_maintenance.py).
--
-- Dedup logic:
--   - For events that belong to a series (series_id IS NOT NULL), count the
--     series once per window — pick one representative event per series+window
--     using DISTINCT ON. This prevents a weekly recurring show from inflating
--     the "music" count by 52x.
--   - For standalone events (series_id IS NULL), count each event individually.
--     They have no shared identity to deduplicate against.
-- ============================================================

CREATE OR REPLACE FUNCTION refresh_feed_counts(p_portal_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_source_ids INT[];
  v_today      DATE := CURRENT_DATE;
  v_week_end   DATE := CURRENT_DATE + 7;
  v_coming_end DATE := CURRENT_DATE + 28;
BEGIN
  -- Resolve portal's source IDs from the materialized access view
  SELECT ARRAY_AGG(source_id) INTO v_source_ids
  FROM portal_source_access
  WHERE portal_id = p_portal_id;

  -- Clear existing counts for this portal before recomputing
  DELETE FROM feed_category_counts WHERE portal_id = p_portal_id;

  -- Compute and insert fresh counts
  INSERT INTO feed_category_counts (portal_id, window, dimension, value, cnt)
  WITH base AS (
    -- Eligible events within the 28-day coming_up window
    SELECT
      e.category_id,
      e.genres,
      e.tags,
      e.series_id,
      e.start_date
    FROM events e
    WHERE e.canonical_event_id IS NULL
      AND COALESCE(e.is_class, false)     = false
      AND COALESCE(e.is_sensitive, false) = false
      AND e.category_id IS NOT NULL
      AND e.category_id != 'film'
      AND (e.is_feed_ready = true OR e.is_feed_ready IS NULL)
      AND e.start_date >= v_today
      AND e.start_date <= v_coming_end
      AND (v_source_ids IS NULL OR e.source_id = ANY(v_source_ids))
  ),
  windowed AS (
    -- Assign each event to its most-specific applicable window
    SELECT
      CASE
        WHEN start_date = v_today          THEN 'today'
        WHEN start_date <= v_week_end      THEN 'week'
        ELSE                                    'coming_up'
      END AS window,
      category_id,
      genres,
      tags,
      series_id
    FROM base
  ),
  -- Deduplicate series events: one representative row per (window, series_id).
  -- Standalone events (series_id IS NULL) pass through as-is.
  deduped_series AS (
    SELECT DISTINCT ON (window, series_id)
      window, category_id, genres, tags
    FROM windowed
    WHERE series_id IS NOT NULL
    ORDER BY window, series_id
  ),
  standalone AS (
    SELECT window, category_id, genres, tags
    FROM windowed
    WHERE series_id IS NULL
  ),
  combined AS (
    SELECT * FROM deduped_series
    UNION ALL
    SELECT * FROM standalone
  )
  -- Category counts
  SELECT p_portal_id, window, 'category', category_id, COUNT(*)::INT
  FROM combined
  GROUP BY window, category_id

  UNION ALL

  -- Genre counts (unnest the genres array)
  SELECT p_portal_id, window, 'genre', g, COUNT(*)::INT
  FROM combined, unnest(genres) AS g
  WHERE genres IS NOT NULL
  GROUP BY window, g

  UNION ALL

  -- Tag counts (unnest the tags array)
  SELECT p_portal_id, window, 'tag', t, COUNT(*)::INT
  FROM combined, unnest(tags) AS t
  WHERE tags IS NOT NULL
  GROUP BY window, t;

  -- Refresh the updated_at timestamp for all rows just written
  UPDATE feed_category_counts
  SET updated_at = now()
  WHERE portal_id = p_portal_id;
END;
$$;


-- ============================================================
-- 3. get_venue_type_counts(p_city) RPC
--
-- Returns per-venue-type counts for active venues.
-- STABLE — safe to cache; does not modify data.
-- ============================================================

CREATE OR REPLACE FUNCTION get_venue_type_counts(p_city TEXT DEFAULT NULL)
RETURNS TABLE(venue_type TEXT, cnt BIGINT)
LANGUAGE sql
STABLE
AS $$
  SELECT v.venue_type, COUNT(*) AS cnt
  FROM venues v
  WHERE v.active = true
    AND v.venue_type IS NOT NULL
    AND (p_city IS NULL OR v.city ILIKE '%' || p_city || '%')
  GROUP BY v.venue_type;
$$;


-- ============================================================
-- 4. count_open_spots(p_venue_types, p_city) RPC
--
-- Returns a count of venues currently open, evaluated server-side
-- against each venue's hours JSONB. Avoids transferring 1,500+ venue
-- rows to the application layer just to count matches.
--
-- Hours JSONB format expected:
--   { "monday": { "open": "11:00", "close": "22:00" }, ... }
-- Day keys are lowercase full weekday names (monday, tuesday, ...).
--
-- Midnight-crossing hours (e.g. close = "02:00", open = "20:00") are
-- handled: if close <= open we treat the venue as open for any time
-- >= open OR any time <= close.
--
-- STABLE — safe to cache within a transaction; reads clock once.
-- ============================================================

CREATE OR REPLACE FUNCTION count_open_spots(
  p_venue_types TEXT[]  DEFAULT NULL,
  p_city        TEXT    DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_now      TIMESTAMPTZ := now() AT TIME ZONE 'America/New_York';
  v_day      TEXT        := LOWER(trim(to_char(v_now, 'Day')));
  v_time     TIME        := v_now::TIME;
  v_count    INT         := 0;
  v_hours    JSONB;
  v_day_hrs  JSONB;
  v_open     TIME;
  v_close    TIME;
BEGIN
  FOR v_hours IN
    SELECT hours
    FROM venues
    WHERE active = true
      AND hours IS NOT NULL
      AND (p_city IS NULL OR city ILIKE '%' || p_city || '%')
      AND (p_venue_types IS NULL OR venue_type = ANY(p_venue_types))
  LOOP
    v_day_hrs := v_hours->v_day;

    CONTINUE WHEN v_day_hrs IS NULL;
    CONTINUE WHEN v_day_hrs->>'open'  IS NULL;
    CONTINUE WHEN v_day_hrs->>'close' IS NULL;

    v_open  := (v_day_hrs->>'open')::TIME;
    v_close := (v_day_hrs->>'close')::TIME;

    IF v_close > v_open THEN
      -- Normal hours: open and close both on the same calendar day
      IF v_time >= v_open AND v_time <= v_close THEN
        v_count := v_count + 1;
      END IF;
    ELSE
      -- Midnight-crossing hours (e.g. open=20:00, close=02:00)
      IF v_time >= v_open OR v_time <= v_close THEN
        v_count := v_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;


-- ============================================================
-- 5 & 6. Indexes (CONCURRENTLY — must run outside a transaction)
-- ============================================================

-- Composite partial index for source-scoped feed queries.
-- Covers the WHERE clause shared by all portal feed endpoints:
--   canonical_event_id IS NULL AND is_class = false AND is_sensitive = false
-- With (source_id, start_date) as leading columns for portal_source_access joins.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_source_date_feed
  ON events (source_id, start_date)
  WHERE canonical_event_id IS NULL
    AND COALESCE(is_class, false)     = false
    AND COALESCE(is_sensitive, false) = false;

-- Partial index for the tag-count and active-future-event endpoints.
CREATE INDEX IF NOT EXISTS idx_events_active_future_feed
  ON events (start_date)
  WHERE is_active = true
    AND canonical_event_id IS NULL
    AND (is_feed_ready = true OR is_feed_ready IS NULL);
