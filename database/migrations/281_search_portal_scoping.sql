-- Migration 281: Portal-scope all search RPCs
--
-- Adds city/portal filtering to every search-related RPC that was previously global.
-- All new params have DEFAULT NULL for backward compatibility.
--
-- Changes:
--   1a. get_metro_cities()           – helper to expand a city to its metro area
--   1b. search_venues_ranked         – metro-aware city filter (replaces exact match)
--   1c. search_organizations_ranked  – add p_portal_id
--   1d. search_series_ranked         – add p_portal_id (via events join)
--   1e. get_search_facets            – add p_city, portal-scope venue/org/series counts
--   1f. search_suggestions MV        – add city column
--   1g. get_similar_suggestions      – add p_city
--   1g. get_spelling_suggestions     – add p_city
--   1h. drop search_unified

-- ============================================================
-- 1a. Metro cities helper
-- ============================================================
CREATE OR REPLACE FUNCTION get_metro_cities(p_city TEXT)
RETURNS TEXT[] AS $$
BEGIN
  IF p_city IS NULL THEN
    RETURN NULL;
  END IF;

  IF lower(p_city) IN (
    'atlanta', 'alpharetta', 'avondale estates', 'brookhaven',
    'chamblee', 'college park', 'decatur', 'doraville', 'duluth',
    'dunwoody', 'east point', 'johns creek', 'kennesaw',
    'lawrenceville', 'marietta', 'peachtree city', 'roswell',
    'sandy springs', 'smyrna', 'stone mountain', 'tucker', 'woodstock'
  ) THEN
    RETURN ARRAY[
      'Atlanta', 'Alpharetta', 'Avondale Estates', 'Brookhaven',
      'Chamblee', 'College Park', 'Decatur', 'Doraville', 'Duluth',
      'Dunwoody', 'East Point', 'Johns Creek', 'Kennesaw',
      'Lawrenceville', 'Marietta', 'Peachtree City', 'Roswell',
      'Sandy Springs', 'Smyrna', 'Stone Mountain', 'Tucker', 'Woodstock'
    ];
  END IF;

  -- Non-metro city: return single-element array
  RETURN ARRAY[p_city];
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_metro_cities IS 'Returns array of metro-area cities for known metros (Atlanta), or single-element array for other cities. Used by search RPCs.';

-- ============================================================
-- 1b. search_venues_ranked – metro-aware city filter
-- ============================================================
CREATE OR REPLACE FUNCTION search_venues_ranked(
    p_query TEXT,
    p_limit INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0,
    p_neighborhoods TEXT[] DEFAULT NULL,
    p_spot_types TEXT[] DEFAULT NULL,
    p_vibes TEXT[] DEFAULT NULL,
    p_city TEXT DEFAULT NULL
)
RETURNS TABLE(
    id INTEGER,
    name TEXT,
    slug TEXT,
    address TEXT,
    neighborhood TEXT,
    spot_type TEXT,
    spot_types TEXT[],
    vibes TEXT[],
    description TEXT,
    short_description TEXT,
    lat DECIMAL,
    lng DECIMAL,
    image_url TEXT,
    website TEXT,
    ts_rank REAL,
    similarity_score REAL,
    combined_score REAL
) AS $$
DECLARE
    v_tsquery tsquery;
    v_search_terms TEXT;
    v_metro_cities TEXT[];
