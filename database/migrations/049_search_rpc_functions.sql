-- Migration: Create RPC functions for ranked full-text search
-- These functions provide efficient server-side search with relevance ranking

-- ============================================
-- FUNCTION: Search Events with Ranking
-- ============================================
-- Returns events ranked by full-text search relevance with optional filters
CREATE OR REPLACE FUNCTION search_events_ranked(
    p_query TEXT,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0,
    p_categories TEXT[] DEFAULT NULL,
    p_neighborhoods TEXT[] DEFAULT NULL,
    p_date_filter TEXT DEFAULT NULL,  -- 'today', 'tomorrow', 'weekend', 'week'
    p_is_free BOOLEAN DEFAULT NULL,
    p_portal_id UUID DEFAULT NULL
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
BEGIN
    -- Parse query into tsquery with prefix matching
    -- Convert "live jazz" -> "live & jazz:*"
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
        -- Full-text search rank (normalized by document length)
        ts_rank_cd(e.search_vector, v_tsquery, 32)::REAL AS ts_rank,
        -- Trigram similarity on title
        similarity(e.title, p_query)::REAL AS similarity_score,
        -- Combined score: weighted blend of FTS rank and similarity
        (
            ts_rank_cd(e.search_vector, v_tsquery, 32) * 0.7 +
            similarity(e.title, p_query) * 0.3 +
            -- Boost for exact title match
            CASE WHEN lower(e.title) = lower(p_query) THEN 1.0 ELSE 0 END +
            -- Boost for title starts with query
            CASE WHEN lower(e.title) LIKE lower(p_query) || '%' THEN 0.5 ELSE 0 END
        )::REAL AS combined_score
    FROM events e
    LEFT JOIN venues v ON e.venue_id = v.id
    WHERE
        -- Must match full-text search OR have high trigram similarity
        (e.search_vector @@ v_tsquery OR similarity(e.title, p_query) > 0.2)
        -- Only upcoming events
        AND e.start_date >= CURRENT_DATE
        -- Exclude duplicates
        AND e.canonical_event_id IS NULL
        -- Category filter
        AND (p_categories IS NULL OR e.category = ANY(p_categories))
        -- Neighborhood filter (via venue)
        AND (p_neighborhoods IS NULL OR v.neighborhood = ANY(p_neighborhoods))
        -- Free filter
        AND (p_is_free IS NULL OR e.is_free = p_is_free)
        -- Date filter
        AND (
            p_date_filter IS NULL
            OR (p_date_filter = 'today' AND e.start_date = CURRENT_DATE)
            OR (p_date_filter = 'tomorrow' AND e.start_date = CURRENT_DATE + 1)
            OR (p_date_filter = 'weekend' AND e.start_date BETWEEN
                (CURRENT_DATE + (6 - EXTRACT(DOW FROM CURRENT_DATE)::INT) % 7)
                AND (CURRENT_DATE + (6 - EXTRACT(DOW FROM CURRENT_DATE)::INT) % 7 + 1))
            OR (p_date_filter = 'week' AND e.start_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7)
        )
        -- Portal source access filter
        AND (
            p_portal_id IS NULL
            OR EXISTS (
                SELECT 1 FROM portal_source_access psa
                WHERE psa.portal_id = p_portal_id
                AND psa.source_id = e.source_id
                AND (psa.accessible_categories IS NULL OR e.category = ANY(psa.accessible_categories))
            )
        )
    ORDER BY combined_score DESC, e.start_date ASC, e.start_time ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_events_ranked IS 'Full-text search for events with relevance ranking, trigram similarity, and portal scoping.';

-- ============================================
-- FUNCTION: Search Venues with Ranking
-- ============================================
CREATE OR REPLACE FUNCTION search_venues_ranked(
    p_query TEXT,
    p_limit INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0,
    p_neighborhoods TEXT[] DEFAULT NULL,
    p_spot_types TEXT[] DEFAULT NULL,
    p_vibes TEXT[] DEFAULT NULL
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
        AND (p_neighborhoods IS NULL OR v.neighborhood = ANY(p_neighborhoods))
        AND (p_spot_types IS NULL OR v.spot_type = ANY(p_spot_types) OR v.spot_types && p_spot_types)
        AND (p_vibes IS NULL OR v.vibes && p_vibes)
    ORDER BY combined_score DESC, v.name ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_venues_ranked IS 'Full-text search for venues with relevance ranking and trigram similarity.';

-- ============================================
-- FUNCTION: Search Producers with Ranking
-- ============================================
CREATE OR REPLACE FUNCTION search_producers_ranked(
    p_query TEXT,
    p_limit INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0,
    p_org_types TEXT[] DEFAULT NULL,
    p_categories TEXT[] DEFAULT NULL
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
    v_search_terms := regexp_replace(trim(p_query), '\s+', ' & ', 'g') || ':*';
    v_tsquery := to_tsquery('english', v_search_terms);

    RETURN QUERY
    SELECT
        ep.id,
        ep.name,
        ep.slug,
        ep.org_type,
        ep.categories,
        ep.neighborhood,
        ep.description,
        ep.logo_url,
        ep.website,
        ep.instagram,
        ep.total_events_tracked,
        ts_rank_cd(ep.search_vector, v_tsquery, 32)::REAL AS ts_rank,
        similarity(ep.name, p_query)::REAL AS similarity_score,
        (
            ts_rank_cd(ep.search_vector, v_tsquery, 32) * 0.5 +
            similarity(ep.name, p_query) * 0.5 +
            CASE WHEN lower(ep.name) = lower(p_query) THEN 1.0 ELSE 0 END +
            CASE WHEN lower(ep.name) LIKE lower(p_query) || '%' THEN 0.5 ELSE 0 END
        )::REAL AS combined_score
    FROM event_producers ep
    WHERE
        ep.hidden = false
        AND (ep.search_vector @@ v_tsquery OR similarity(ep.name, p_query) > 0.2)
        AND (p_org_types IS NULL OR ep.org_type = ANY(p_org_types))
        AND (p_categories IS NULL OR ep.categories && p_categories)
    ORDER BY combined_score DESC, ep.total_events_tracked DESC NULLS LAST, ep.name ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_producers_ranked IS 'Full-text search for event producers/organizers with relevance ranking.';

-- ============================================
-- FUNCTION: Get Similar Suggestions (Typo Correction)
-- ============================================
CREATE OR REPLACE FUNCTION get_similar_suggestions(
    p_query TEXT,
    p_limit INTEGER DEFAULT 8,
    p_min_similarity REAL DEFAULT 0.3
)
RETURNS TABLE(
    suggestion TEXT,
    type TEXT,
    frequency BIGINT,
    similarity_score REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ss.text AS suggestion,
        ss.type,
        ss.frequency,
        similarity(ss.text, p_query)::REAL AS similarity_score
    FROM search_suggestions ss
    WHERE
        similarity(ss.text, p_query) >= p_min_similarity
        OR ss.text ILIKE '%' || p_query || '%'
    ORDER BY
        -- Prioritize prefix matches
        CASE WHEN lower(ss.text) LIKE lower(p_query) || '%' THEN 0 ELSE 1 END,
        -- Then by similarity
        similarity(ss.text, p_query) DESC,
        -- Then by frequency
        ss.frequency DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_similar_suggestions IS 'Returns typo-corrected suggestions using trigram similarity.';

-- ============================================
-- FUNCTION: Get Spelling Suggestions ("Did you mean?")
-- ============================================
CREATE OR REPLACE FUNCTION get_spelling_suggestions(
    p_query TEXT,
    p_limit INTEGER DEFAULT 3
)
RETURNS TABLE(
    suggestion TEXT,
    type TEXT,
    similarity_score REAL
) AS $$
BEGIN
    -- Only suggest if the query doesn't exactly match anything
    IF EXISTS (
        SELECT 1 FROM search_suggestions WHERE lower(text) = lower(p_query)
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
    ORDER BY
        similarity(ss.text, p_query) DESC,
        ss.frequency DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_spelling_suggestions IS 'Returns "Did you mean?" style corrections for likely typos.';

-- ============================================
-- FUNCTION: Unified Search Across All Entities
-- ============================================
CREATE OR REPLACE FUNCTION search_unified(
    p_query TEXT,
    p_types TEXT[] DEFAULT ARRAY['event', 'venue', 'organizer'],
    p_limit_per_type INTEGER DEFAULT 10,
    p_portal_id UUID DEFAULT NULL
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
BEGIN
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

    -- Venues
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
        FROM search_venues_ranked(p_query, p_limit_per_type, 0, NULL, NULL, NULL) v;
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

COMMENT ON FUNCTION search_unified IS 'Unified search across events, venues, and organizers with relevance ranking.';

-- ============================================
-- FUNCTION: Get Search Facets
-- ============================================
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

    -- Count events
    RETURN QUERY
    SELECT 'event'::TEXT AS entity_type, COUNT(*)::BIGINT
    FROM events e
    WHERE
        (e.search_vector @@ v_tsquery OR similarity(e.title, p_query) > 0.2)
        AND e.start_date >= CURRENT_DATE
        AND e.canonical_event_id IS NULL
        AND (
            p_portal_id IS NULL
            OR EXISTS (
                SELECT 1 FROM portal_source_access psa
                WHERE psa.portal_id = p_portal_id
                AND psa.source_id = e.source_id
            )
        );

    -- Count venues
    RETURN QUERY
    SELECT 'venue'::TEXT AS entity_type, COUNT(*)::BIGINT
    FROM venues v
    WHERE
        v.active = true
        AND (v.search_vector @@ v_tsquery OR similarity(v.name, p_query) > 0.2);

    -- Count organizers
    RETURN QUERY
    SELECT 'organizer'::TEXT AS entity_type, COUNT(*)::BIGINT
    FROM event_producers ep
    WHERE
        ep.hidden = false
        AND (ep.search_vector @@ v_tsquery OR similarity(ep.name, p_query) > 0.2);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_search_facets IS 'Returns count of matching results per entity type for faceted search.';
