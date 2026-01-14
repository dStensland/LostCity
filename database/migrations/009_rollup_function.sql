-- Migration 009: Event Rollup Stats Function
-- Phase 3: Create function to identify events that should be collapsed

-- Function to get events that should be rolled up based on source/venue behavior
CREATE OR REPLACE FUNCTION get_event_rollup_stats(
    p_date DATE,
    p_category TEXT DEFAULT NULL
)
RETURNS TABLE (
    venue_id INTEGER,
    venue_name TEXT,
    venue_slug TEXT,
    venue_count BIGINT,
    source_id INTEGER,
    source_name TEXT,
    source_count BIGINT,
    rollup_behavior TEXT
) AS $$
BEGIN
    -- Venue rollups: venues with many events on same day
    -- These get collapsed to "Venue Name: X events today"
    RETURN QUERY
    SELECT
        v.id::INTEGER as venue_id,
        v.name as venue_name,
        v.slug as venue_slug,
        COUNT(e.id) as venue_count,
        NULL::INTEGER as source_id,
        NULL::TEXT as source_name,
        NULL::BIGINT as source_count,
        COALESCE(s.rollup_behavior, 'normal') as rollup_behavior
    FROM events e
    JOIN venues v ON e.venue_id = v.id
    LEFT JOIN sources s ON e.source_id = s.id
    WHERE e.start_date = p_date
        AND (p_category IS NULL OR e.category = p_category)
        AND COALESCE(s.rollup_behavior, 'normal') = 'venue'
    GROUP BY v.id, v.name, v.slug, s.rollup_behavior
    HAVING COUNT(e.id) > 3;

    -- Source rollups: sources that should collapse (like volunteer platforms)
    -- These get collapsed to "Source Name: X opportunities today"
    RETURN QUERY
    SELECT
        NULL::INTEGER as venue_id,
        NULL::TEXT as venue_name,
        NULL::TEXT as venue_slug,
        NULL::BIGINT as venue_count,
        s.id::INTEGER as source_id,
        s.name as source_name,
        COUNT(e.id) as source_count,
        s.rollup_behavior
    FROM events e
    JOIN sources s ON e.source_id = s.id
    WHERE e.start_date = p_date
        AND s.rollup_behavior = 'collapse'
        AND (p_category IS NULL OR e.category = p_category)
    GROUP BY s.id, s.name, s.rollup_behavior
    HAVING COUNT(e.id) > 5;
END;
$$ LANGUAGE plpgsql;

-- Comment explaining usage
COMMENT ON FUNCTION get_event_rollup_stats IS
'Returns venue and source rollup stats for a given date.
Use to identify which events should be collapsed in the UI:
- venue_id populated: Roll up by venue (e.g., cinema showtimes)
- source_id populated: Roll up by source (e.g., volunteer opportunities)';
