-- Migration 244: Fix search_venues_ranked() to honor p_city parameter
--
-- Problem: The web layer passes p_city to search_venues_ranked(), but the
-- function signature did not include that parameter, so Nashville venues leaked
-- into Atlanta search results (and vice versa).
--
-- Fix: Add p_city TEXT DEFAULT NULL parameter and wire it into the WHERE clause.
-- The condition is nullable so existing callers that omit the param get the
-- previous (unfiltered) behavior.
--
-- Note: search_unified() also calls search_venues_ranked() but does not yet
-- expose a city param. That call passes NULL implicitly, which is correct —
-- unified search is not city-scoped today. Scope that separately if needed.
--
-- Note: database/schema.sql does not contain this function (it was added by
-- migration 049 and never backported). Consider a schema.sql refresh pass
-- separately.

-- ============================================
-- DOWN (for reference — Postgres has no native rollback for OR REPLACE)
-- To roll back: re-run migration 049 to restore the original definition.
-- ============================================

-- ============================================
-- UP
-- ============================================
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
BEGIN
    v_search_terms := regexp_replace(trim(p_query), '\s+', ' & ', 'g') || ':*';
    v_tsquery := to_tsquery('english', v_search_terms);

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
        AND (p_city IS NULL OR v.city = p_city)
        AND (p_neighborhoods IS NULL OR v.neighborhood = ANY(p_neighborhoods))
        AND (p_spot_types IS NULL OR v.spot_type = ANY(p_spot_types) OR v.spot_types && p_spot_types)
        AND (p_vibes IS NULL OR v.vibes && p_vibes)
    ORDER BY combined_score DESC, v.name ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_venues_ranked IS 'Full-text search for venues with relevance ranking and trigram similarity. p_city filters to a specific city (e.g. ''Atlanta''); NULL returns all cities.';
