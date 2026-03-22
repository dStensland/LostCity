-- Migration 591: Add p_min_similarity parameter to get_spelling_suggestions
-- Allows callers to lower the threshold for short queries (e.g. "concrts" → "concerts").
-- Previous hardcoded threshold was 0.4 — too strict for short mistyped words.
-- Default kept at 0.3 to preserve existing behavior when param is not supplied.

-- UP

CREATE OR REPLACE FUNCTION get_spelling_suggestions(
    p_query TEXT,
    p_limit INTEGER DEFAULT 3,
    p_city TEXT DEFAULT NULL,
    p_min_similarity REAL DEFAULT 0.3
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
        similarity(ss.text, p_query) >= p_min_similarity
        AND lower(ss.text) != lower(p_query)
        AND (v_metro_cities IS NULL OR ss.city IS NULL OR ss.city = ANY(v_metro_cities))
    ORDER BY
        similarity(ss.text, p_query) DESC,
        ss.frequency DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_spelling_suggestions IS
  'City-scoped spelling correction suggestions using trigram similarity. '
  'p_min_similarity controls the threshold (default 0.3). '
  'Returns nothing when the query exactly matches a known suggestion.';

-- DOWN
-- To revert: recreate with hardcoded 0.4 threshold and drop p_min_similarity param.
