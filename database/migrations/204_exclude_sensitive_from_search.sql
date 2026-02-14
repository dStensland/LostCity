-- Migration: Exclude sensitive events (support groups, AA, GriefShare) from general search
-- These events are properly tagged but the search RPC was missing the is_sensitive filter,
-- causing them to appear in search results alongside regular public events.

-- Drop old overload first
DROP FUNCTION IF EXISTS search_events_ranked(text, integer, integer, text[], text[], text, boolean, uuid, text[], text[]);

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
    p_tags TEXT[] DEFAULT NULL
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
    v_parent_categories TEXT[];
BEGIN
    v_search_terms := regexp_replace(trim(p_query), '\s+', ' & ', 'g') || ':*';
    v_tsquery := to_tsquery('english', v_search_terms);

    IF p_subcategories IS NOT NULL THEN
        SELECT array_agg(DISTINCT split_part(sub, '.', 1))
        INTO v_parent_categories
        FROM unnest(p_subcategories) AS sub;
    END IF;

    RETURN QUERY
    SELECT
        e.id,
        e.title,
        e.description,
        e.start_date,
        e.start_time,
        e.end_date,
        e.end_time,
        e.category,
        e.subcategory,
        e.tags,
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
            ts_rank_cd(e.search_vector, v_tsquery, 32) * 0.7 +
            similarity(e.title, p_query) * 0.3 +
            CASE WHEN lower(e.title) = lower(p_query) THEN 1.0 ELSE 0 END +
            CASE WHEN lower(e.title) LIKE lower(p_query) || '%' THEN 0.5 ELSE 0 END
        )::REAL AS combined_score
    FROM events e
    LEFT JOIN venues v ON e.venue_id = v.id
    WHERE
        (e.search_vector @@ v_tsquery OR similarity(e.title, p_query) > 0.2)
        AND e.start_date >= CURRENT_DATE
        AND e.canonical_event_id IS NULL
        -- Exclude sensitive events (support groups, AA, etc.)
        AND (e.is_sensitive IS NULL OR e.is_sensitive = false)
        -- Exclude festival program sessions
        AND NOT EXISTS (
            SELECT 1 FROM series s
            WHERE s.id = e.series_id
            AND s.series_type = 'festival_program'
        )
        AND (p_categories IS NULL OR e.category = ANY(p_categories))
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
                AND (psa.accessible_categories IS NULL OR e.category = ANY(psa.accessible_categories))
            )
        )
        AND (
            p_subcategories IS NULL
            OR e.subcategory = ANY(p_subcategories)
            OR (e.subcategory IS NULL AND e.category = ANY(v_parent_categories))
        )
        AND (p_tags IS NULL OR e.tags && p_tags)
    ORDER BY combined_score DESC, e.start_date ASC, e.start_time ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_events_ranked(text, integer, integer, text[], text[], text, boolean, uuid, text[], text[]) IS 'Full-text search for events with relevance ranking. Excludes sensitive events and festival program sessions.';
