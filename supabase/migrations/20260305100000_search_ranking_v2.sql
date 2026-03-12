-- Migration: Search Ranking V2 — Time Decay + Data Quality Multipliers
--
-- Problem: Search ranking is purely text-match-driven. An event 6 months out
-- with "jazz" in the title AND description beats a jazz event tonight.
--
-- Fix: Multiply the existing text relevance score by:
--   1. Time decay — events sooner get a 2x multiplier, events far out get 0.6x
--   2. Data completeness — events with image, description, venue get up to 1.0x
--
-- Both functions use CREATE OR REPLACE so this is safe to re-run.

-- ============================================
-- search_events_ranked v2
-- ============================================

-- Drop old signature to handle parameter list change
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
    p_subcategories TEXT[] DEFAULT NULL,  -- DEPRECATED: kept for backwards compat, ignored
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
        e.category,
        e.subcategory,
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
            -- Base text relevance (unchanged)
            (
                ts_rank_cd(e.search_vector, v_tsquery, 32) * 0.7 +
                similarity(e.title, p_query) * 0.3 +
                CASE WHEN lower(e.title) = lower(p_query) THEN 1.0 ELSE 0 END +
                CASE WHEN lower(e.title) LIKE lower(p_query) || '%' THEN 0.5 ELSE 0 END
            )
            -- Time decay multiplier: sooner events rank higher
            * CASE
                WHEN e.start_date <= CURRENT_DATE + 1 THEN 2.0
                WHEN e.start_date <= CURRENT_DATE + 3 THEN 1.5
                WHEN e.start_date <= CURRENT_DATE + 7 THEN 1.0
                ELSE 0.6
              END
            -- Data completeness multiplier (0.7 base + up to 0.3 bonus)
            * (0.7
                + CASE WHEN e.image_url IS NOT NULL AND e.image_url != '' THEN 0.1 ELSE 0 END
                + CASE WHEN e.description IS NOT NULL AND length(e.description) > 50 THEN 0.1 ELSE 0 END
                + CASE WHEN e.venue_id IS NOT NULL THEN 0.1 ELSE 0 END
              )
        )::REAL AS combined_score
    FROM events e
    LEFT JOIN venues v ON e.venue_id = v.id
    WHERE
        (e.search_vector @@ v_tsquery OR similarity(e.title, p_query) > 0.2)
        AND e.start_date >= CURRENT_DATE
        AND e.canonical_event_id IS NULL
        -- Exclude sensitive events
        AND (e.is_sensitive IS NULL OR e.is_sensitive = false)
        -- Exclude inactive events
        AND (e.is_active IS NULL OR e.is_active = true)
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
        -- Genre filter
        AND (p_genres IS NULL OR e.genres && p_genres)
        -- Tags filter
        AND (p_tags IS NULL OR e.tags && p_tags)
    ORDER BY combined_score DESC, e.start_date ASC, e.start_time ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION search_events_ranked(text, integer, integer, text[], text[], text, boolean, uuid, text[], text[], text[])
IS 'Full-text search for events with time-decay and data-quality ranking multipliers. v2 2026-03-05.';

-- ============================================
-- search_venues_ranked v2
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
            -- Base text relevance
            (
                ts_rank_cd(v.search_vector, v_tsquery, 32) * 0.6 +
                similarity(v.name, p_query) * 0.4 +
                CASE WHEN lower(v.name) = lower(p_query) THEN 1.0 ELSE 0 END +
                CASE WHEN lower(v.name) LIKE lower(p_query) || '%' THEN 0.5 ELSE 0 END
            )
            -- Data completeness multiplier for venues
            * (0.7
                + CASE WHEN v.image_url IS NOT NULL AND v.image_url != '' THEN 0.1 ELSE 0 END
                + CASE WHEN v.description IS NOT NULL AND length(v.description) > 50 THEN 0.1 ELSE 0 END
                + CASE WHEN v.neighborhood IS NOT NULL AND v.neighborhood != '' THEN 0.1 ELSE 0 END
              )
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

COMMENT ON FUNCTION search_venues_ranked IS 'Full-text search for venues with data-quality ranking multiplier. v2 2026-03-05.';