BEGIN
    v_search_terms := regexp_replace(trim(p_query), '\s+', ' & ', 'g') || ':*';
    v_tsquery := to_tsquery('english', v_search_terms);
    v_metro_cities := get_metro_cities(p_city);

    RETURN QUERY
    SELECT
        v.id,
        v.name,
        v.slug,
        v.address,
        v.neighborhood,
        v.spot_type,
        v.spot_types,
        v.vibes,
        v.description,
        v.short_description,
        v.lat,
        v.lng,
        v.image_url,
        v.website,
        ts_rank_cd(v.search_vector, v_tsquery, 32)::REAL AS ts_rank,
        similarity(v.name, p_query)::REAL AS similarity_score,
        (
            ts_rank_cd(v.search_vector, v_tsquery, 32) * 0.6 +
            similarity(v.name, p_query) * 0.4 +
            CASE WHEN lower(v.name) = lower(p_query) THEN 1.0 ELSE 0 END +
            CASE WHEN lower(v.name) LIKE lower(p_query) || '%' THEN 0.5 ELSE 0 END
        )::REAL AS combined_score
    FROM venues v
    WHERE
        v.active = true
        AND (v.search_vector @@ v_tsquery OR similarity(v.name, p_query) > 0.2)
        AND (v_metro_cities IS NULL OR v.city = ANY(v_metro_cities))
        AND (p_neighborhoods IS NULL OR v.neighborhood = ANY(p_neighborhoods))
        AND (p_spot_types IS NULL OR v.spot_type = ANY(p_spot_types) OR v.spot_types && p_spot_types)
        AND (p_vibes IS NULL OR v.vibes && p_vibes)
    ORDER BY combined_score DESC, v.name ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_venues_ranked IS 'Full-text search for venues with metro-aware city filter.';

-- ============================================================
-- 1c. search_organizations_ranked – add p_portal_id
-- ============================================================
CREATE OR REPLACE FUNCTION search_organizations_ranked(
    p_query TEXT,
    p_limit INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0,
    p_org_types TEXT[] DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL,
    p_portal_id UUID DEFAULT NULL
)
RETURNS TABLE(
    id TEXT,
    name TEXT,
    slug TEXT,
    org_type TEXT,
    categories TEXT[],
    neighborhood TEXT,
    description TEXT,
    logo_url TEXT,
    website TEXT,
    instagram TEXT,
    total_events_tracked INTEGER,
    ts_rank REAL,
    similarity_score REAL,
    combined_score REAL
) AS $$
DECLARE
    v_tsquery tsquery;
    v_search_terms TEXT;
BEGIN
    v_search_terms := regexp_replace(trim(COALESCE(p_query, '')), '\\s+', ' & ', 'g') || ':*';
    v_tsquery := to_tsquery('english', v_search_terms);

    RETURN QUERY
    WITH org_search AS (
      SELECT
        o.*,
        (
          setweight(to_tsvector('english', COALESCE(o.name, '')), 'A') ||
          setweight(to_tsvector('english', COALESCE(array_to_string(o.categories, ' '), '')), 'B') ||
          setweight(to_tsvector('english', COALESCE(o.org_type, '')), 'B') ||
          setweight(to_tsvector('english', COALESCE(o.neighborhood, '')), 'C') ||
          setweight(to_tsvector('english', COALESCE(o.description, '')), 'C')
        ) AS computed_vector
      FROM organizations o
      WHERE COALESCE(o.hidden, false) = false
    )
    SELECT
      os.id,
      os.name,
      os.slug,
      os.org_type,
      os.categories,
      os.neighborhood,
      os.description,
      os.logo_url,
      os.website,
      os.instagram,
      os.total_events_tracked,
      ts_rank_cd(os.computed_vector, v_tsquery, 32)::REAL AS ts_rank,
      similarity(os.name, p_query)::REAL AS similarity_score,
      (
        ts_rank_cd(os.computed_vector, v_tsquery, 32) * 0.5 +
        similarity(os.name, p_query) * 0.5 +
        CASE WHEN lower(os.name) = lower(p_query) THEN 1.0 ELSE 0 END +
        CASE WHEN lower(os.name) LIKE lower(p_query) || '%' THEN 0.5 ELSE 0 END
      )::REAL AS combined_score
    FROM org_search os
    WHERE
      (os.computed_vector @@ v_tsquery OR similarity(os.name, p_query) > 0.2)
      AND (p_org_types IS NULL OR os.org_type = ANY(p_org_types))
      AND (p_categories IS NULL OR os.categories && p_categories)
      AND (p_portal_id IS NULL OR os.portal_id = p_portal_id OR os.portal_id IS NULL)
    ORDER BY combined_score DESC, os.total_events_tracked DESC NULLS LAST, os.name ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_organizations_ranked IS 'Full-text search for organizations with portal scoping.';

