-- Aggregate upcoming event counts by venue for spots/find discovery.
-- This avoids transferring large event row sets to the API just to count
-- venue activity on the server.

CREATE OR REPLACE FUNCTION get_spot_event_counts(
  p_start_date DATE,
  p_end_date DATE,
  p_portal_id UUID DEFAULT NULL,
  p_city_names TEXT[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 480
)
RETURNS TABLE(
  venue_id INTEGER,
  event_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    e.venue_id,
    COUNT(*)::BIGINT AS event_count
  FROM events e
  JOIN venues v ON v.id = e.venue_id
  WHERE e.venue_id IS NOT NULL
    AND e.start_date >= p_start_date
    AND e.start_date <= p_end_date
    AND e.is_active = true
    AND e.canonical_event_id IS NULL
    AND (e.is_sensitive IS NULL OR e.is_sensitive = false)
    AND (e.is_feed_ready IS NULL OR e.is_feed_ready = true)
    AND (
      (p_portal_id IS NOT NULL AND e.portal_id = p_portal_id)
      OR (p_portal_id IS NULL AND e.portal_id IS NULL)
    )
    AND (
      p_city_names IS NULL
      OR array_length(p_city_names, 1) IS NULL
      OR v.city = ANY(p_city_names)
    )
  GROUP BY e.venue_id
  ORDER BY event_count DESC, e.venue_id ASC
  LIMIT GREATEST(COALESCE(p_limit, 480), 1);
$$;

GRANT EXECUTE ON FUNCTION get_spot_event_counts(DATE, DATE, UUID, TEXT[], INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_spot_event_counts(DATE, DATE, UUID, TEXT[], INTEGER) TO service_role;
