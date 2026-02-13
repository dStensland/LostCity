-- Migration 198: Add ranked full-text search for series, lists, and festivals
-- Brings these entities to parity with events/venues/organizers search quality.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- 1) SEARCH VECTORS + INDEXES
-- ============================================================================

ALTER TABLE series ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE lists ADD COLUMN IF NOT EXISTS search_vector tsvector;
ALTER TABLE festivals ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION series_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.genres, ' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.series_type, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.day_of_week, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.frequency, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS series_search_vector_trigger ON series;
CREATE TRIGGER series_search_vector_trigger
  BEFORE INSERT OR UPDATE
  ON series FOR EACH ROW EXECUTE FUNCTION series_search_vector_update();

CREATE OR REPLACE FUNCTION lists_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS lists_search_vector_trigger ON lists;
CREATE TRIGGER lists_search_vector_trigger
  BEFORE INSERT OR UPDATE
  ON lists FOR EACH ROW EXECUTE FUNCTION lists_search_vector_update();

CREATE OR REPLACE FUNCTION festivals_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.primary_type, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.festival_type, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.categories, ' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.experience_tags, ' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.genres, ' '), '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.location, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.neighborhood, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(NEW.notes, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS festivals_search_vector_trigger ON festivals;
CREATE TRIGGER festivals_search_vector_trigger
  BEFORE INSERT OR UPDATE
  ON festivals FOR EACH ROW EXECUTE FUNCTION festivals_search_vector_update();