-- Update the backward-compatible alias to pass through p_portal_id
CREATE OR REPLACE FUNCTION search_producers_ranked(
    p_query TEXT,
    p_limit INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0,
    p_org_types TEXT[] DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL,
    p_portal_id UUID DEFAULT NULL
)
RETURNS TABLE(
    id TEXT,
    name TEXT,
    slug TEXT,
    org_type TEXT,
    categories TEXT[],
    neighborhood TEXT,
    description TEXT,
    logo_url TEXT,
    website TEXT,
    instagram TEXT,
    total_events_tracked INTEGER,
    ts_rank REAL,
    similarity_score REAL,
    combined_score REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM search_organizations_ranked(
    p_query,
    p_limit,
    p_offset,
    p_org_types,
    p_categories,
    p_portal_id
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_producers_ranked IS 'Backward-compatible alias for search_organizations_ranked.';

-- ============================================================
-- 1d. search_series_ranked – add p_portal_id
-- ============================================================
CREATE OR REPLACE FUNCTION search_series_ranked(
    p_query TEXT,
    p_limit INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0,
    p_categories TEXT[] DEFAULT NULL,
    p_portal_id UUID DEFAULT NULL
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
      AND (p_portal_id IS NULL OR EXISTS (
        SELECT 1 FROM portal_source_access psa
        JOIN events e ON e.source_id = psa.source_id
        WHERE psa.portal_id = p_portal_id
          AND e.series_id = s.id
          AND e.start_date >= CURRENT_DATE
      ))
    ORDER BY combined_score DESC, u.next_event_date ASC NULLS LAST, s.title ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_series_ranked IS 'Full-text search for series with portal scoping via events.';

-- ============================================================
-- 1e. get_search_facets – add p_city, portal-scope all counts
-- ============================================================
CREATE OR REPLACE FUNCTION get_search_facets(
    p_query TEXT,
    p_portal_id UUID DEFAULT NULL,
    p_city TEXT DEFAULT NULL
)
RETURNS TABLE(
    entity_type TEXT,
    count BIGINT
) AS $$
DECLARE
    v_tsquery tsquery;
    v_search_terms TEXT;
    v_metro_cities TEXT[];
BEGIN
    v_search_terms := regexp_replace(trim(p_query), '\s+', ' & ', 'g') || ':*';
    v_tsquery := to_tsquery('english', v_search_terms);
    v_metro_cities := get_metro_cities(p_city);

    -- Events (already portal-scoped)
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

    -- Venues (add city filter)
    RETURN QUERY
    SELECT 'venue'::TEXT AS entity_type, COUNT(*)::BIGINT
    FROM venues v
    WHERE
      v.active = true
      AND (v.search_vector @@ v_tsquery OR similarity(v.name, p_query) > 0.2)
      AND (v_metro_cities IS NULL OR v.city = ANY(v_metro_cities));

    -- Organizers (add portal filter)
    RETURN QUERY
    SELECT 'organizer'::TEXT AS entity_type, COUNT(*)::BIGINT
    FROM organizations o
    WHERE
      o.hidden = false
      AND (o.search_vector @@ v_tsquery OR similarity(o.name, p_query) > 0.2)
      AND (p_portal_id IS NULL OR o.portal_id = p_portal_id OR o.portal_id IS NULL);

    -- Series (add portal filter via events)
    RETURN QUERY
    SELECT 'series'::TEXT AS entity_type, COUNT(*)::BIGINT
    FROM series s
    WHERE
      COALESCE(s.is_active, true) = true
      AND (s.search_vector @@ v_tsquery OR similarity(s.title, p_query) > 0.2)
      AND (p_portal_id IS NULL OR EXISTS (
        SELECT 1 FROM portal_source_access psa
        JOIN events e ON e.source_id = psa.source_id
        WHERE psa.portal_id = p_portal_id
          AND e.series_id = s.id
          AND e.start_date >= CURRENT_DATE
      ));

    -- Lists (already portal-scoped)
    RETURN QUERY
    SELECT 'list'::TEXT AS entity_type, COUNT(*)::BIGINT
    FROM lists l
    WHERE
      COALESCE(l.is_public, true) = true
      AND COALESCE(l.status, 'active') = 'active'
      AND (l.search_vector @@ v_tsquery OR similarity(l.title, p_query) > 0.2)
      AND (p_portal_id IS NULL OR l.portal_id = p_portal_id);

    -- Festivals (already portal-scoped)
    RETURN QUERY
    SELECT 'festival'::TEXT AS entity_type, COUNT(*)::BIGINT
    FROM festivals f
    WHERE
      (f.search_vector @@ v_tsquery OR similarity(f.name, p_query) > 0.2)
      AND (p_portal_id IS NULL OR f.portal_id = p_portal_id);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_search_facets IS 'Portal-scoped facet counts per entity type.';

-- ============================================================
-- 1f. search_suggestions MV – add city column
-- ============================================================
DROP MATERIALIZED VIEW IF EXISTS search_suggestions;

CREATE MATERIALIZED VIEW search_suggestions AS
WITH
  -- Event titles (upcoming events only) – derive city from venue
  event_titles AS (
    SELECT DISTINCT
      e.title AS text,
      'event' AS type,
      COUNT(*) AS frequency,
      v.city AS city
    FROM events e
    LEFT JOIN venues v ON v.id = e.venue_id
    WHERE e.start_date >= CURRENT_DATE
      AND e.canonical_event_id IS NULL
    GROUP BY e.title, v.city
  ),

  -- Active venue names
  venue_names AS (
    SELECT
      v.name AS text,
      'venue' AS type,
      COUNT(*)::BIGINT AS frequency,
      v.city AS city
    FROM venues v
    WHERE v.active = true
    GROUP BY v.name, v.city
  ),

  -- Distinct neighborhoods from venues
  neighborhoods AS (
    SELECT DISTINCT
      v.neighborhood AS text,
      'neighborhood' AS type,
      COUNT(*) AS frequency,
      v.city AS city
    FROM venues v
    WHERE v.neighborhood IS NOT NULL
      AND v.active = true
    GROUP BY v.neighborhood, v.city
  ),

  -- Organizations (non-hidden)
  producers AS (
    SELECT
      o.name AS text,
      'organizer' AS type,
      COALESCE(o.total_events_tracked, 1) AS frequency,
      NULL::TEXT AS city
    FROM organizations o
    WHERE o.hidden = false
  ),

  -- Distinct categories from events (global)
  categories AS (
    SELECT DISTINCT
      category AS text,
      'category' AS type,
      COUNT(*) AS frequency,
      NULL::TEXT AS city
    FROM events
    WHERE category IS NOT NULL
      AND start_date >= CURRENT_DATE
    GROUP BY category
  ),

  -- Tags from upcoming events (global)
  tags AS (
    SELECT
      UNNEST(tags) AS text,
      'tag' AS type,
      COUNT(*) AS frequency,
      NULL::TEXT AS city
    FROM events
    WHERE start_date >= CURRENT_DATE
      AND tags IS NOT NULL
    GROUP BY 1
    HAVING COUNT(*) >= 3
  ),

  -- Venue vibes (global)
  vibes AS (
    SELECT DISTINCT
      UNNEST(vibes) AS text,
      'vibe' AS type,
      COUNT(*) AS frequency,
      NULL::TEXT AS city
    FROM venues
    WHERE vibes IS NOT NULL
      AND active = true
    GROUP BY 1
    HAVING COUNT(*) >= 2
  ),

  -- Festival names (global)
  festival_names AS (
    SELECT DISTINCT
      name AS text,
      'festival' AS type,
      1::BIGINT AS frequency,
      NULL::TEXT AS city
    FROM festivals
  )

SELECT text, type, frequency, city FROM event_titles WHERE text IS NOT NULL AND length(text) > 0
UNION ALL
SELECT text, type, frequency, city FROM venue_names WHERE text IS NOT NULL AND length(text) > 0
UNION ALL
SELECT text, type, frequency, city FROM neighborhoods WHERE text IS NOT NULL AND length(text) > 0
UNION ALL
SELECT text, type, frequency, city FROM producers WHERE text IS NOT NULL AND length(text) > 0
UNION ALL
SELECT text, type, frequency, city FROM categories WHERE text IS NOT NULL AND length(text) > 0
UNION ALL
SELECT text, type, frequency, city FROM tags WHERE text IS NOT NULL AND length(text) > 0
UNION ALL
SELECT text, type, frequency, city FROM vibes WHERE text IS NOT NULL AND length(text) > 0
UNION ALL
SELECT text, type, frequency, city FROM festival_names WHERE text IS NOT NULL AND length(text) > 0;

-- Recreate indexes
CREATE INDEX idx_search_suggestions_text_trgm ON search_suggestions USING GIN(text gin_trgm_ops);
CREATE INDEX idx_search_suggestions_type ON search_suggestions(type);
CREATE INDEX idx_search_suggestions_frequency ON search_suggestions(frequency DESC);
CREATE UNIQUE INDEX idx_search_suggestions_unique ON search_suggestions(text, type, COALESCE(city, ''));
CREATE INDEX idx_search_suggestions_city ON search_suggestions(city);

REFRESH MATERIALIZED VIEW search_suggestions;

-- ============================================================
-- 1g. get_similar_suggestions – add p_city
-- ============================================================
CREATE OR REPLACE FUNCTION get_similar_suggestions(
    p_query TEXT,
    p_limit INTEGER DEFAULT 8,
    p_min_similarity REAL DEFAULT 0.3,
    p_city TEXT DEFAULT NULL
)
RETURNS TABLE(
    suggestion TEXT,
    type TEXT,
    frequency BIGINT,
    similarity_score REAL
) AS $$
DECLARE
    v_metro_cities TEXT[];
BEGIN
    v_metro_cities := get_metro_cities(p_city);

    RETURN QUERY
    SELECT
        ss.text AS suggestion,
        ss.type,
        ss.frequency,
        similarity(ss.text, p_query)::REAL AS similarity_score
    FROM search_suggestions ss
    WHERE
        (similarity(ss.text, p_query) >= p_min_similarity
         OR ss.text ILIKE '%' || p_query || '%')
        AND (v_metro_cities IS NULL OR ss.city IS NULL OR ss.city = ANY(v_metro_cities))
    ORDER BY
        CASE WHEN lower(ss.text) LIKE lower(p_query) || '%' THEN 0 ELSE 1 END,
        similarity(ss.text, p_query) DESC,
        ss.frequency DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_similar_suggestions IS 'City-scoped typo-corrected suggestions using trigram similarity.';

-- ============================================================
-- 1g. get_spelling_suggestions – add p_city
-- ============================================================
CREATE OR REPLACE FUNCTION get_spelling_suggestions(
    p_query TEXT,
    p_limit INTEGER DEFAULT 3,
    p_city TEXT DEFAULT NULL
)
RETURNS TABLE(
    suggestion TEXT,
    type TEXT,
    similarity_score REAL
) AS $$
DECLARE
    v_metro_cities TEXT[];
BEGIN
    v_metro_cities := get_metro_cities(p_city);

    -- Only suggest if the query doesn't exactly match anything
    IF EXISTS (
        SELECT 1 FROM search_suggestions
        WHERE lower(text) = lower(p_query)
          AND (v_metro_cities IS NULL OR city IS NULL OR city = ANY(v_metro_cities))
    ) THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        ss.text AS suggestion,
        ss.type,
        similarity(ss.text, p_query)::REAL AS similarity_score
    FROM search_suggestions ss
    WHERE
        similarity(ss.text, p_query) >= 0.4
        AND lower(ss.text) != lower(p_query)
        AND (v_metro_cities IS NULL OR ss.city IS NULL OR ss.city = ANY(v_metro_cities))
    ORDER BY
        similarity(ss.text, p_query) DESC,
        ss.frequency DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_spelling_suggestions IS 'City-scoped "Did you mean?" corrections for likely typos.';

-- ============================================================
-- 1h. Drop search_unified (unused)
-- ============================================================
DROP FUNCTION IF EXISTS search_unified(TEXT, TEXT[], INTEGER, UUID);
