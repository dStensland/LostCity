-- Migration: Event Feed Quality Gate
-- PRD 027: Rule-based feed filtering via is_feed_ready boolean + trigger
--
-- Events without sufficient content are held from feed/discovery queries.
-- The trigger auto-promotes events when their data improves (description/image added).
-- Direct event detail pages and admin views are NOT affected.

-- 1. Add the column (DEFAULT TRUE = backward compatible, existing events pass)
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_feed_ready BOOLEAN DEFAULT TRUE;

-- 2. Trigger function: compute is_feed_ready from title, description, image_url, series_id
CREATE OR REPLACE FUNCTION compute_is_feed_ready() RETURNS TRIGGER AS $$
BEGIN
  -- Rule 1: Skeleton event — no description AND no image AND no series
  -- An event with only a title provides no useful information to users.
  IF NEW.description IS NULL AND NEW.image_url IS NULL AND NEW.series_id IS NULL THEN
    NEW.is_feed_ready := FALSE;
    RETURN NEW;
  END IF;

  -- Rule 2: Generic title with no description AND no series
  -- These titles are only useful with context (which venue, what's special).
  -- Events with series_id are structured recurring events (Regular Hangs) — don't hold.
  IF NEW.description IS NULL AND NEW.series_id IS NULL AND LOWER(TRIM(NEW.title)) IN (
    'happy hour', 'open mic', 'trivia', 'trivia night', 'karaoke', 'karaoke night',
    'bingo', 'dj night', 'live music', 'brunch', 'sunday brunch', 'weekend brunch',
    'sunday brunch buffet', 'bottomless brunch', 'bottomless mimosa brunch',
    'jazz brunch', 'ladies night', 'wine night', 'date night', 'wing deal',
    'all day happy hour', 'oyster happy hour', 'taco tuesday',
    'tuesday dance night', 'drag nite', 'meditation'
  ) THEN
    NEW.is_feed_ready := FALSE;
    RETURN NEW;
  END IF;

  -- Rule 3: Decontextualized title (Round N, Game N, Match N) with no description
  -- Sports rounds/games without any context are noise.
  IF NEW.description IS NULL AND NEW.title ~* '^(Round|Game|Match)\s+\d+$' THEN
    NEW.is_feed_ready := FALSE;
    RETURN NEW;
  END IF;

  -- All rules passed — event is feed-ready
  NEW.is_feed_ready := TRUE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create trigger on relevant columns
-- Fires on INSERT and on UPDATE of columns that affect feed readiness.
-- If a crawler later adds a description, the trigger re-evaluates and promotes.
DROP TRIGGER IF EXISTS trg_compute_feed_ready ON events;
CREATE TRIGGER trg_compute_feed_ready
  BEFORE INSERT OR UPDATE OF title, description, image_url, series_id
  ON events FOR EACH ROW
  EXECUTE FUNCTION compute_is_feed_ready();

-- 4. Backfill: force trigger evaluation on all future events
-- The trigger fires on UPDATE OF title, so `SET title = title` is a no-op
-- that triggers re-evaluation without changing any data.
UPDATE events SET title = title WHERE start_date >= CURRENT_DATE;

-- 5. Partial index for feed queries: skip held events during range scans
-- Note: CONCURRENTLY cannot run inside a transaction block (which migrations use).
-- Using standard CREATE INDEX here; it acquires a brief lock but is safe at migration time.
CREATE INDEX IF NOT EXISTS idx_events_feed_ready_start_date
  ON events(start_date) WHERE is_feed_ready = true;

-- 6. Patch search_events_ranked to exclude held events (unconditional, no parameter)
-- Drop existing signatures first
DROP FUNCTION IF EXISTS search_events_ranked(text, integer, integer, text[], text[], text, boolean, uuid, text[], text[]);
DROP FUNCTION IF EXISTS search_events_ranked(text, integer, integer, text[], text[], text, boolean, uuid, text[], text[], text[]);

CREATE OR REPLACE FUNCTION search_events_ranked(
    p_query TEXT,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0,
    p_categories TEXT[] DEFAULT NULL,
    p_neighborhoods TEXT[] DEFAULT NULL,
    p_date_filter TEXT DEFAULT NULL,
    p_is_free BOOLEAN DEFAULT NULL,
    p_portal_id UUID DEFAULT NULL,
    p_subcategories TEXT[] DEFAULT NULL,
    p_tags TEXT[] DEFAULT NULL,
    p_genres TEXT[] DEFAULT NULL
)
RETURNS TABLE(
    id INTEGER,
    title TEXT,
    description TEXT,
    start_date DATE,
    start_time TIME,
    end_date DATE,
    end_time TIME,
    category TEXT,
    subcategory TEXT,
    tags TEXT[],
    genres TEXT[],
    is_free BOOLEAN,
    price_min DECIMAL,
    price_max DECIMAL,
    image_url TEXT,
    source_url TEXT,
    ticket_url TEXT,
    venue_id INTEGER,
    venue_name TEXT,
    venue_neighborhood TEXT,
    venue_address TEXT,
    venue_lat DECIMAL,
    venue_lng DECIMAL,
    ts_rank REAL,
    similarity_score REAL,
    combined_score REAL
) AS $$
DECLARE
    v_tsquery tsquery;
    v_search_terms TEXT;
BEGIN
    v_search_terms := regexp_replace(trim(p_query), '\s+', ' & ', 'g') || ':*';
    v_tsquery := to_tsquery('english', v_search_terms);

    RETURN QUERY
    SELECT
        e.id,
        e.title,
        e.description,
        e.start_date,
        e.start_time,
        e.end_date,
        e.end_time,
        e.category_id AS category,
        NULL::TEXT AS subcategory,
        e.tags,
        e.genres,
        e.is_free,
        e.price_min,
        e.price_max,
        e.image_url,
        e.source_url,
        e.ticket_url,
        e.venue_id,
        v.name AS venue_name,
        v.neighborhood AS venue_neighborhood,
        v.address AS venue_address,
        v.lat AS venue_lat,
        v.lng AS venue_lng,
        ts_rank_cd(e.search_vector, v_tsquery, 32)::REAL AS ts_rank,
        similarity(e.title, p_query)::REAL AS similarity_score,
        (
            (
                ts_rank_cd(e.search_vector, v_tsquery, 32) * 0.7 +
                similarity(e.title, p_query) * 0.3 +
                CASE WHEN lower(e.title) = lower(p_query) THEN 1.0 ELSE 0 END +
                CASE WHEN lower(e.title) LIKE lower(p_query) || '%' THEN 0.5 ELSE 0 END
            )
            * CASE
                WHEN e.start_date <= CURRENT_DATE + 1 THEN 2.0
                WHEN e.start_date <= CURRENT_DATE + 3 THEN 1.5
                WHEN e.start_date <= CURRENT_DATE + 7 THEN 1.0
                ELSE 0.6
              END
            * (COALESCE(e.data_quality, 50)::REAL / 100.0)
        )::REAL AS combined_score
    FROM events e
    LEFT JOIN venues v ON e.venue_id = v.id
    WHERE
        (e.search_vector @@ v_tsquery OR similarity(e.title, p_query) > 0.2)
        AND e.start_date >= CURRENT_DATE
        AND e.canonical_event_id IS NULL
        AND (e.is_sensitive IS NULL OR e.is_sensitive = false)
        AND (e.is_active IS NULL OR e.is_active = true)
        -- Feed quality gate: exclude held events (backward-compat NULL fallback)
        AND (e.is_feed_ready IS NULL OR e.is_feed_ready = true)
        AND NOT EXISTS (
            SELECT 1 FROM series s
            WHERE s.id = e.series_id
            AND s.series_type = 'festival_program'
        )
        AND (p_categories IS NULL OR e.category_id = ANY(p_categories))
        AND (p_neighborhoods IS NULL OR v.neighborhood = ANY(p_neighborhoods))
        AND (p_is_free IS NULL OR e.is_free = p_is_free)
        AND (
            p_date_filter IS NULL
            OR (p_date_filter = 'today' AND e.start_date = CURRENT_DATE)
            OR (p_date_filter = 'tomorrow' AND e.start_date = CURRENT_DATE + 1)
            OR (p_date_filter = 'weekend' AND e.start_date BETWEEN
                (CURRENT_DATE + (6 - EXTRACT(DOW FROM CURRENT_DATE)::INT) % 7)
                AND (CURRENT_DATE + (6 - EXTRACT(DOW FROM CURRENT_DATE)::INT) % 7 + 1))
            OR (p_date_filter = 'week' AND e.start_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7)
        )
        AND (
            p_portal_id IS NULL
            OR EXISTS (
                SELECT 1 FROM portal_source_access psa
                WHERE psa.portal_id = p_portal_id
                AND psa.source_id = e.source_id
                AND (psa.accessible_categories IS NULL OR e.category_id = ANY(psa.accessible_categories))
            )
        )
        AND (p_genres IS NULL OR e.genres && p_genres)
        AND (p_tags IS NULL OR e.tags && p_tags)
    ORDER BY combined_score DESC, e.start_date ASC, e.start_time ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_events_ranked(text, integer, integer, text[], text[], text, boolean, uuid, text[], text[], text[])
IS 'Full-text search for events with time-decay, unified data_quality ranking, and feed quality gate. v4 2026-03-04.';
