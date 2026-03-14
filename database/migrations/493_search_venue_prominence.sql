-- Improve short proper-noun venue search by preferring whole-token matches
-- and exposing a few modest venue-prominence signals to the web layer.

DROP FUNCTION IF EXISTS search_venues_ranked(TEXT, INTEGER, INTEGER, TEXT[], TEXT[], TEXT[], TEXT);

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
    combined_score REAL,
    featured BOOLEAN,
    explore_featured BOOLEAN,
    data_quality INTEGER,
    is_event_venue BOOLEAN
) AS $$
DECLARE
    v_tsquery tsquery;
    v_search_terms TEXT;
    v_normalized_query TEXT;
    v_is_short_query BOOLEAN;
BEGIN
    v_search_terms := regexp_replace(trim(p_query), '\s+', ' & ', 'g') || ':*';
    v_tsquery := to_tsquery('english', v_search_terms);
    v_normalized_query := lower(trim(p_query));
    v_is_short_query := array_length(regexp_split_to_array(v_normalized_query, '\s+'), 1) = 1
      AND char_length(v_normalized_query) <= 5;

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
            (
                ts_rank_cd(v.search_vector, v_tsquery, 32) * 0.55 +
                similarity(v.name, p_query) * 0.35 +
                CASE WHEN lower(v.name) = v_normalized_query THEN 1.0 ELSE 0 END +
                CASE
                    WHEN lower(v.name) = v_normalized_query
                      OR lower(v.name) LIKE v_normalized_query || ' %'
                    THEN 0.65
                    ELSE 0
                END +
                CASE
                    WHEN lower(v.name) LIKE '% ' || v_normalized_query || ' %'
                      OR lower(v.name) LIKE '% ' || v_normalized_query
                    THEN 0.15
                    ELSE 0
                END +
                CASE
                    WHEN v_is_short_query
                      AND lower(v.name) LIKE v_normalized_query || '%'
                      AND lower(v.name) <> v_normalized_query
                      AND lower(v.name) NOT LIKE v_normalized_query || ' %'
                    THEN -0.18
                    ELSE 0
                END
            )
            * (0.7
                + CASE WHEN v.image_url IS NOT NULL AND v.image_url != '' THEN 0.1 ELSE 0 END
                + CASE WHEN v.description IS NOT NULL AND length(v.description) > 50 THEN 0.1 ELSE 0 END
                + CASE WHEN v.neighborhood IS NOT NULL AND v.neighborhood != '' THEN 0.1 ELSE 0 END
              )
            + CASE WHEN COALESCE(v.is_event_venue, false) THEN 0.18 ELSE 0 END
            + CASE
                WHEN COALESCE(v.featured, false) OR COALESCE(v.explore_featured, false)
                THEN 0.08
                ELSE 0
              END
            + LEAST(0.08, GREATEST(0, COALESCE(v.data_quality, 0) - 70)::REAL / 100.0)
        )::REAL AS combined_score,
        COALESCE(v.featured, false) AS featured,
        COALESCE(v.explore_featured, false) AS explore_featured,
        v.data_quality::INTEGER,
        COALESCE(v.is_event_venue, false) AS is_event_venue
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

COMMENT ON FUNCTION search_venues_ranked IS
  'Full-text search for venues with short-query whole-token boosts and modest prominence signals. v3 2026-03-13.';
