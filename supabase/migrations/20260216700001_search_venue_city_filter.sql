-- Add p_city parameter to search_venues_ranked RPC
-- Prevents Nashville (or other city) venues from appearing in Atlanta search results.

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
    -- Prepare search terms: handle multi-word queries
    v_search_terms := regexp_replace(trim(p_query), '\s+', ' & ', 'g');
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
        AND (p_neighborhoods IS NULL OR v.neighborhood = ANY(p_neighborhoods))
        AND (p_spot_types IS NULL OR v.spot_type = ANY(p_spot_types) OR v.spot_types && p_spot_types)
        AND (p_vibes IS NULL OR v.vibes && p_vibes)
        AND (p_city IS NULL OR v.city = p_city)
    ORDER BY combined_score DESC, v.name ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_venues_ranked IS 'Full-text search for venues with relevance ranking, trigram similarity, and optional city scoping.';

-- Also update search_unified to pass city through to venue search
CREATE OR REPLACE FUNCTION search_unified(
    p_query TEXT,
    p_types TEXT[] DEFAULT ARRAY['event', 'venue', 'organizer'],
    p_limit INTEGER DEFAULT 20,
    p_portal_id UUID DEFAULT NULL,
    p_city TEXT DEFAULT NULL
)
RETURNS TABLE(
    entity_id TEXT,
    entity_type TEXT,
    title TEXT,
    subtitle TEXT,
    href TEXT,
    combined_score REAL,
    metadata JSONB
) AS $$
DECLARE
    p_limit_per_type INTEGER;
BEGIN
    p_limit_per_type := GREATEST(p_limit / array_length(p_types, 1), 5);

    -- Events
    IF 'event' = ANY(p_types) THEN
        RETURN QUERY
        SELECT
            e.id::TEXT AS entity_id,
            'event'::TEXT AS entity_type,
            e.title,
            COALESCE(e.venue_name, '')::TEXT AS subtitle,
            '/event/' || e.id AS href,
            e.combined_score,
            jsonb_build_object(
                'date', e.start_date,
                'time', e.start_time,
                'category', e.category,
                'neighborhood', e.venue_neighborhood,
                'isFree', e.is_free
            ) AS metadata
        FROM search_events_ranked(p_query, p_limit_per_type, 0, NULL, NULL, NULL, NULL, p_portal_id) e;
    END IF;

    -- Venues (with city filter)
    IF 'venue' = ANY(p_types) THEN
        RETURN QUERY
        SELECT
            v.id::TEXT AS entity_id,
            'venue'::TEXT AS entity_type,
            v.name AS title,
            COALESCE(v.neighborhood, '')::TEXT AS subtitle,
            '/venue/' || v.slug AS href,
            v.combined_score,
            jsonb_build_object(
                'neighborhood', v.neighborhood,
                'spotType', v.spot_type,
                'vibes', v.vibes
            ) AS metadata
        FROM search_venues_ranked(p_query, p_limit_per_type, 0, NULL, NULL, NULL, p_city) v;
    END IF;

    -- Organizers
    IF 'organizer' = ANY(p_types) THEN
        RETURN QUERY
        SELECT
            ep.id::TEXT AS entity_id,
            'organizer'::TEXT AS entity_type,
            ep.name AS title,
            COALESCE(ep.org_type, '')::TEXT AS subtitle,
            '/organizer/' || ep.slug AS href,
            ep.combined_score,
            jsonb_build_object(
                'orgType', ep.org_type,
                'categories', ep.categories,
                'eventCount', ep.total_events_tracked
            ) AS metadata
        FROM search_producers_ranked(p_query, p_limit_per_type, 0, NULL, NULL) ep;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_unified IS 'Unified search across events, venues, and organizers with relevance ranking and city scoping.';