-- Backfill vectors
UPDATE series SET search_vector =
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(tags, ' '), '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(genres, ' '), '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(series_type, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(category, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(day_of_week, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(frequency, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'C');

UPDATE lists SET search_vector =
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(category, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'C');

UPDATE festivals SET search_vector =
  setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(primary_type, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(festival_type, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(categories, ' '), '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(experience_tags, ' '), '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(array_to_string(genres, ' '), '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(location, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(neighborhood, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(description, '')), 'C') ||
  setweight(to_tsvector('english', COALESCE(notes, '')), 'D');

CREATE INDEX IF NOT EXISTS idx_series_search_vector ON series USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_series_title_trgm ON series USING GIN(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_lists_search_vector ON lists USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_lists_title_trgm ON lists USING GIN(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_festivals_search_vector ON festivals USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_festivals_name_trgm ON festivals USING GIN(name gin_trgm_ops);

-- ============================================================================
-- 2) RANKED RPC SEARCH FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION search_series_ranked(
    p_query TEXT,
    p_limit INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0,
    p_categories TEXT[] DEFAULT NULL
)
RETURNS TABLE(
    id UUID,
    title TEXT,
    slug TEXT,
    description TEXT,
    series_type TEXT,
    category TEXT,
    image_url TEXT,
    next_event_date DATE,
    upcoming_event_count INTEGER,
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
    WITH upcoming AS (
      SELECT
        e.series_id,
        MIN(e.start_date) AS next_event_date,
        COUNT(*)::INTEGER AS upcoming_event_count
      FROM events e
      WHERE
        e.series_id IS NOT NULL
        AND e.start_date >= CURRENT_DATE
        AND e.canonical_event_id IS NULL
      GROUP BY e.series_id
    )
    SELECT
      s.id,
      s.title,
      s.slug,
      s.description,
      s.series_type,
      s.category,
      s.image_url,
      u.next_event_date,
      COALESCE(u.upcoming_event_count, 0) AS upcoming_event_count,
      ts_rank_cd(s.search_vector, v_tsquery, 32)::REAL AS ts_rank,
      similarity(s.title, p_query)::REAL AS similarity_score,
      (
        ts_rank_cd(s.search_vector, v_tsquery, 32) * 0.6 +
        similarity(s.title, p_query) * 0.4 +
        CASE WHEN lower(s.title) = lower(p_query) THEN 1.0 ELSE 0 END +
        CASE WHEN lower(s.title) LIKE lower(p_query) || '%' THEN 0.5 ELSE 0 END
      )::REAL AS combined_score
    FROM series s
    LEFT JOIN upcoming u ON u.series_id = s.id
    WHERE
      COALESCE(s.is_active, true) = true
      AND (s.search_vector @@ v_tsquery OR similarity(s.title, p_query) > 0.2)
      AND (p_categories IS NULL OR s.category = ANY(p_categories))
    ORDER BY combined_score DESC, u.next_event_date ASC NULLS LAST, s.title ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_series_ranked IS 'Full-text search for series with relevance ranking, trigram similarity, and upcoming event counts.';

CREATE OR REPLACE FUNCTION search_lists_ranked(
    p_query TEXT,
    p_limit INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0,
    p_portal_id UUID DEFAULT NULL
)
RETURNS TABLE(
    id UUID,
    title TEXT,
    slug TEXT,
    description TEXT,
    category TEXT,
    creator_id UUID,
    creator_name TEXT,
    item_count INTEGER,
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
      l.id,
      l.title,
      l.slug,
      l.description,
      l.category,
      l.creator_id,
      COALESCE(NULLIF(p.display_name, ''), p.username, 'Unknown') AS creator_name,
      COALESCE(li.item_count, 0) AS item_count,
      ts_rank_cd(l.search_vector, v_tsquery, 32)::REAL AS ts_rank,
      similarity(l.title, p_query)::REAL AS similarity_score,
      (
        ts_rank_cd(l.search_vector, v_tsquery, 32) * 0.6 +
        similarity(l.title, p_query) * 0.4 +
        LEAST(COALESCE(li.item_count, 0), 20) * 0.01 +
        CASE WHEN lower(l.title) = lower(p_query) THEN 1.0 ELSE 0 END +
        CASE WHEN lower(l.title) LIKE lower(p_query) || '%' THEN 0.5 ELSE 0 END
      )::REAL AS combined_score
    FROM lists l
    LEFT JOIN profiles p ON p.id = l.creator_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::INTEGER AS item_count
      FROM list_items li
      WHERE li.list_id = l.id
    ) li ON true
    WHERE
      COALESCE(l.is_public, true) = true
      AND COALESCE(l.status, 'active') = 'active'
      AND (l.search_vector @@ v_tsquery OR similarity(l.title, p_query) > 0.2)
      AND (p_portal_id IS NULL OR l.portal_id = p_portal_id)
    ORDER BY combined_score DESC, COALESCE(li.item_count, 0) DESC, l.title ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_lists_ranked IS 'Full-text search for public community lists with relevance ranking and item-count quality signal.';

CREATE OR REPLACE FUNCTION search_festivals_ranked(
    p_query TEXT,
    p_limit INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0,
    p_portal_id UUID DEFAULT NULL
)
RETURNS TABLE(
    id TEXT,
    name TEXT,
    slug TEXT,
    description TEXT,
    image_url TEXT,
    announced_start DATE,
    announced_end DATE,
    primary_type TEXT,
    festival_type TEXT,
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
      f.id,
      f.name,
      f.slug,
      f.description,
      f.image_url,
      f.announced_start,
      f.announced_end,
      f.primary_type,
      f.festival_type,
      ts_rank_cd(f.search_vector, v_tsquery, 32)::REAL AS ts_rank,
      similarity(f.name, p_query)::REAL AS similarity_score,
      (
        ts_rank_cd(f.search_vector, v_tsquery, 32) * 0.6 +
        similarity(f.name, p_query) * 0.4 +
        CASE WHEN lower(f.name) = lower(p_query) THEN 1.0 ELSE 0 END +
        CASE WHEN lower(f.name) LIKE lower(p_query) || '%' THEN 0.5 ELSE 0 END
      )::REAL AS combined_score
    FROM festivals f
    WHERE
      (f.search_vector @@ v_tsquery OR similarity(f.name, p_query) > 0.2)
      AND (p_portal_id IS NULL OR f.portal_id = p_portal_id)
    ORDER BY combined_score DESC, COALESCE(f.announced_start, f.last_year_start) ASC NULLS LAST, f.name ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_festivals_ranked IS 'Full-text search for festivals with relevance ranking and trigram similarity.';

-- ============================================================================
-- 3) FACETS: INCLUDE SERIES/LISTS/FESTIVALS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_search_facets(
    p_query TEXT,
    p_portal_id UUID DEFAULT NULL
)
RETURNS TABLE(
    entity_type TEXT,
    count BIGINT
) AS $$
DECLARE
    v_tsquery tsquery;
    v_search_terms TEXT;
BEGIN
    v_search_terms := regexp_replace(trim(p_query), '\s+', ' & ', 'g') || ':*';
    v_tsquery := to_tsquery('english', v_search_terms);

    RETURN QUERY
    SELECT 'event'::TEXT AS entity_type, COUNT(*)::BIGINT
    FROM events e
    WHERE
      (e.search_vector @@ v_tsquery OR similarity(e.title, p_query) > 0.2)
      AND e.start_date >= CURRENT_DATE
      AND e.canonical_event_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM series s
        WHERE s.id = e.series_id
        AND s.series_type = 'festival_program'
      )
      AND (
        p_portal_id IS NULL
        OR EXISTS (
          SELECT 1 FROM portal_source_access psa
          WHERE psa.portal_id = p_portal_id
          AND psa.source_id = e.source_id
        )
      );

    RETURN QUERY
    SELECT 'venue'::TEXT AS entity_type, COUNT(*)::BIGINT
    FROM venues v
    WHERE
      v.active = true
      AND (v.search_vector @@ v_tsquery OR similarity(v.name, p_query) > 0.2);

    RETURN QUERY
    SELECT 'organizer'::TEXT AS entity_type, COUNT(*)::BIGINT
    FROM organizations o
    WHERE
      o.hidden = false
      AND (o.search_vector @@ v_tsquery OR similarity(o.name, p_query) > 0.2);

    RETURN QUERY
    SELECT 'series'::TEXT AS entity_type, COUNT(*)::BIGINT
    FROM series s
    WHERE
      COALESCE(s.is_active, true) = true
      AND (s.search_vector @@ v_tsquery OR similarity(s.title, p_query) > 0.2);

    RETURN QUERY
    SELECT 'list'::TEXT AS entity_type, COUNT(*)::BIGINT
    FROM lists l
    WHERE
      COALESCE(l.is_public, true) = true
      AND COALESCE(l.status, 'active') = 'active'
      AND (l.search_vector @@ v_tsquery OR similarity(l.title, p_query) > 0.2)
      AND (p_portal_id IS NULL OR l.portal_id = p_portal_id);

    RETURN QUERY
    SELECT 'festival'::TEXT AS entity_type, COUNT(*)::BIGINT
    FROM festivals f
    WHERE
      (f.search_vector @@ v_tsquery OR similarity(f.name, p_query) > 0.2)
      AND (p_portal_id IS NULL OR f.portal_id = p_portal_id);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_search_facets IS 'Returns count of matching results per entity type across events, venues, organizers, series, lists, and festivals.';
